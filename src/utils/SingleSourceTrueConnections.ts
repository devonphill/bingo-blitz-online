
/**
 * Single Source of Truth wrapper for WebSocket connections
 * This ensures we only have one connection to any given session, and can share it across components
 */
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from './logUtils';
import { RealtimeChannel, RealtimeChannelSendResponse } from '@supabase/supabase-js';
import { WebSocketConnectionStatus, CONNECTION_STATES, CHANNEL_NAMES, EVENT_TYPES } from '@/constants/websocketConstants';

// Singleton instance
let instance: SingleSourceTrueConnections | null = null;

export class SingleSourceTrueConnections {
  private supabaseRealtimeClient = supabase;
  private channels: Map<string, RealtimeChannel> = new Map();
  private channelRefCounts: Map<string, number> = new Map();
  private connectionStatus: WebSocketConnectionStatus = CONNECTION_STATES.DISCONNECTED;
  private statusListeners: Array<(status: WebSocketConnectionStatus, serviceInitialized: boolean) => void> = [];
  private serviceInitialized: boolean = false;
  private activeSessionId: string | null = null;
  private lastPingTime: Date | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (instance) {
      throw new Error('Cannot instantiate SingleSourceTrueConnections more than once. Use getSingleSourceConnection() instead.');
    }

