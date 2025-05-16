
import { logWithTimestamp } from '@/utils/logUtils';
import { ConnectionState } from '@/constants/connectionConstants';
import { supabase } from '@/integrations/supabase/client';
import { CHANNEL_NAMES, EVENT_TYPES, CONNECTION_STATES } from '@/constants/websocketConstants';
import { RealtimeChannel } from '@supabase/supabase-js';

// Define WebSocketConnectionStatus type here since it's not exported from connectionConstants
export type WebSocketConnectionStatus = ConnectionState | 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CONNECTING' | 'JOINING' | 'JOINED' | 'unknown';

/**
 * Single Source of Truth for WebSocket connections
 * This class manages all WebSocket connections and channels
 * to ensure there's only one connection per session
 */
export class SingleSourceTrueConnections {
  private static instance: SingleSourceTrueConnections;
  
  // WebSocket service
  private webSocketService: any;
  private isServiceInitializedInternal: boolean = false;
  private connectionStatusInternal: WebSocketConnectionStatus = 'disconnected';
  private lastPingTime: Date | null = null;
  
  // Session tracking
  private currentSessionIdInternal: string | null = null;
  
  // Channel management
  private channels: Map<string, RealtimeChannel> = new Map();
  private channelRefCounts: Map<string, number> = new Map();
  
  // Listeners
  private connectionListeners: Array<(isConnected: boolean, connectionState: WebSocketConnectionStatus) => void> = [];
  private statusListeners: Set<(status: WebSocketConnectionStatus, isServiceInitialized: boolean) => void> = new Set();
  
  // Static event type constants (to avoid circular dependencies)
  static readonly EVENT_TYPES = {
    NUMBER_CALLED: 'number-called',
    GAME_STATE_UPDATE: 'game-state-changed',
    GAME_RESET: 'game-reset',
    CLAIM_SUBMITTED: 'claim-submitted',
    CLAIM_VALIDATION: 'claim-validation',
    CLAIM_VALIDATING_TKT: 'claim-validating-ticket',
    CLAIM_RESULT: 'claim-result',
    CLAIM_RESOLUTION: 'claim-resolution',
  };
  
  private constructor() {
    logWithTimestamp('[SSTC] SingleSourceTrueConnections created', 'info');
    this.initializeBaseWebServiceListeners();
  }
  
  /**
   * Get the singleton instance of SingleSourceTrueConnections
   */
  public static getInstance(): SingleSourceTrueConnections {
    if (!SingleSourceTrueConnections.instance) {
      SingleSourceTrueConnections.instance = new SingleSourceTrueConnections();
    }
    return SingleSourceTrueConnections.instance;
  }
  
  /**
   * Listen for browser online/offline events and initialize base listeners
   */
  private initializeBaseWebServiceListeners(): void {
    if (typeof window !== 'undefined') {
      // Listen for browser online/offline events
      window.addEventListener('offline', () => {
        logWithTimestamp('[SSTC] Browser offline event detected', 'info');
        this.connectionStatusInternal = 'disconnected';
        this.isServiceInitializedInternal = false;
        this.notifyConnectionListeners();
      });
      
      window.addEventListener('online', () => {
        logWithTimestamp('[SSTC] Browser online event detected', 'info');
        this.connectionStatusInternal = 'connecting';
        // Don't set service initialized here, let the service initialization check handle it
        this.notifyConnectionListeners();
        
        // Attempt reconnection if we have a session ID
        if (this.currentSessionIdInternal) {
          this.connect(this.currentSessionIdInternal);
        }
      });
      
      // Check if window is already offline
      if (!window.navigator.onLine) {
        logWithTimestamp('[SSTC] Browser reports offline status on initialization', 'warn');
        this.connectionStatusInternal = 'disconnected';
        this.isServiceInitializedInternal = false;
        this.notifyConnectionListeners();
      }
    }
    
    // Initialize WebSocket service on demand (lazy initialization)
    this.webSocketService = supabase.channel;
    this.isServiceInitializedInternal = !!this.webSocketService;
    
    logWithTimestamp(`[SSTC] WebSocket service initialized: ${this.isServiceInitializedInternal}`, 'info');
    
    window.addEventListener('storage', (event) => {
      if (event.key === 'websocket-connection-status') {
        try {
          const data = JSON.parse(event.newValue || '{}');
          if (data.status) {
            logWithTimestamp(`[SSTC] Storage event: WebSocket status changed to ${data.status}`, 'info');
            
            // Map external status to our internal states
            let newInternalStatus: WebSocketConnectionStatus;
            let newServiceReadyState = false;
            
            switch (data.status) {
              case 'SUBSCRIBED':
                newInternalStatus = 'connected';
                newServiceReadyState = true;
                break;
              case 'TIMED_OUT':
                newInternalStatus = 'error';
                newServiceReadyState = false;
                break;
              case 'CHANNEL_ERROR':
                newInternalStatus = 'error';
                newServiceReadyState = false;
                break;
              case 'CLOSED':
                newInternalStatus = 'disconnected';
                newServiceReadyState = false;
                break;
              case 'JOINING':
                newInternalStatus = 'connecting';
                newServiceReadyState = false;
                break;
              case 'JOINED':
                newInternalStatus = 'connected';
                newServiceReadyState = true;
                break;
              default:
                newInternalStatus = 'unknown';
                newServiceReadyState = false;
            }
            
            // Update internal state
            this.connectionStatusInternal = newInternalStatus;
            this.isServiceInitializedInternal = newServiceReadyState;
            
            // Notify listeners of change
            this.notifyConnectionListeners();
          }
        } catch (error) {
          console.error('[SSTC] Error processing storage event:', error);
        }
      }
    });
  }
  
