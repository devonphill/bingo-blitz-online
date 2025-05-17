import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RealtimeChannel } from '@supabase/supabase-js';
import { logWithTimestamp } from './logUtils';
import { ConnectionState } from '@/constants/connectionConstants';
import { EVENT_TYPES } from '@/constants/websocketConstants';

interface WebSocketService {
  getClient: () => SupabaseClient;
  addChannel: (channel: RealtimeChannel) => void;
  removeChannel: (channel: RealtimeChannel) => void;
}

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
    // Initialization logic, if any
  }

  /**
   * Gets the singleton instance of the SingleSourceTrueConnections class.
   * @returns The singleton instance.
   */
  static getInstance(): SingleSourceTrueConnections {
    if (!SingleSourceTrueConnections.instance) {
      SingleSourceTrueConnections.instance = new SingleSourceTrueConnections();
    }
    return SingleSourceTrueConnections.instance;
  }

  /**
   * Initializes the WebSocket service with the Supabase URL and API key.
   * @param supabaseUrl The Supabase URL.
   * @param supabaseKey The Supabase API key.
   */
  initialize(supabaseUrl: string, supabaseKey: string): void {
    if (this.client) {
      logWithTimestamp('[SSTC] WebSocket service already initialized', 'warn');
      return;
    }

    try {
      this.client = createClient(supabaseUrl, supabaseKey);

      this.webSocketService = {
        getClient: () => this.client as SupabaseClient,
        addChannel: (channel: RealtimeChannel) => {
          // No need to track channels in the service itself
          logWithTimestamp(`[SSTC] Channel added: ${channel.topic}`, 'debug');
        },
        removeChannel: (channel: RealtimeChannel) => {
          // No need to track channels in the service itself
          logWithTimestamp(`[SSTC] Channel removed: ${channel.topic}`, 'debug');
        },
      };

      this.setConnectionState('initialized');
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
  isServiceInitialized(): boolean {
    return this.client !== null && this.webSocketService !== null && this.connectionState !== 'disconnected';
  }

  /**
   * Connects to a specific session using the provided session ID.
   * @param sessionId The ID of the session to connect to.
   */
  connect(sessionId: string): void {
    if (!this.isServiceInitialized()) {
      logWithTimestamp('[SSTC] Cannot connect: WebSocket service not initialized', 'warn');
      this.setConnectionState('not_initialized');
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
    this.notifyStatusListeners();
  }

  /**
   * Disconnects from the current session.
   */
  disconnect(): void {
    if (!this.currentSessionId) {
      logWithTimestamp('[SSTC] Not connected to any session', 'warn');
      return;
    }

    // Unsubscribe from all channels
    this.channels.forEach((channel, channelName) => {
      channel.unsubscribe().then(() => {
        logWithTimestamp(`[SSTC] Unsubscribed from channel ${channelName}`, 'info');
      }).catch(error => {
        logWithTimestamp(`[SSTC] Error unsubscribing from channel ${channelName}: ${error}`, 'error');
      });
      if (this.webSocketService) {
        this.webSocketService.removeChannel(channel);
      }
      this.channels.delete(channelName);
      this.channelRefCounts.delete(channelName);
    });
    this.channels.clear();
    this.channelRefCounts.clear();

    this.currentSessionId = null;
    this.setConnectionState('disconnected');
    logWithTimestamp('[SSTC] Disconnected from session', 'info');
    this.notifyConnectionListeners(false);
    this.notifyStatusListeners();
  }

  /**
   * Gets the current session ID.
   * @returns The current session ID, or null if not connected to any session.
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Gets the current connection state.
   * @returns The current connection state.
   */
  getCurrentConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Checks if the WebSocket is currently connected.
   * @returns True if the WebSocket is connected, false otherwise.
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Adds a listener for connection status changes.
   * @param listener The listener function to add.
   * @returns A function to remove the listener.
   */
  addConnectionListener(listener: (isConnected: boolean) => void): () => void {
    this.connectionListeners.push(listener);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
    };
  }

  /**
   * Adds a listener for service status changes.
   * @param listener The listener function to add.
   * @returns A function to remove the listener.
   */
  addStatusListener(listener: (status: ConnectionState, isServiceInitialized: boolean) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  /**
   * Notifies all connection listeners of a connection status change.
   * @param isConnected True if the WebSocket is connected, false otherwise.
   */
  private notifyConnectionListeners(isConnected: boolean): void {
    this.connectionListeners.forEach(listener => listener(isConnected));
  }

  /**
   * Notifies all status listeners of a service status change.
   */
  private notifyStatusListeners(): void {
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
   * Adds a listener for a specific event on a channel
   */
  listenForEvent<T>(channelName: string, eventType: string, callback: (payload: T) => void): () => void {
    if (!this.isServiceInitialized()) {
      console.error('[SSTC] Cannot listen for event: WebSocket service not initialized');
      return () => {};
    }

    if (!eventType) {
      console.error('[SSTC] Cannot listen for undefined event type');
      return () => {};
    }

    // Get or create the channel
    const channel = this.getOrCreateChannel(channelName);
    
    // Increment reference count for this channel
    this.incrementChannelRefCount(channelName);
    
    // Log the listener setup
    logWithTimestamp(`[SSTC] Setting up listener for event: ${eventType} on channel: ${channelName}`, 'info');

    // Add the listener to the channel
    channel.on('broadcast', { event: eventType }, (payload: T) => {
      logWithTimestamp(`[SSTC] Received event: ${eventType} on channel: ${channelName}`, 'info');
      callback(payload);
    });
    
    // Return a function to remove this specific listener
    return () => {
      this.handleListenerRemoved(channelName, eventType, callback);
    };
  }

  /**
   * Properly handles removal of a specific listener
   */
  private handleListenerRemoved(channelName: string, eventType: string, callback: Function): void {
    logWithTimestamp(`[SSTC] Removing listener for event: ${eventType} on channel: ${channelName}`, 'info');
    
    const channel = this.channels.get(channelName);
    if (!channel) {
      logWithTimestamp(`[SSTC] No channel found for ${channelName} when removing listener`, 'warn');
      return;
    }
    
    // Use the broadcast.off method to remove just this specific listener
    // Note: We need to use the underlying subscription object for proper removal
    try {
      // Use removeChannel with filter to remove just this specific event listener
      channel.unsubscribe(`broadcast:${eventType}`);
      logWithTimestamp(`[SSTC] Successfully removed listener for event '${eventType}' on channel '${channelName}'`, 'info');
    } catch (error) {
      logWithTimestamp(`[SSTC] Error removing listener: ${error}`, 'error');
    }
    
    // Decrement the reference count for this channel
    this.decrementChannelRefCount(channelName);
  }

  /**
   * Decrements the reference count for a channel and cleans up if needed
   */
  private decrementChannelRefCount(channelName: string): void {
    const currentCount = this.channelRefCounts.get(channelName) || 0;
    const newCount = Math.max(0, currentCount - 1);
    
    this.channelRefCounts.set(channelName, newCount);
    
    if (newCount <= 0) {
      // Reference count is 0, time to clean up this channel
      logWithTimestamp(`[SSTC] Channel ${channelName} ref count is 0. Unsubscribing and removing from Supabase and SSTC maps`, 'info');
      
      const channel = this.channels.get(channelName);
      if (channel) {
        // Properly unsubscribe from the channel first
        channel.unsubscribe().then(() => {
          // Then remove the channel from Supabase's tracking
          if (this.webSocketService) {
            this.webSocketService.removeChannel(channel);
          }
          
          // Finally remove from our local maps
          this.channels.delete(channelName);
          this.channelRefCounts.delete(channelName);
          
          logWithTimestamp(`[SSTC] Successfully removed channel ${channelName}`, 'info');
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
   * Increments the reference count for a channel
   */
  private incrementChannelRefCount(channelName: string): void {
    const currentCount = this.channelRefCounts.get(channelName) || 0;
    this.channelRefCounts.set(channelName, currentCount + 1);
    logWithTimestamp(`[SSTC] Channel ${channelName} ref count increased to ${currentCount + 1}`, 'info');
  }

  /**
   * Gets an existing channel or creates a new one
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
        if (this.webSocketService) {
          this.webSocketService.removeChannel(existingChannel);
        }
      } catch (error) {
        logWithTimestamp(`[SSTC] Error cleaning up old channel: ${error}`, 'error');
      }
    }
    
    // Create a new channel
    logWithTimestamp(`[SSTC] Creating new channel: ${channelName}`, 'info');
    const channel = this.webSocketService.getClient()
      .channel(channelName)
      .subscribe((status: string) => {
        logWithTimestamp(`[SSTC] Channel ${channelName} status: ${status}`, 'info');
      });
    
    // Store the new channel
    this.channels.set(channelName, channel);
    return channel;
  }

  /**
   * Clears the singleton instance, useful for testing or when the application needs to reset the connection.
   */
  static clearInstance(): void {
    if (SingleSourceTrueConnections.instance) {
      SingleSourceTrueConnections.instance.disconnect();
      SingleSourceTrueConnections.instance = null;
      logWithTimestamp('[SSTC] Singleton instance cleared', 'info');
    } else {
      logWithTimestamp('[SSTC] No instance to clear', 'warn');
    }
  }

  /**
   * Get the EVENT_TYPES constants
   */
  static get EVENT_TYPES() {
    return EVENT_TYPES;
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
