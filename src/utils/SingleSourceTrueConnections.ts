
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RealtimeChannel } from '@supabase/supabase-js';
import { logWithTimestamp } from './logUtils';
import { ConnectionState } from '@/constants/connectionConstants';
import { EVENT_TYPES, CHANNEL_NAMES } from '@/constants/websocketConstants';

/**
 * Manages a single WebSocket connection across the entire application.
 * This ensures that only one WebSocket connection is active at any time,
 * reducing resource consumption and potential conflicts.
 */
class SingleSourceTrueConnections {
  private static instance: SingleSourceTrueConnections | null = null;
  private webSocketService: WebSocketService | null = null;
  private client: SupabaseClient | null = null;
  private currentSessionId: string | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private connectionListeners: ((isConnected: boolean) => void)[] = [];
  private statusListeners: ((status: ConnectionState, isServiceInitialized: boolean) => void)[] = [];
  private channels: Map<string, RealtimeChannel> = new Map();
  private channelRefCounts: Map<string, number> = new Map();

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    // Initialization logic
    this.initializeBaseWebServiceListeners();
  }

  /**
   * Gets the singleton instance of the SingleSourceTrueConnections class.
   * @returns The singleton instance.
   */
  public static getInstance(): SingleSourceTrueConnections {
    if (!SingleSourceTrueConnections.instance) {
      SingleSourceTrueConnections.instance = new SingleSourceTrueConnections();
    }
    return SingleSourceTrueConnections.instance;
  }

  /**
   * Sets up base listeners for the WebSocket service
   */
  private initializeBaseWebServiceListeners(): void {
    logWithTimestamp('[SSTC] Base WebSocket service listener setup initialized', 'info');
    
    // Add browser online/offline event listeners
    window.addEventListener('online', () => {
      logWithTimestamp('[SSTC] Browser online event detected', 'info');
      this.setConnectionState('connecting');
      
      // Try to reconnect if there was a session
      if (this.currentSessionId) {
        logWithTimestamp('[SSTC] Trying to reconnect to session after coming online', 'info');
        this.connect(this.currentSessionId);
      }
    });
    
    window.addEventListener('offline', () => {
      logWithTimestamp('[SSTC] Browser offline event detected', 'info');
      this.setConnectionState('disconnected');
    });
  }

  /**
   * Initializes the WebSocket service with the Supabase URL and API key.
   * @param supabaseUrl The Supabase URL.
   * @param supabaseKey The Supabase API key.
   */
  public initialize(supabaseUrl: string, supabaseKey: string): void {
    if (this.client) {
      logWithTimestamp('[SSTC] WebSocket service already initialized', 'warn');
      return;
    }

    try {
      this.client = createClient(supabaseUrl, supabaseKey);

      this.webSocketService = {
        getClient: () => this.client as SupabaseClient,
      };

      this.setConnectionState('connected');
      logWithTimestamp('[SSTC] WebSocket service initialized successfully', 'info');
      this.notifyStatusListeners();
    } catch (error) {
      console.error('Failed to initialize WebSocket service:', error);
      this.setConnectionState('error');
      this.notifyStatusListeners();
    }
  }

  /**
   * Checks if the WebSocket service is initialized.
   * @returns True if the service is initialized, false otherwise.
   */
  public isServiceInitialized(): boolean {
    return this.client !== null && this.webSocketService !== null && this.connectionState !== 'disconnected';
  }

  /**
   * Gets the current connection state.
   * @returns The current connection state.
   */
  public getCurrentConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Checks if the WebSocket is currently connected.
   * @returns True if the WebSocket is connected, false otherwise.
   */
  public isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Connects to a specific session using the provided session ID.
   * @param sessionId The ID of the session to connect to.
   */
  public connect(sessionId: string): void {
    if (!sessionId) {
      logWithTimestamp('[SSTC] Cannot connect: No session ID provided', 'warn');
      return;
    }

    if (!this.isServiceInitialized()) {
      logWithTimestamp('[SSTC] Cannot connect: WebSocket service not initialized', 'warn');
      this.setConnectionState('disconnected');
      this.notifyStatusListeners();
      return;
    }

    if (this.currentSessionId === sessionId && this.connectionState === 'connected') {
      logWithTimestamp(`[SSTC] Already connected to session ${sessionId}`, 'info');
      return;
    }

    this.currentSessionId = sessionId;
    this.setConnectionState('connecting');
    logWithTimestamp(`[SSTC] Connecting to session ${sessionId}`, 'info');
    
    // If service is already initialized, consider it connected
    if (this.isServiceInitialized()) {
      this.setConnectionState('connected');
    }
    
    this.notifyStatusListeners();
  }

  /**
   * Disconnects from the current session.
   */
  public disconnect(): void {
    if (!this.currentSessionId) {
      logWithTimestamp('[SSTC] Not connected to any session', 'warn');
      return;
    }

    logWithTimestamp(`[SSTC] Disconnecting from session ${this.currentSessionId}`, 'info');
    
    // Save the current session ID for the log
    const oldSessionId = this.currentSessionId;
    
    // Clean up all channels
    this.unsubscribeAllChannels();
    
    this.currentSessionId = null;
    this.setConnectionState('disconnected');
    logWithTimestamp(`[SSTC] Disconnected from session ${oldSessionId}`, 'info');
    this.notifyConnectionListeners(false);
    this.notifyStatusListeners();
  }
  
  /**
   * Unsubscribes from all channels and cleans up
   */
  private unsubscribeAllChannels(): void {
    // Unsubscribe from all channels
    this.channels.forEach((channel, channelName) => {
      channel.unsubscribe().then(() => {
        logWithTimestamp(`[SSTC] Unsubscribed from channel ${channelName}`, 'info');
      }).catch(error => {
        logWithTimestamp(`[SSTC] Error unsubscribing from channel ${channelName}: ${error}`, 'error');
      });
    });
    
    // Clear all channel tracking
    this.channels.clear();
    this.channelRefCounts.clear();
  }

  /**
   * Gets the current session ID.
   * @returns The current session ID, or null if not connected to any session.
   */
  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Adds a listener for connection status changes.
   * @param listener The listener function to add.
   * @returns A function to remove the listener.
   */
  public addConnectionListener(listener: (isConnected: boolean) => void): () => void {
    // Add the listener to our array
    this.connectionListeners.push(listener);
    
    // Immediately call the listener with the current state
    listener(this.isConnected());
    
    // Return a cleanup function
    return () => {
      this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
    };
  }

  /**
   * Adds a listener for service status changes.
   * @param listener The listener function to add.
   * @returns A function to remove the listener.
   */
  public addStatusListener(listener: (status: ConnectionState, isServiceInitialized: boolean) => void): () => void {
    this.statusListeners.push(listener);
    
    // Call immediately with current status
    listener(this.connectionState, this.isServiceInitialized());
    
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  /**
   * Notifies all connection listeners of a connection status change.
   * @param isConnected True if the WebSocket is connected, false otherwise.
   */
  private notifyConnectionListeners(isConnected: boolean): void {
    logWithTimestamp(`[SSTC] Notifying ${this.connectionListeners.length} connection listeners: isConnected=${isConnected}`, 'info');
    this.connectionListeners.forEach(listener => listener(isConnected));
  }

  /**
   * Notifies all status listeners of a service status change.
   */
  private notifyStatusListeners(): void {
    logWithTimestamp(`[SSTC] Notifying ${this.statusListeners.length} status listeners: status=${this.connectionState}, initialized=${this.isServiceInitialized()}`, 'info');
    this.statusListeners.forEach(listener => listener(this.connectionState, this.isServiceInitialized()));
  }

  /**
   * Sets the connection state and notifies listeners.
   * @param state The new connection state.
   */
  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    if (state === 'connected') {
      this.notifyConnectionListeners(true);
    } else {
      this.notifyConnectionListeners(false);
    }
    this.notifyStatusListeners();
  }
  
  /**
   * Gets an existing channel or creates a new one
   * @param channelName The name of the channel to get or create
   * @returns The RealtimeChannel instance
   */
  private getOrCreateChannel(channelName: string): RealtimeChannel {
    const existingChannel = this.channels.get(channelName);
    
    if (existingChannel) {
      const state = existingChannel.state;
      
      // Reuse channel if it's in a usable state
      if (state === 'joined' || state === 'joining') {
        logWithTimestamp(`[SSTC] Reusing existing channel ${channelName} in state: ${state}`, 'info');
        return existingChannel;
      }
      
      // Channel exists but in an unusable state, clean it up
      logWithTimestamp(`[SSTC] Channel ${channelName} exists but in state: ${state}. Creating new channel`, 'warn');
      try {
        existingChannel.unsubscribe().catch(err => {
          logWithTimestamp(`[SSTC] Error unsubscribing from old channel: ${err}`, 'error');
        });
      } catch (error) {
        logWithTimestamp(`[SSTC] Error cleaning up old channel: ${error}`, 'error');
      }
    }
    
    if (!this.client) {
      throw new Error('[SSTC] Cannot create channel: WebSocket client not initialized');
    }
    
    // Create a new channel
    logWithTimestamp(`[SSTC] Creating new channel: ${channelName}`, 'info');
    const channel = this.client
      .channel(channelName)
      .subscribe((status) => {
        logWithTimestamp(`[SSTC] Channel ${channelName} status: ${status}`, 'info');
      });
    
    // Store the new channel
    this.channels.set(channelName, channel);
    return channel;
  }

  /**
   * Adds a listener for a specific event on a channel
   * @param channelName The channel name to listen on
   * @param eventType The event type to listen for
   * @param callback The callback function to call when the event is triggered
   * @returns A cleanup function to remove the listener
   */
  public listenForEvent<T>(channelName: string, eventType: string, callback: (payload: T) => void): () => void {
    if (!this.isServiceInitialized()) {
      logWithTimestamp('[SSTC] Cannot listen for event: WebSocket service not initialized', 'warn');
      return () => {};
    }

    if (!eventType) {
      logWithTimestamp('[SSTC] Cannot listen for undefined event type', 'error');
      return () => {};
    }

    // Get or create the channel
    const channel = this.getOrCreateChannel(channelName);
    
    // Increment reference count for this channel
    this.incrementChannelRefCount(channelName);
    
    // Log the listener setup
    logWithTimestamp(`[SSTC] Setting up listener for event: ${eventType} on channel: ${channelName}`, 'info');

    // Add the listener to the channel
    channel.on('broadcast', { event: eventType }, (payload) => {
      logWithTimestamp(`[SSTC] Received event: ${eventType} on channel: ${channelName}`, 'info');
      callback(payload as T);
    });
    
    // Return a function to remove this specific listener
    return () => {
      this.handleListenerRemoved(channelName, eventType, callback);
    };
  }

  /**
   * Properly handles removal of a specific listener
   * @param channelName Channel name where the listener was registered
   * @param eventType Event type the listener was registered for
   * @param callback Callback function registered
   */
  private handleListenerRemoved(channelName: string, eventType: string, callback: Function): void {
    logWithTimestamp(`[SSTC] Removing listener for event: ${eventType} on channel: ${channelName}`, 'info');
    
    const channel = this.channels.get(channelName);
    if (!channel) {
      logWithTimestamp(`[SSTC] No channel found for ${channelName} when removing listener`, 'warn');
      return;
    }
    
    try {
      // For Supabase RealtimeChannel, remove the specific event listener
      channel.on('broadcast', { event: eventType }, undefined); // This removes the listener for this event type
      logWithTimestamp(`[SSTC] Successfully removed listener for event '${eventType}' on channel '${channelName}'`, 'info');
    } catch (error) {
      logWithTimestamp(`[SSTC] Error removing listener: ${error}`, 'error');
    }
    
    // Decrement the reference count for this channel
    this.decrementChannelRefCount(channelName);
  }

  /**
   * Increments the reference count for a channel
   * @param channelName The channel name to increment the reference count for
   */
  private incrementChannelRefCount(channelName: string): void {
    const currentCount = this.channelRefCounts.get(channelName) || 0;
    this.channelRefCounts.set(channelName, currentCount + 1);
    logWithTimestamp(`[SSTC] Channel ${channelName} ref count increased to ${currentCount + 1}`, 'info');
  }

  /**
   * Decrements the reference count for a channel and cleans up if needed
   * @param channelName The channel name to decrement the reference count for
   */
  private decrementChannelRefCount(channelName: string): void {
    const currentCount = this.channelRefCounts.get(channelName) || 0;
    const newCount = Math.max(0, currentCount - 1);
    
    this.channelRefCounts.set(channelName, newCount);
    
    if (newCount <= 0) {
      // Reference count is 0, time to clean up this channel
      logWithTimestamp(`[SSTC] Channel ${channelName} ref count is 0. Unsubscribing and removing from channel maps`, 'info');
      
      const channel = this.channels.get(channelName);
      if (channel) {
        // Properly unsubscribe from the channel first
        channel.unsubscribe().then(() => {
          logWithTimestamp(`[SSTC] Successfully unsubscribed from channel ${channelName}`, 'info');
          
          // Finally remove from our local maps
          this.channels.delete(channelName);
          this.channelRefCounts.delete(channelName);
        }).catch(error => {
          logWithTimestamp(`[SSTC] Error unsubscribing from channel ${channelName}: ${error}`, 'error');
        });
      }
    } else {
      // Channel still has active listeners
      logWithTimestamp(`[SSTC] Channel ${channelName} ref count is now ${newCount}. Channel remains active`, 'info');
    }
  }

  /**
   * Clears the singleton instance, useful for testing or when the application needs to reset the connection.
   */
  public static clearInstance(): void {
    if (SingleSourceTrueConnections.instance) {
      SingleSourceTrueConnections.instance.disconnect();
      SingleSourceTrueConnections.instance = null;
      logWithTimestamp('[SSTC] Singleton instance cleared', 'info');
    } else {
      logWithTimestamp('[SSTC] No instance to clear', 'warn');
    }
  }
  
  /**
   * A helper function to set up number update listeners
   */
  public setupNumberUpdateListeners(
    sessionId: string | null | undefined,
    onNumberUpdate: (number: number, numbers: number[]) => void,
    onGameReset: () => void,
    instanceId: string
  ): () => void {
    if (!sessionId) {
      logWithTimestamp(`[${instanceId}] Cannot setup listeners: No session ID`, 'warn');
      return () => {};
    }

    logWithTimestamp(`[${instanceId}] Setting up number update listeners for session ${sessionId}`, 'info');
    
    // Set up connection to session if needed
    if (this.getCurrentSessionId() !== sessionId) {
      this.connect(sessionId);
    }

    if (!EVENT_TYPES || !EVENT_TYPES.NUMBER_CALLED || !EVENT_TYPES.GAME_RESET) {
      logWithTimestamp(`[${instanceId}] Missing required event types, skipping listener setup`, 'error');
      return () => {};
    }
    
    // Set up number called listener
    const numberCleanup = this.listenForEvent(
      CHANNEL_NAMES.GAME_UPDATES,
      EVENT_TYPES.NUMBER_CALLED,
      (data: any) => {
        // Check if the data is for our session
        if (data?.sessionId === sessionId) {
          logWithTimestamp(`[${instanceId}] Received number update for session ${sessionId}: ${data.number}`, 'info');
          onNumberUpdate(data.number, data.calledNumbers || []);
        }
      }
    );
    
    // Set up game reset listener
    const resetCleanup = this.listenForEvent(
      CHANNEL_NAMES.GAME_UPDATES,
      EVENT_TYPES.GAME_RESET,
      (data: any) => {
        // Check if the data is for our session
        if (data?.sessionId === sessionId) {
          logWithTimestamp(`[${instanceId}] Received game reset for session ${sessionId}`, 'info');
          onGameReset();
        }
      }
    );
    
    // Return combined cleanup function
    return () => {
      logWithTimestamp(`[${instanceId}] Cleaning up number update listeners`, 'info');
      numberCleanup();
      resetCleanup();
    };
  }

  /**
   * Broadcast a message to a channel with the given event type and payload
   */
  public broadcast<T>(channelName: string, eventType: string, payload: T): Promise<boolean> {
    if (!this.client) {
      logWithTimestamp('[SSTC] Cannot broadcast: WebSocket client not initialized', 'error');
      return Promise.resolve(false);
    }
    
    logWithTimestamp(`[SSTC] Broadcasting event ${eventType} to channel ${channelName}`, 'info');
    
    try {
      // Get the supabase client and broadcast to the channel
      return this.client
        .channel(channelName)
        .send({
          type: 'broadcast',
          event: eventType,
          payload
        })
        .then(() => {
          logWithTimestamp(`[SSTC] Successfully broadcast ${eventType} to ${channelName}`, 'info');
          return true;
        })
        .catch((error) => {
          logWithTimestamp(`[SSTC] Error broadcasting to ${channelName}: ${error}`, 'error');
          return false;
        });
    } catch (error) {
      logWithTimestamp(`[SSTC] Exception broadcasting to ${channelName}: ${error}`, 'error');
      return Promise.resolve(false);
    }
  }

  /**
   * Broadcast a number called event
   */
  public broadcastNumberCalled(sessionId: string, number: number, calledNumbers?: number[]): Promise<boolean> {
    if (!sessionId) {
      logWithTimestamp('[SSTC] Cannot broadcast number: No session ID provided', 'error');
      return Promise.resolve(false);
    }
    
    const payload = {
      sessionId,
      number,
      calledNumbers: calledNumbers || [number],
      timestamp: new Date().toISOString()
    };
    
    return this.broadcast(CHANNEL_NAMES.GAME_UPDATES, EVENT_TYPES.NUMBER_CALLED, payload);
  }
  
  /**
   * Track last ping time for heartbeat
   */
  private lastPing: Date | null = null;
  
  /**
   * Update last ping time
   */
  public updateLastPing(): void {
    this.lastPing = new Date();
  }
  
  /**
   * Get last ping time
   */
  public getLastPing(): Date | null {
    return this.lastPing;
  }
}

/**
 * Gets the singleton instance of the SingleSourceTrueConnections class.
 * This function is the main entry point for accessing the WebSocket connection manager.
 * @returns The singleton instance.
 */
export function getSingleSourceConnection(): SingleSourceTrueConnections {
  return SingleSourceTrueConnections.getInstance();
}

interface WebSocketService {
  getClient: () => SupabaseClient;
}
