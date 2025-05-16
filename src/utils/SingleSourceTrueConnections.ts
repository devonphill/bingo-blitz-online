import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { RealtimeChannel } from '@supabase/supabase-js';
import { WebSocketService } from '@/services/websocket/WebSocketService';
import { 
  CHANNEL_NAMES,
  EVENT_TYPES,
  CONNECTION_STATES
} from '@/constants/websocketConstants';
import { WebSocketConnectionStatus } from '@/types/websocket';
import { ConnectionState } from '@/constants/connectionConstants';

/**
 * SingleSourceTrueConnections - A robust singleton manager for WebSocket connections
 * with reference counting to properly manage channel lifecycle
 */
export class SingleSourceTrueConnections {
  // Singleton instance
  private static instance: SingleSourceTrueConnections | null = null;
  
  // WebSocket service
  private webSocketService: WebSocketService;
  
  // Channel management
  private channels: Map<string, RealtimeChannel> = new Map();
  private channelListeners: Map<string, Map<string, Map<string, Function>>> = new Map(); // channelName -> eventName -> listenerId -> callback
  private channelRefCounts: Map<string, number> = new Map();
  
  // Session and connection state
  private currentSessionIdInternal: string | null = null;
  private connectionStatusInternal: WebSocketConnectionStatus = CONNECTION_STATES.DISCONNECTED;
  private isServiceInitializedInternal: boolean = false;
  private listenerIdCounter: number = 0; // For generating unique listener IDs
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.webSocketService = WebSocketService.getInstance(supabase);
    this.initializeBaseWebServiceListeners();
    logWithTimestamp('[SSTC] Singleton instance created and WebSocketService instantiated.', 'info');
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): SingleSourceTrueConnections {
    if (!SingleSourceTrueConnections.instance) {
      SingleSourceTrueConnections.instance = new SingleSourceTrueConnections();
    }
    return SingleSourceTrueConnections.instance;
  }
  
  /**
   * Check if service is initialized
   */
  public isServiceInitialized(): boolean {
    return this.isServiceInitializedInternal;
  }
  
  /**
   * Initialize base listeners for WebSocket service
   */
  private initializeBaseWebServiceListeners(): void {
    logWithTimestamp('[SSTC] Setting up base WebSocket service listeners.', 'info');
    
    // Since WebSocketService doesn't expose direct onOpen, onClose, onError methods,
    // we need to create a system channel for monitoring connection status
    const systemChannelName = 'system-connection-monitor';
    
    // Create a connection monitoring channel
    const channel = this.webSocketService.createChannel(systemChannelName);
    
    // Subscribe with a callback that handles different connection states
    this.webSocketService.subscribeWithReconnect(systemChannelName, (supabaseStatus) => {
      // Map Supabase status to our internal WebSocketConnectionStatus
      let newInternalStatus: WebSocketConnectionStatus = CONNECTION_STATES.UNKNOWN; // Default to unknown
      let newServiceReadyState = false;
      
      // Map Supabase status strings to our internal connection states
      switch (supabaseStatus) {
        case 'SUBSCRIBED':
          newInternalStatus = CONNECTION_STATES.CONNECTED;
          newServiceReadyState = true;
          logWithTimestamp(`[SSTC] WebSocket connection opened. Service initialized. State: ${newInternalStatus}`, 'info');
          break;
          
        case 'CLOSED':
          newInternalStatus = CONNECTION_STATES.DISCONNECTED;
          newServiceReadyState = false;
          logWithTimestamp(`[SSTC] WebSocket connection closed. Service not initialized. State: ${newInternalStatus}`, 'warn');
          break;
          
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
          newInternalStatus = CONNECTION_STATES.ERROR;
          newServiceReadyState = false;
          logWithTimestamp(`[SSTC] WebSocket connection error. State: ${newInternalStatus}. Status: ${supabaseStatus}`, 'error');
          break;
          
        case 'JOINING':
        case 'CONNECTING':
          newInternalStatus = CONNECTION_STATES.CONNECTING;
          newServiceReadyState = false;
          logWithTimestamp(`[SSTC] WebSocket connection in progress. State: ${newInternalStatus}. Status: ${supabaseStatus}`, 'info');
          break;
          
        default:
          // For any other unhandled statuses
          newInternalStatus = CONNECTION_STATES.UNKNOWN;
          newServiceReadyState = false;
          logWithTimestamp(`[SSTC] Unhandled WebSocket status: ${supabaseStatus}`, 'info');
          break;
      }
      
      // Update internal state with the mapped values
      this.connectionStatusInternal = newInternalStatus;
      this.isServiceInitializedInternal = newServiceReadyState;
      
      // TODO: this.notifyConnectionListeners(newServiceReadyState, newInternalStatus);
    });
    
    // Register for window online/offline events to handle network disconnections
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        // When browser comes online, set state to connecting as reconnection might be attempted
        this.connectionStatusInternal = CONNECTION_STATES.CONNECTING;
        logWithTimestamp('[SSTC] Browser online. Connection state set to: ' + this.connectionStatusInternal + 
          '. Attempting to reconnect if session was active.', 'info');
        // Will implement reconnection logic in a future step
      });
      
      window.addEventListener('offline', () => {
        this.isServiceInitializedInternal = false;
        this.connectionStatusInternal = CONNECTION_STATES.DISCONNECTED;
        logWithTimestamp('[SSTC] Browser offline. Connection state: ' + this.connectionStatusInternal, 'warn');
        // TODO: this.notifyConnectionListeners(false, this.connectionStatusInternal);
      });
    }
  }

  /**
   * Get or create a channel by name with reference counting
   * @param channelName The name of the channel to get or create
   * @returns The RealtimeChannel instance
   */
  private getOrCreateChannel(channelName: string): RealtimeChannel | null {
    if (this.channels.has(channelName)) {
      const existingChannel = this.channels.get(channelName)!;
      console.log(`[SSTC DEBUG] getOrCreateChannel: Found existing channel '${channelName}' with state: ${existingChannel.state}`);
      
      if (existingChannel.state === 'joined') {
        logWithTimestamp(`[SSTC DEBUG] getOrCreateChannel: Reusing ALREADY JOINED channel '${channelName}'.`, 'info');
        return existingChannel;
      } else {
        logWithTimestamp(`[SSTC DEBUG] Existing channel '${channelName}' is not 'joined' (state: ${existingChannel.state}). Will remove and recreate.`, 'warn');
        try {
          this.webSocketService.leaveChannel(channelName);
        } catch (e) {
          logWithTimestamp(`[SSTC] Error removing channel ${channelName}: ${e}`, 'error');
        }
        this.channels.delete(channelName);
        this.channelRefCounts.delete(channelName);
        // Continue to create a new channel
      }
    }

    try {
      logWithTimestamp(`[SSTC DEBUG] Creating NEW channel instance for: ${channelName}`, 'info');
      const newChannel = this.webSocketService.createChannel(channelName);
      this.channels.set(channelName, newChannel);
      this.channelRefCounts.set(channelName, 0); // Initialize ref count
      return newChannel;
    } catch (error) {
      logWithTimestamp(`[SSTC] Error creating channel ${channelName}: ${error}`, 'error');
      return null;
    }
  }

  /**
   * Listen for an event on a channel with reference counting
   * @param channelName The name of the channel to listen on
   * @param eventName The name of the event to listen for
   * @param callback The callback to call when the event is triggered
   * @returns A cleanup function to remove the listener
   */
  public listenForEvent<T = any>(
    channelName: string, 
    eventName: string, 
    callback: (payload: T) => void
  ): () => void {
    if (!eventName) {
      logWithTimestamp(`[SSTC] listenForEvent: eventName is undefined for channel ${channelName}`, 'error');
      return () => {};
    }

    // Get or create the channel
    const channel = this.getOrCreateChannel(channelName);
    if (!channel) {
      logWithTimestamp(`[SSTC] listenForEvent: Could not get/create channel ${channelName}`, 'error');
      return () => {};
    }

    // Increment reference count
    const currentRefCount = (this.channelRefCounts.get(channelName) || 0) + 1;
    this.channelRefCounts.set(channelName, currentRefCount);
    logWithTimestamp(`[SSTC] listenForEvent: Ref count for ${channelName} is now ${currentRefCount}.`, 'info');

    // If this is the first listener and the channel is not already joined or joining, subscribe
    if (currentRefCount === 1 && channel.state !== 'joined' && channel.state !== 'joining') {
      logWithTimestamp(`[SSTC] listenForEvent: First listener for ${channelName}, state is ${channel.state}. Subscribing channel.`, 'info');
      
      channel.subscribe((status, err) => {
        if (err) {
          logWithTimestamp(`[SSTC] Channel ${channelName} error: ${err.message}`, 'error');
        } else {
          logWithTimestamp(`[SSTC] Channel ${channelName} status: ${status}`, 'info');
          if (status === 'SUBSCRIBED') {
            logWithTimestamp(`[SSTC] Channel ${channelName} successfully SUBSCRIBED.`, 'info');
          }
        }
      });
    }

    // Attach the event listener
    channel.on('broadcast', { event: eventName }, (payload) => {
      try {
        callback(payload.payload as T);
      } catch (error) {
        logWithTimestamp(`[SSTC] Error in event callback for ${eventName} on ${channelName}: ${error}`, 'error');
      }
    });

    logWithTimestamp(`[SSTC] Listener added for event '${eventName}' on channel '${channelName}'.`, 'info');

    // Return cleanup function
    return () => {
      logWithTimestamp(`[SSTC] Cleaning up listener for event '${eventName}' on channel '${channelName}'.`, 'info');
      try {
        if (channel && typeof channel.off === 'function') {
          channel.off('broadcast', { event: eventName });
        }
      } catch (e) {
        logWithTimestamp(`[SSTC] Error in channel.off for ${eventName} on ${channelName}: ${e}`, 'error');
      }
      this.decrementChannelRefCount(channelName);
    };
  }

  /**
   * Decrement the reference count for a channel and clean up if no more listeners
   * @param channelName The name of the channel to decrement the reference count for
   */
  private decrementChannelRefCount(channelName: string): void {
    const currentRefCount = this.channelRefCounts.get(channelName) || 0;
    
    if (currentRefCount <= 1) {
      // This was the last reference, clean up the channel
      logWithTimestamp(`[SSTC] decrementChannelRefCount: Removing last reference to channel ${channelName}`, 'info');
      
      const channel = this.channels.get(channelName);
      if (channel) {
        try {
          logWithTimestamp(`[SSTC] Leaving channel ${channelName} due to zero references`, 'info');
          this.webSocketService.leaveChannel(channelName);
        } catch (error) {
          logWithTimestamp(`[SSTC] Error leaving channel ${channelName}: ${error}`, 'error');
        }
      }
      
      this.channels.delete(channelName);
      this.channelRefCounts.delete(channelName);
    } else {
      // Decrement the reference count
      this.channelRefCounts.set(channelName, currentRefCount - 1);
      logWithTimestamp(`[SSTC] decrementChannelRefCount: Ref count for ${channelName} is now ${currentRefCount - 1}`, 'info');
    }
  }
  
  public connect(sessionId: string): void {
    if (this.currentSessionIdInternal === sessionId) {
      logWithTimestamp(`[SSTC] Already connected to session ${sessionId}`, 'info');
      return;
    }
    
    this.currentSessionIdInternal = sessionId;
    logWithTimestamp(`[SSTC] Connected to session ${sessionId}`, 'info');
  }
  
  public isConnected(): boolean {
    return this.connectionStatusInternal === CONNECTION_STATES.CONNECTED;
  }
  
  public getConnectionState(): ConnectionState {
    return this.connectionStatusInternal as ConnectionState;
  }
  
  public getLastPing(): number | null {
    return Date.now();
  }
  
  public reconnect(): void {
    logWithTimestamp('[SSTC] Stub: Reconnect called', 'info');
  }
  
  public addConnectionListener(listener: (isConnected: boolean) => void): () => void {
    logWithTimestamp('[SSTC] Stub: Add connection listener', 'info');
    return () => {};
  }
  
  public static get EVENT_TYPES() {
    return EVENT_TYPES;
  }
}

/**
 * Helper function to get the singleton instance
 */
export const getSingleSourceConnection = (): SingleSourceTrueConnections => {
  return SingleSourceTrueConnections.getInstance();
};

// Export isServiceInitialized for backward compatibility
export function isServiceInitialized() {
  return getSingleSourceConnection().isServiceInitialized();
}