  /**
   * Connect to a session
   * @param sessionId Session ID to connect to
   * @returns true if successfully initiated connection
   */
  public connect(sessionId: string): boolean {
    if (!sessionId) {
      logWithTimestamp('[SSTC] connect: No sessionId provided.', 'error');
      return false;
    }
    
    logWithTimestamp(`[SSTC] connect: Attempting to connect to session: ${sessionId}`, 'info');
    
    // Check if already connected to this session
    if (this.currentSessionIdInternal === sessionId && 
       (this.connectionStatusInternal === CONNECTION_STATES.CONNECTED || 
        this.connectionStatusInternal === CONNECTION_STATES.CONNECTING)) {
      logWithTimestamp(`[SSTC] connect: Already connected or connecting to session ${sessionId}.`, 'info');
      return true;
    }
    
    // If connected to a different session, disconnect first
    if (this.currentSessionIdInternal !== null && this.currentSessionIdInternal !== sessionId) {
      this.disconnect();
    }
    
    // Set the new session ID
    this.currentSessionIdInternal = sessionId;
    
    // Update connection status to connecting
    this.connectionStatusInternal = CONNECTION_STATES.CONNECTING;
    
    // Notify listeners about the status change
    this.notifyConnectionListeners();
    
    // If the service is initialized, we can consider ourselves connected
    if (this.isServiceInitializedInternal) {
      this.connectionStatusInternal = CONNECTION_STATES.CONNECTED;
      logWithTimestamp(`[SSTC] connect: Session ${sessionId} context established. Base WebSocket service was already initialized. State: ${this.connectionStatusInternal}.`, 'info');
    } else {
      logWithTimestamp(`[SSTC] connect: Session ${sessionId} context set. Base WebSocket service is not yet initialized. Current state: ${this.connectionStatusInternal}. Waiting for WebSocketService to open.`, 'info');
    }
    
    // Notify listeners again after potential state change
    this.notifyConnectionListeners();
    
    return true;
  }
  
  /**
   * Disconnect from the current session
   */
  public disconnect(): void {
    logWithTimestamp(`[SSTC] disconnect: Called for session: ${this.currentSessionIdInternal}`, 'info');
    
    // Clean up all session channels
    this.cleanupAllSessionChannels();
    
    // Clear the session ID
    this.currentSessionIdInternal = null;
    
    // Update connection status
    this.connectionStatusInternal = CONNECTION_STATES.DISCONNECTED;
    
    // Notify listeners
    this.notifyConnectionListeners();
  }
  
  /**
   * Clean up all session channels
   * This is a helper method for disconnect()
   */
  private cleanupAllSessionChannels(): void {
    logWithTimestamp('[SSTC] cleanupAllSessionChannels: Clearing local channel and ref count maps. Full channel removal will be tied to ref counting.', 'info');
    this.channels.clear();
    this.channelRefCounts.clear();
    // Note: This does NOT yet call removeChannel on the webSocketService for each channel.
    // That will be part of the reference counting logic when a channel's ref count hits 0.
  }
  
  /**
   * Get the current session ID
   * @returns The current session ID
   */
  public getCurrentSessionId(): string | null {
    return this.currentSessionIdInternal;
  }
  
  /**
   * Check if the service is initialized
   * @returns true if the service is initialized
   */
  public isServiceInitialized(): boolean {
    return this.isServiceInitializedInternal;
  }
  
  /**
   * Check if connected
   * @returns true if connected
   */
  public isConnected(): boolean {
    return this.connectionStatusInternal === CONNECTION_STATES.CONNECTED && this.isServiceInitializedInternal === true;
  }
  