    this.initialize();
  }

  /**
   * Initialize the WebSocket service
   */
  public initialize(): void {
    if (this.serviceInitialized) {
      console.warn('SingleSourceTrueConnections already initialized');
      return;
    }

    logWithTimestamp('Initializing SingleSourceTrueConnections', 'info');

    // Set up ping interval
    this.startPing();

    this.serviceInitialized = true;
    this.updateConnectionStatus(CONNECTION_STATES.DISCONNECTED);
  }

  /**
   * Start the WebSocket ping interval
   */
  private startPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      this.updateLastPing();

      // Check connection status
      const currentStatus = this.connectionStatus;

      // Only log if the status is not disconnected
      if (currentStatus !== CONNECTION_STATES.DISCONNECTED) {
        logWithTimestamp(`WebSocket ping check: ${currentStatus}`, 'debug');
      }
    }, 10000); // Ping every 10 seconds
  }

  /**
   * Update the last ping time
   */
  public updateLastPing(): void {
    this.lastPingTime = new Date();
  }

  /**
   * Get the last ping time
   */
  public getLastPing(): Date | null {
    return this.lastPingTime;
  }

  /**
   * Get whether the service has been initialized
   */
  public isServiceInitialized(): boolean {
    return this.serviceInitialized;
  }

  /**
   * Connect to a session
   * @param sessionId The session ID to connect to
   */
  public connect(sessionId: string): void {
    if (!this.serviceInitialized) {
      logWithTimestamp('Cannot connect: SingleSourceTrueConnections not initialized', 'error');
      return;
    }

    if (!sessionId) {
      logWithTimestamp('Cannot connect: No session ID provided', 'error');
      return;
    }

    // Store the active session ID
    this.activeSessionId = sessionId;

    // Set status to connecting first
    this.updateConnectionStatus(CONNECTION_STATES.CONNECTING);

    // Create a test channel to verify connection
    const testChannelName = `connection-test-${sessionId}`;
    const testChannel = this.supabaseRealtimeClient.channel(testChannelName);

    testChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Successfully connected
        this.updateConnectionStatus(CONNECTION_STATES.CONNECTED);
        this.updateLastPing();
        logWithTimestamp(`Connected to session ${sessionId}`, 'info');
      } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        // Connection failed
        this.updateConnectionStatus(CONNECTION_STATES.ERROR);
        logWithTimestamp(`Failed to connect to session ${sessionId}: ${status}`, 'error');
      }

      // Clean up test channel after verification
      setTimeout(() => {
        this.supabaseRealtimeClient.removeChannel(testChannel);
      }, 1000);
    });
  }

  /**
   * Disconnect from a session
   */
  public disconnect(): void {
    // Clear active session ID
    this.activeSessionId = null;

    // Remove all channels
    this.channels.forEach((channel) => {
      this.supabaseRealtimeClient.removeChannel(channel);
    });

    // Clear channel maps
    this.channels.clear();
    this.channelRefCounts.clear();

    // Update connection status
    this.updateConnectionStatus(CONNECTION_STATES.DISCONNECTED);

    logWithTimestamp('Disconnected from all sessions', 'info');
  }

  /**
   * Get the current connection status
   */
  public getCurrentConnectionState(): WebSocketConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get the active session ID
   */
  public getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.connectionStatus === CONNECTION_STATES.CONNECTED;
  }

  /**
   * Update the connection status
   */
  private updateConnectionStatus(newStatus: WebSocketConnectionStatus): void {
    const previousStatus = this.connectionStatus;
    this.connectionStatus = newStatus;

    // Notify listeners of status change
    if (previousStatus !== newStatus || !this.serviceInitialized) {
      logWithTimestamp(`WebSocket connection status changed from ${previousStatus} to ${newStatus}`, 'info');
      this.notifyStatusListeners();
    }
  }

  /**
   * Notify all status listeners of the current status
   */
  private notifyStatusListeners(): void {
    this.statusListeners.forEach((listener) => {
      try {
        listener(this.connectionStatus, this.serviceInitialized);
      } catch (error) {
        logWithTimestamp(`Error in status listener: ${error}`, 'error');
      }
    });
  }

  /**
   * Add a status listener
   */
  public addStatusListener(listener: (status: WebSocketConnectionStatus, serviceInitialized: boolean) => void): () => void {
    this.statusListeners.push(listener);

    // Notify the new listener immediately
    try {
      listener(this.connectionStatus, this.serviceInitialized);
    } catch (error) {
      logWithTimestamp(`Error in new status listener: ${error}`, 'error');
    }

    // Return a function to remove the listener
    return () => {
      const index = this.statusListeners.indexOf(listener);
      if (index !== -1) {
        this.statusListeners.splice(index, 1);
      }
    };
  }

  /**
   * Add a connection listener (simplified version of status listener)
   */
  public addConnectionListener(listener: (isConnected: boolean) => void): () => void {
    const statusListener = (status: WebSocketConnectionStatus) => {
      listener(status === CONNECTION_STATES.CONNECTED);
    };

    return this.addStatusListener((status) => statusListener(status));
  }

  /**
   * Listen for events on a channel
   */
  public listenForEvent<T = any>(
    baseChannelNameKey: keyof typeof CHANNEL_NAMES,
    eventName: string,
    callback: (payload: T) => void,
    sessionId?: string
  ): () => void {
    if (!this.serviceInitialized) {
      logWithTimestamp(`Cannot listen for events: service not initialized`, 'error');
      return () => {};
    }

    const targetSessionId = sessionId || this.activeSessionId;

    if (!targetSessionId) {
      logWithTimestamp(`Cannot listen for events: no session ID`, 'error');
      return () => {};
    }

    // Construct full channel name
    const baseChannelName = CHANNEL_NAMES[baseChannelNameKey];
    const fullChannelName = `${baseChannelName}${targetSessionId}`;

    logWithTimestamp(`Setting up listener for ${eventName} on ${fullChannelName}`, 'debug');

    // Get or create channel
    let channel = this.channels.get(fullChannelName);
    let isSubscribed = false;
    let eventHandler: any = null;

    // Create a promise that resolves when the channel is subscribed
    const setupListener = () => {
      return new Promise<void>((resolve, reject) => {
        try {
          if (!channel) {
            channel = this.supabaseRealtimeClient.channel(fullChannelName);
            this.channels.set(fullChannelName, channel);
            this.channelRefCounts.set(fullChannelName, 0);

            // Subscribe to the channel and wait for confirmation
            channel.subscribe((status) => {
              logWithTimestamp(`Channel ${fullChannelName} status: ${status}`, 'debug');

              if (status === 'SUBSCRIBED') {
                isSubscribed = true;
                resolve();
              } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                logWithTimestamp(`Failed to subscribe to channel ${fullChannelName}: ${status}`, 'error');
                reject(new Error(`Failed to subscribe: ${status}`));
              }
            });
          } else {
            // Channel already exists, resolve immediately
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
    };

    // Set up the listener asynchronously
    setupListener().then(() => {
      // Increment reference count
      const refCount = this.channelRefCounts.get(fullChannelName) || 0;
      this.channelRefCounts.set(fullChannelName, refCount + 1);

      // Add event listener
      eventHandler = ({ payload }: { payload: T }) => {
        try {
          callback(payload);
        } catch (error) {
          logWithTimestamp(`Error in event listener for ${eventName}: ${error}`, 'error');
        }
      };

      channel!.on('broadcast', { event: eventName }, eventHandler);
      logWithTimestamp(`Successfully set up listener for ${eventName} on ${fullChannelName}`, 'info');
    }).catch((error) => {
      logWithTimestamp(`Error setting up listener for ${eventName}: ${error}`, 'error');
    });

    // Return cleanup function
    return () => {
      if (channel && eventHandler) {
        // Remove the specific event handler if it was added
        try {
          channel.off('broadcast', { event: eventName }, eventHandler);
        } catch (error) {
          logWithTimestamp(`Error removing event listener: ${error}`, 'warn');
        }
      }

      // Decrement reference count
      const newRefCount = (this.channelRefCounts.get(fullChannelName) || 1) - 1;
      this.channelRefCounts.set(fullChannelName, newRefCount);

      // If reference count is 0, remove the channel
      if (newRefCount <= 0) {
        if (channel) {
          this.supabaseRealtimeClient.removeChannel(channel);
        }
        this.channels.delete(fullChannelName);
        this.channelRefCounts.delete(fullChannelName);
      }
    };
  }

  /**
   * Broadcast a message to a channel with retry logic
   */
  public async broadcast<T>(
    baseChannelNameKey: keyof typeof CHANNEL_NAMES,
    eventName: string,
    payload: T,
    sessionId?: string,
    retries: number = 3
  ): Promise<boolean | RealtimeChannelSendResponse> {
    const targetSessionId = sessionId || this.activeSessionId;

    if (!targetSessionId) {
      logWithTimestamp(`Cannot broadcast: no session ID`, 'error');
      return false;
    }

    // Construct full channel name
    const baseChannelName = CHANNEL_NAMES[baseChannelNameKey];
    const fullChannelName = `${baseChannelName}${targetSessionId}`;

    // Function to ensure channel is subscribed
    const ensureChannelSubscribed = async (): Promise<RealtimeChannel> => {
      return new Promise((resolve, reject) => {
        // Get existing channel
        let channel = this.channels.get(fullChannelName);

        if (!channel) {
          // Create new channel
          channel = this.supabaseRealtimeClient.channel(fullChannelName);
          this.channels.set(fullChannelName, channel);
          this.channelRefCounts.set(fullChannelName, 1);

          // Set up subscription with timeout
          const timeoutId = setTimeout(() => {
            reject(new Error('Channel subscription timed out'));
          }, 5000); // 5 second timeout

          // Subscribe and wait for confirmation
          channel.subscribe((status) => {
            logWithTimestamp(`Channel ${fullChannelName} status: ${status}`, 'debug');

            if (status === 'SUBSCRIBED') {
              clearTimeout(timeoutId);
              resolve(channel);
            } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              clearTimeout(timeoutId);
              reject(new Error(`Failed to subscribe: ${status}`));
            }
          });
        } else {
          // Channel already exists, resolve immediately
          resolve(channel);
        }
      });
    };

    // Retry logic
    let lastError: any = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Ensure channel is subscribed
        const channel = await ensureChannelSubscribed();

        // Broadcast the message
        const result = await channel.send({
          type: 'broadcast',
          event: eventName,
          payload: {
            ...payload,
            sessionId: targetSessionId
          }
        });

        logWithTimestamp(`Successfully broadcast message to ${fullChannelName} on attempt ${attempt + 1}`, 'info');
        return result;
      } catch (error) {
        lastError = error;
        logWithTimestamp(`Error broadcasting to ${fullChannelName} on attempt ${attempt + 1}: ${error}`, 'warn');

        if (attempt < retries - 1) {
          // Wait before retrying with exponential backoff
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, etc.
          logWithTimestamp(`Retrying in ${delay}ms...`, 'info');
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logWithTimestamp(`Failed to broadcast to ${fullChannelName} after ${retries} attempts: ${lastError}`, 'error');
    return false;
  }

  /**
   * Broadcast a number called event with retries
   */
  public async broadcastNumberCalled(
    sessionId: string, 
    number: number,
    retries: number = 3
  ): Promise<boolean | RealtimeChannelSendResponse> {
    logWithTimestamp(`Broadcasting number ${number} for session ${sessionId} with ${retries} retries`, 'info');

    return this.broadcast(
      'GAME_UPDATES_BASE',
      EVENT_TYPES.NUMBER_CALLED,
      { 
        number, 
        timestamp: new Date().toISOString(),
        calledNumbers: [] // This will be filled in by the receiver if needed
      },
      sessionId,
      retries
    );
  }

  /**
   * Broadcast with retry - convenience method that matches WebSocketService API
   */
  public async broadcastWithRetry(
    channelNameKey: keyof typeof CHANNEL_NAMES,
    eventName: string,
    payload: any,
    retries: number = 3
  ): Promise<boolean> {
    const result = await this.broadcast(
      channelNameKey,
      eventName,
      payload,
      payload.sessionId,
      retries
    );

    return result !== false;
  }
}

/**
 * Get the singleton instance of SingleSourceTrueConnections
 */
export const getSingleSourceConnection = (): SingleSourceTrueConnections => {
  if (!instance) {
    instance = new SingleSourceTrueConnections();
  }
  return instance;
};
