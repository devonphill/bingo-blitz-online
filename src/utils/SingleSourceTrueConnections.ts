
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
import { NumberCalledPayload } from '@/types/websocket';

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
  private connectionListeners: Set<(isConnected: boolean) => void> = new Set();
  private numberCalledListeners: Set<(number: number, allNumbers: number[]) => void> = new Set();
  
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
      
      // Notify all connection listeners
      this.notifyConnectionListeners(newServiceReadyState, newInternalStatus);
    });
    
    // Register for window online/offline events to handle network disconnections
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        // When browser comes online, set state to connecting as reconnection might be attempted
        this.connectionStatusInternal = CONNECTION_STATES.CONNECTING;
        logWithTimestamp('[SSTC] Browser online. Connection state set to: ' + this.connectionStatusInternal + 
          '. Attempting to reconnect if session was active.', 'info');
        this.reconnect();
      });
      
      window.addEventListener('offline', () => {
        this.isServiceInitializedInternal = false;
        this.connectionStatusInternal = CONNECTION_STATES.DISCONNECTED;
        logWithTimestamp('[SSTC] Browser offline. Connection state: ' + this.connectionStatusInternal, 'warn');
        this.notifyConnectionListeners(false, this.connectionStatusInternal);
      });
    }
  }

  /**
   * Notify all connection listeners
   */
  private notifyConnectionListeners(isConnected: boolean, connectionState: WebSocketConnectionStatus): void {
    logWithTimestamp(`[SSTC] Notifying ${this.connectionListeners.size} connection listeners: connected=${isConnected}`, 'debug');
    
    // Notify all registered connection listeners
    this.connectionListeners.forEach(listener => {
      try {
        listener(isConnected);
      } catch (error) {
        logWithTimestamp(`[SSTC] Error in connection listener: ${error}`, 'error');
      }
    });
  }

  /**
   * Get or create a channel by name with reference counting
   * @param channelName The name of the channel to get or create
   * @returns The RealtimeChannel instance or null if creation failed
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
        if (channel && channel.state !== 'closed') {
          channel.unsubscribe(`broadcast:${eventName}`);
        }
      } catch (e) {
        logWithTimestamp(`[SSTC] Error in channel unsubscribe for ${eventName} on ${channelName}: ${e}`, 'error');
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
  
  /**
   * Connect to a session
   * @param sessionId The session ID to connect to
   */
  public connect(sessionId: string): void {
    if (this.currentSessionIdInternal === sessionId) {
      logWithTimestamp(`[SSTC] Already connected to session ${sessionId}`, 'info');
      return;
    }
    
    this.currentSessionIdInternal = sessionId;
    logWithTimestamp(`[SSTC] Connected to session ${sessionId}`, 'info');
  }
  
  /**
   * Check if connected
   * @returns True if connected, false otherwise
   */
  public isConnected(): boolean {
    return this.connectionStatusInternal === CONNECTION_STATES.CONNECTED;
  }
  
  /**
   * Get the connection state
   * @returns The connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionStatusInternal as ConnectionState;
  }
  
  /**
   * Get the last ping time
   * @returns The last ping time or null if none
   */
  public getLastPing(): number | null {
    return Date.now(); // Placeholder for actual implementation
  }
  
  /**
   * Attempt to reconnect
   */
  public reconnect(): void {
    logWithTimestamp('[SSTC] Attempting to reconnect WebSocket connections', 'info');
    
    // Verify that we have an active session ID
    if (!this.currentSessionIdInternal) {
      logWithTimestamp('[SSTC] Cannot reconnect: No session ID', 'warn');
      return;
    }
    
    // Signal that we're in connecting state
    this.connectionStatusInternal = CONNECTION_STATES.CONNECTING;
    this.notifyConnectionListeners(false, CONNECTION_STATES.CONNECTING);
    
    // Iterate through all active channels and attempt to reconnect
    for (const [channelName, channel] of this.channels.entries()) {
      try {
        if (channel.state !== 'joined' && channel.state !== 'joining') {
          logWithTimestamp(`[SSTC] Reconnecting channel: ${channelName}`, 'info');
          
          // Re-subscribe to the channel
          channel.subscribe((status, err) => {
            if (err) {
              logWithTimestamp(`[SSTC] Reconnection error for channel ${channelName}: ${err.message}`, 'error');
            } else {
              logWithTimestamp(`[SSTC] Reconnection status for channel ${channelName}: ${status}`, 'info');
            }
          });
        }
      } catch (error) {
        logWithTimestamp(`[SSTC] Error reconnecting channel ${channelName}: ${error}`, 'error');
      }
    }
  }
  
  /**
   * Add a connection listener
   * @param listener The listener to add
   * @returns A function to remove the listener
   */
  public addConnectionListener(listener: (isConnected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    
    // Immediately call with current state
    try {
      listener(this.isConnected());
    } catch (error) {
      logWithTimestamp(`[SSTC] Error in connection listener: ${error}`, 'error');
    }
    
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  /**
   * Add a number called listener
   * @param handler The handler to call when a number is called
   * @returns A function to remove the listener
   */
  public onNumberCalled(handler: (number: number, allNumbers: number[]) => void): () => void {
    this.numberCalledListeners.add(handler);
    return () => {
      this.numberCalledListeners.delete(handler);
    };
  }

  /**
   * Call a number for a session
   * @param number The number to call
   * @param sessionId The session ID to call the number for
   * @returns A promise that resolves to true if the number was called successfully
   */
  public async callNumber(number: number, sessionId?: string): Promise<boolean> {
    try {
      const sid = sessionId || this.currentSessionIdInternal;
      
      if (!sid) {
        logWithTimestamp('[SSTC] Cannot call number: No session ID', 'error');
        return false;
      }
      
      // Here you would typically send a request to the server to call the number
      // For now we'll just broadcast the event directly
      return this.broadcastNumberCalled(number, sid);
    } catch (error) {
      logWithTimestamp(`[SSTC] Error calling number: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Broadcast a number called event
   * @param number The number that was called
   * @param sessionId The session ID the number was called for
   * @returns True if the broadcast was successful
   */
  public broadcastNumberCalled(number: number, sessionId: string): boolean {
    try {
      const payload: NumberCalledPayload = {
        number,
        sessionId,
        timestamp: Date.now(),
        broadcastId: `num-${number}-${Date.now()}`
      };
      
      // Use the broadcast service to send the number
      return this.broadcastWithRetry(CHANNEL_NAMES.GAME_UPDATES, EVENT_TYPES.NUMBER_CALLED, payload);
    } catch (error) {
      logWithTimestamp(`[SSTC] Error broadcasting number called: ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Broadcast an event with retry
   * @param channel The channel to broadcast on
   * @param eventType The event type to broadcast
   * @param payload The payload to broadcast
   * @returns True if the broadcast was successful
   */
  public broadcastWithRetry(channel: string, eventType: string, payload: any): boolean {
    try {
      // Use the WebSocket service to broadcast the event
      return this.webSocketService.broadcast(channel, eventType, payload);
    } catch (error) {
      logWithTimestamp(`[SSTC] Error broadcasting event: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Submit a bingo claim
   * @param ticket The ticket to claim
   * @param playerCode The player code
   * @param sessionId The session ID
   * @returns True if the claim was submitted successfully
   */
  public submitBingoClaim(ticket: any, playerCode: string, sessionId: string): boolean {
    try {
      if (!ticket || !playerCode || !sessionId) {
        logWithTimestamp('[SSTC] Cannot submit claim: Missing ticket, player code, or session ID', 'error');
        return false;
      }
      
      const payload = {
        ticket,
        playerCode,
        sessionId,
        timestamp: Date.now(),
        claimId: `claim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      // Broadcast the claim
      return this.broadcastWithRetry(CHANNEL_NAMES.CLAIM_UPDATES, EVENT_TYPES.CLAIM_SUBMITTED, payload);
    } catch (error) {
      logWithTimestamp(`[SSTC] Error submitting bingo claim: ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Set up number update listeners
   * @param sessionId The session ID to listen for
   * @param onNumberUpdate The callback to call when a number is updated
   * @param onGameReset The callback to call when the game is reset
   * @param instanceId The instance ID for logging
   * @returns A cleanup function
   */
  public setupNumberUpdateListeners(
    sessionId: string,
    onNumberUpdate: (number: number, numbers: number[]) => void,
    onGameReset: () => void,
    instanceId: string
  ): () => void {
    if (!sessionId) {
      logWithTimestamp(`[${instanceId}] Cannot setup listeners: No session ID`, 'warn');
      return () => {};
    }
    
    const handlers: Array<() => void> = [];
    
    // Listen for number called events
    const numberHandler = this.listenForEvent(
      CHANNEL_NAMES.GAME_UPDATES, 
      EVENT_TYPES.NUMBER_CALLED,
      (data: any) => {
        if (data?.sessionId === sessionId && data?.number !== undefined) {
          const number = parseInt(data.number);
          const numbers = Array.isArray(data.calledNumbers) ? data.calledNumbers : [];
          onNumberUpdate(number, numbers);
        }
      }
    );
    handlers.push(numberHandler);
    
    // Listen for game reset events
    const resetHandler = this.listenForEvent(
      CHANNEL_NAMES.GAME_UPDATES,
      EVENT_TYPES.GAME_RESET,
      (data: any) => {
        if (data?.sessionId === sessionId) {
          onGameReset();
        }
      }
    );
    handlers.push(resetHandler);
    
    // Return a combined cleanup function
    return () => {
      handlers.forEach(handler => handler());
    };
  }

  /**
   * Set event types for access from outside
   */
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