  /**
   * Get connection status
   * @returns current connection status
   */
  public getConnectionStatus(): WebSocketConnectionStatus {
    return this.connectionStatusInternal;
  }
  
  /**
   * Get the current connection state
   * @returns current connection state
   */
  public getCurrentConnectionState(): WebSocketConnectionStatus {
    return this.connectionStatusInternal;
  }
  
  /**
   * Update the last ping time to now
   */
  public updateLastPing(): void {
    this.lastPingTime = new Date();
  }
  
  /**
   * Get the last ping time
   * @returns The last ping time or null if never pinged
   */
  public getLastPing(): Date | null {
    return this.lastPingTime;
  }
  
  /**
   * Get or create a channel
   * @param channelName Channel name
   * @returns The channel
   */
  private getOrCreateChannel(channelName: string): RealtimeChannel | null {
    if (!this.webSocketService) {
      logWithTimestamp('[SSTC] Cannot create channel: WebSocket service not initialized', 'error');
      return null;
    }
    
    if (this.channels.has(channelName)) {
      const existingChannel = this.channels.get(channelName)!;
      console.log(`[SSTC DEBUG] getOrCreateChannel: Found existing channel '${channelName}' with state: ${existingChannel.state}`);
      
      if (existingChannel.state === 'joined') {
        console.log(`[SSTC DEBUG] getOrCreateChannel: Reusing ALREADY JOINED channel '${channelName}'.`);
        return existingChannel;
      } else {
        console.log(`[SSTC DEBUG] Existing channel '${channelName}' is not 'joined' (state: ${existingChannel.state}). Will remove and recreate.`);
        try {
          supabase.removeChannel(existingChannel);
        } catch (e) {
          console.error('[SSTC] Error removing channel:', e);
        }
        this.channels.delete(channelName);
        this.channelRefCounts.delete(channelName);
      }
    }
    
    console.log(`[SSTC DEBUG] Creating NEW channel instance for: ${channelName}`);
    try {
      const newChannel = supabase.channel(channelName);
      this.channels.set(channelName, newChannel);
      this.channelRefCounts.set(channelName, 0); // Initialize ref count
      return newChannel;
    } catch (e) {
      console.error('[SSTC] Error creating channel:', e);
      return null;
    }
  }
  
  /**
   * Listen for an event
   * @param channelName Channel name
   * @param eventType Event type
   * @param handler Event handler
   * @returns Cleanup function
   */
  public listenForEvent<T = any>(channelName: string, eventType: string, callback: (payload: T) => void): () => void {
    if (!eventType) {
      logWithTimestamp(`[SSTC] listenForEvent: eventType is undefined for channel ${channelName}`, 'error');
      return () => {};
    }
    
    const channel = this.getOrCreateChannel(channelName);
    if (!channel) {
      logWithTimestamp(`[SSTC] listenForEvent: Could not get/create channel ${channelName}`, 'error');
      return () => {};
    }
    
    // Increment reference count
    const currentRefCount = (this.channelRefCounts.get(channelName) || 0) + 1;
    this.channelRefCounts.set(channelName, currentRefCount);
    logWithTimestamp(`[SSTC] listenForEvent: Ref count for ${channelName} is now ${currentRefCount}.`, 'info');
    
    if (currentRefCount === 1 && channel.state !== 'joined' && channel.state !== 'joining') {
      logWithTimestamp(`[SSTC] listenForEvent: First listener for ${channelName}, state is ${channel.state}. Subscribing channel.`, 'info');
      
      // Subscribe to the channel
      channel.subscribe((status: string, err: any) => {
        if (err) {
          logWithTimestamp(`[SSTC] Error subscribing to channel ${channelName}: ${JSON.stringify(err)}`, 'error');
        } else {
          logWithTimestamp(`[SSTC] Channel ${channelName} status: ${status}`, 'info');
          
          if (status === 'SUBSCRIBED') {
            logWithTimestamp(`[SSTC] Channel ${channelName} successfully SUBSCRIBED.`, 'info');
            
            // Update connection status if this is a primary channel
            if (channelName === 'game-updates') {
              this.connectionStatusInternal = 'connected';
              this.isServiceInitializedInternal = true;
              this.notifyConnectionListeners();
            }
          }
        }
      });
    }
    
    // Set up the listener
    logWithTimestamp(`[SSTC] Adding listener for event '${eventType}' on channel '${channelName}'.`, 'info');
    channel.on('broadcast', { event: eventType }, callback as any);
    
    // Return cleanup function
    return () => {
      logWithTimestamp(`[SSTC] Cleaning up listener for event '${eventType}' on channel '${channelName}'.`, 'info');
      try {
        // Use channel.unsubscribe method since .off doesn't exist
        channel.unsubscribe();
      } catch (e) {
        logWithTimestamp(`[SSTC] Error in channel unsubscribe for ${eventType} on ${channelName}: ${e}`, 'error');
      }
      this.decrementChannelRefCount(channelName);
    };
  }
  
  /**
   * Decrement channel reference count
   * @param channelName Channel name
   */
  private decrementChannelRefCount(channelName: string): void {
    const currentRefCount = this.channelRefCounts.get(channelName) || 0;
    const newRefCount = Math.max(0, currentRefCount - 1);
    
    logWithTimestamp(`[SSTC] decrementChannelRefCount: ${channelName} ref count: ${currentRefCount} -> ${newRefCount}`, 'info');
    
    if (newRefCount === 0) {
      // No more listeners for this channel, clean up
      const channel = this.channels.get(channelName);
      if (channel) {
        logWithTimestamp(`[SSTC] No more listeners for channel ${channelName}, removing channel`, 'info');
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.error('[SSTC] Error removing channel:', e);
        }
        this.channels.delete(channelName);
        this.channelRefCounts.delete(channelName);
      }
    } else {
      // Update ref count
      this.channelRefCounts.set(channelName, newRefCount);
    }
  }
  
  /**
   * Add a connection listener
   * @param listener Connection listener
   * @returns Cleanup function
   */
  public addConnectionListener(listener: (isConnected: boolean, connectionState: WebSocketConnectionStatus) => void): () => void {
    logWithTimestamp('[SSTC] Adding connection listener', 'info');
    this.connectionListeners.push(listener);
    
    // Call listener immediately with current state
    try {
      listener(this.isConnected(), this.connectionStatusInternal);
    } catch (e) {
      console.error('[SSTC] Error in connection listener:', e);
    }
    
    return () => {
      logWithTimestamp('[SSTC] Removing connection listener', 'info');
      const index = this.connectionListeners.indexOf(listener);
      if (index >= 0) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }
  
  /**
   * Add a status listener
   * @param listener Status listener
   * @returns Cleanup function
   */
  public addStatusListener(listener: (status: WebSocketConnectionStatus, isServiceInitialized: boolean) => void): () => void {
    this.statusListeners.add(listener);
    
    // Call listener immediately with current state
    try {
      listener(this.connectionStatusInternal, this.isServiceInitializedInternal);
    } catch (e) {
      console.error('[SSTC] Error in status listener:', e);
    }
    
    return () => {
      this.statusListeners.delete(listener);
    };
  }
  
  /**
   * Notify all status listeners of a status change
   */
  private notifyStatusListeners(): void {
    this.statusListeners.forEach(listener => {
      try {
        listener(this.connectionStatusInternal, this.isServiceInitializedInternal);
      } catch (e) {
        console.error('[SSTC] Error notifying status listener:', e);
      }
    });
    
    // Also notify connection listeners
    this.notifyConnectionListeners();
  }
  
  /**
   * Notify all connection listeners of a connection change
   */
  private notifyConnectionListeners(): void {
    logWithTimestamp(`[SSTC] Notifying ${this.connectionListeners.length} connection listeners. Status: ${this.connectionStatusInternal}, Connected: ${this.isConnected()}`, 'info');
    
    this.connectionListeners.forEach(listener => {
      try {
        listener(this.isConnected(), this.connectionStatusInternal);
      } catch (e) {
        console.error('[SSTC] Error notifying connection listener:', e);
      }
    });
  }
  
  /**
   * Setup number update listeners
   * @param sessionId Session ID
   * @param onNumberUpdate Called when a number is updated
   * @param onGameReset Called when the game is reset
   * @param instanceId Instance ID for logging
   * @returns Cleanup function
   */
  public setupNumberUpdateListeners(
    sessionId: string,
    onNumberUpdate: (number: number, numbers: number[]) => void,
    onGameReset: () => void,
    instanceId: string
  ): () => void {
    logWithTimestamp(`[${instanceId}] Setting up number update listeners for session ${sessionId}`, 'info');
    
    // Listen for number called events
    const numberCleanup = this.listenForEvent(
      'game-updates',
      SingleSourceTrueConnections.EVENT_TYPES.NUMBER_CALLED,
      (data: any) => {
        // Check if the data is for our session
        if (data?.sessionId === sessionId) {
          logWithTimestamp(`[${instanceId}] Received number update for session ${sessionId}: ${data.number}`, 'info');
          onNumberUpdate(data.number, data.calledNumbers || []);
        }
      }
    );
    
    // Listen for game reset events
    const resetCleanup = this.listenForEvent(
      'game-updates',
      SingleSourceTrueConnections.EVENT_TYPES.GAME_RESET,
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
      numberCleanup();
      resetCleanup();
    };
  }
  
  /**
   * Broadcast a message to a channel
   * @param channelName Channel name
   * @param eventType Event type
   * @param data Data to send
   * @returns Promise that resolves when the message is sent
   */
  public async broadcast(channelName: string, eventType: string, data: any): Promise<boolean> {
    if (!this.webSocketService) {
      logWithTimestamp('[SSTC] Cannot broadcast: WebSocket service not initialized', 'error');
      return false;
    }
    
    if (!eventType) {
      logWithTimestamp('[SSTC] Cannot broadcast: No event type specified', 'error');
      return false;
    }
    
    try {
      logWithTimestamp(`[SSTC] Broadcasting event '${eventType}' on channel '${channelName}'`, 'info');
      
      const channel = this.getOrCreateChannel(channelName);
      if (!channel) {
        logWithTimestamp(`[SSTC] Cannot broadcast: Failed to get channel ${channelName}`, 'error');
        return false;
      }
      
      // Ensure channel is subscribed
      if (channel.state !== 'joined') {
        logWithTimestamp(`[SSTC] Channel ${channelName} not joined, subscribing before broadcast`, 'info');
        
        // Subscribe to the channel and wait for it to be ready
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Timed out waiting for channel ${channelName} to subscribe`));
          }, 5000);
          
          channel.subscribe((status: string, err: any) => {
            if (err) {
              clearTimeout(timeout);
              reject(new Error(`Error subscribing to channel ${channelName}: ${JSON.stringify(err)}`));
            } else if (status === 'SUBSCRIBED') {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      }
      
      // Send the message - fixed typing issue here
      const result = await channel.send({
        type: 'broadcast',
        event: eventType,
        payload: data
      });
      
      logWithTimestamp(`[SSTC] Broadcast result for '${eventType}': ${JSON.stringify(result)}`, 'info');
      return true;
    } catch (error) {
      logWithTimestamp(`[SSTC] Error broadcasting event '${eventType}': ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Method to broadcast a number called event
   * @param sessionId Session ID
   * @param number Number called
   * @param calledNumbers All called numbers
   * @returns Promise resolving to success
   */
  public async broadcastNumberCalled(
    sessionId: string, 
    number: number, 
    calledNumbers: number[]
  ): Promise<boolean> {
    return this.broadcast(
      CHANNEL_NAMES.GAME_UPDATES,
      EVENT_TYPES.NUMBER_CALLED,
      { 
        sessionId, 
        number,
        calledNumbers
      }
    );
  }
  
  /**
   * Method to broadcast with retry
   * @param channelName Channel name
   * @param eventType Event type
   * @param data Data to send
   * @param maxRetries Maximum retries
   * @returns Promise resolving to success
   */
  public async broadcastWithRetry(
    channelName: string, 
    eventType: string, 
    data: any, 
    maxRetries: number = 3
  ): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      const success = await this.broadcast(channelName, eventType, data);
      if (success) return true;
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return false;
  }
  
  /**
   * Set up callback for when a number is called
   * @param callback Callback function
   * @returns Cleanup function
   */
  public onNumberCalled(
    callback: (number: number | null, calledNumbers: number[]) => void
  ): () => void {
    if (!this.currentSessionIdInternal) {
      logWithTimestamp('[SSTC] Cannot listen for number called events: No session ID set', 'warn');
      return () => {};
    }
    
    return this.listenForEvent(
      CHANNEL_NAMES.GAME_UPDATES,
      EVENT_TYPES.NUMBER_CALLED,
      (data: any) => {
        if (data && (data.sessionId === this.currentSessionIdInternal)) {
          callback(data.number, data.calledNumbers || []);
        }
      }
    );
  }
  
  /**
   * Call a number for a session
   * @param sessionId Session ID
   * @param number Number to call
   * @param calledNumbers All called numbers
   * @returns Promise resolving to success
   */
  public async callNumber(
    sessionId: string,
    number: number,
    calledNumbers: number[]
  ): Promise<boolean> {
    return this.broadcastNumberCalled(sessionId, number, calledNumbers);
  }
}

/**
 * Get the singleton instance of SingleSourceTrueConnections
 * @returns Singleton instance
 */
export function getSingleSourceConnection(): SingleSourceTrueConnections {
  return SingleSourceTrueConnections.getInstance();
}
