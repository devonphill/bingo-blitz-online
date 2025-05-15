
import { supabase } from '@/integrations/supabase/client';
import { getWebSocketService, initializeWebSocketService, CHANNEL_NAMES, EVENT_TYPES, WEBSOCKET_STATUS } from '@/services/websocket';
import { logWithTimestamp } from './logUtils';
import { ConnectionState } from '@/constants/connectionConstants';
import { ConnectionListenerManager } from './connection/ConnectionListenerManager';
import { ConnectionHeartbeat } from './connection/ConnectionHeartbeat';
import { NumberCalledListener, SessionProgressListener, ConnectionStatusListener } from './connection/connectionTypes';

/**
 * Singleton manager for all WebSocket connections in the application
 * This is the ONLY place where WebSocket connections should be initialized
 */
export class SingleSourceTrueConnections {
  private static instance: SingleSourceTrueConnections;
  private initialized = false;
  private sessionId: string | null = null;
  private _isConnected: boolean = false;
  private _connectionState: ConnectionState = 'disconnected';
  private listenerManager = new ConnectionListenerManager();
  private heartbeat: ConnectionHeartbeat;
  
  // Track active channels by name
  private activeChannels: Map<string, any> = new Map();
  // Track channel statuses
  private channelStatuses: Map<string, string> = new Map();
  
  private constructor() {
    // Initialize WebSocket service with Supabase client
    initializeWebSocketService(supabase);
    
    // Initialize heartbeat with callbacks
    this.heartbeat = new ConnectionHeartbeat(
      // On connection change
      (connected: boolean) => {
        this._isConnected = connected;
        this._connectionState = connected ? 'connected' : 'disconnected';
        this.listenerManager.notifyConnectionListeners(connected);
      },
      // On reconnect needed
      () => this.reconnect()
    );
    
    this.initialized = true;
    logWithTimestamp('SingleSourceTrueConnections initialized', 'info');
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
   * Get the WebSocket service
   */
  public getWebSocketService() {
    return getWebSocketService();
  }
  
  /**
   * Initialize the connection with a session ID
   * @param sessionId Session ID to initialize with
   * @returns This instance for chaining
   */
  public init(sessionId: string): SingleSourceTrueConnections {
    this.sessionId = sessionId;
    this.heartbeat.setSessionId(sessionId);
    this.heartbeat.startHeartbeat();
    return this;
  }
  
  /**
   * Connect to a session
   * @param sessionId Session ID to connect to
   * @returns This instance for chaining
   */
  public connect(sessionId: string): SingleSourceTrueConnections {
    if (!this.initialized) {
      logWithTimestamp('Cannot connect: SingleSourceTrueConnections not initialized', 'error');
      return this;
    }
    
    // Update our session ID
    this.sessionId = sessionId;
    this.heartbeat.setSessionId(sessionId);
    
    // Start heartbeat
    this.heartbeat.startHeartbeat();
    
    try {
      this.getOrCreateChannel(CHANNEL_NAMES.GAME_UPDATES);
      
      logWithTimestamp(`Connected to session: ${sessionId}`, 'info');
    } catch (error) {
      logWithTimestamp(`Error connecting: ${error}`, 'error');
    }
    
    return this;
  }
  
  /**
   * Get an existing channel or create a new one if it doesn't exist
   * @param channelName The channel name to get or create
   * @returns The channel instance
   */
  private getOrCreateChannel(channelName: string): any {
    // Check if we already have an active channel with this name
    if (this.activeChannels.has(channelName)) {
      const channel = this.activeChannels.get(channelName);
      const status = this.channelStatuses.get(channelName);
      
      // If channel exists and is in good state (SUBSCRIBED, JOINED, CONNECTING), reuse it
      if (status === WEBSOCKET_STATUS.SUBSCRIBED || 
          status === WEBSOCKET_STATUS.JOINED || 
          status === WEBSOCKET_STATUS.JOINING || 
          status === WEBSOCKET_STATUS.CONNECTING) {
        logWithTimestamp(`Reusing existing ${channelName} channel with status: ${status}`, 'info');
        return channel;
      }
      
      // If channel exists but is in a bad state, clean it up before creating a new one
      logWithTimestamp(`Found existing ${channelName} channel but with bad status: ${status}, recreating`, 'warn');
      this.cleanupChannel(channelName);
    }
    
    // Create a new channel
    logWithTimestamp(`Creating new ${channelName} channel`, 'info');
    return this.createAndSetupNewChannel(channelName);
  }
  
  /**
   * Clean up an existing channel
   * @param channelName The channel name to clean up
   */
  private cleanupChannel(channelName: string): void {
    try {
      if (this.activeChannels.has(channelName)) {
        const channel = this.activeChannels.get(channelName);
        if (channel) {
          const webSocketService = getWebSocketService();
          webSocketService.leaveChannel(channelName);
          logWithTimestamp(`Cleaned up channel: ${channelName}`, 'info');
        }
        
        this.activeChannels.delete(channelName);
        this.channelStatuses.delete(channelName);
      }
    } catch (error) {
      logWithTimestamp(`Error cleaning up channel ${channelName}: ${error}`, 'warn');
    }
  }
  
  /**
   * Create a new channel and set it up with proper subscriptions
   * @param channelName The channel name to create
   * @returns The newly created channel
   */
  private createAndSetupNewChannel(channelName: string): any {
    const webSocketService = getWebSocketService();
    
    // Create a new channel
    const channel = webSocketService.createChannel(channelName);
    
    // Store the channel
    this.activeChannels.set(channelName, channel);
    this.channelStatuses.set(channelName, WEBSOCKET_STATUS.CONNECTING);
    
    // Subscribe with reconnect capability
    webSocketService.subscribeWithReconnect(channelName, (status) => {
      logWithTimestamp(`Channel ${channelName} status: ${status}`, 'info');
      
      // Update channel status
      this.channelStatuses.set(channelName, status);
      
      // Update connection state if this is the main game updates channel
      if (channelName === CHANNEL_NAMES.GAME_UPDATES) {
        const connected = status === WEBSOCKET_STATUS.SUBSCRIBED;
        this._isConnected = connected;
        this._connectionState = connected ? 'connected' : 'disconnected';
        this.listenerManager.notifyConnectionListeners(connected);
      }
      
      // If channel was successfully subscribed, set up default event listeners
      if (status === WEBSOCKET_STATUS.SUBSCRIBED && channelName === CHANNEL_NAMES.GAME_UPDATES) {
        this.setupDefaultEventListeners(channelName);
      }
    });
    
    return channel;
  }
  
  /**
   * Setup default event listeners for a channel
   * @param channelName The channel name to set up listeners for
   */
  private setupDefaultEventListeners(channelName: string): void {
    if (channelName !== CHANNEL_NAMES.GAME_UPDATES) return;
    
    const webSocketService = getWebSocketService();
    
    // Subscribe to number called events
    webSocketService.addListener(
      channelName,
      'broadcast',
      EVENT_TYPES.NUMBER_CALLED,
      (payload) => {
        if (payload && payload.payload) {
          const { number, sessionId, calledNumbers } = payload.payload;
          
          // Ensure this is for our session
          if (sessionId !== this.sessionId) return;
          
          // Notify listeners
          this.listenerManager.notifyNumberCalledListeners(number, calledNumbers || []);
        }
      }
    );
    
    // Subscribe to game reset events
    webSocketService.addListener(
      channelName,
      'broadcast',
      EVENT_TYPES.GAME_RESET,
      (payload) => {
        if (payload && payload.payload) {
          const { sessionId } = payload.payload;
          
          // Ensure this is for our session
          if (sessionId !== this.sessionId) return;
          
          // Notify listeners of reset with null number
          this.listenerManager.notifyNumberCalledListeners(null, []);
        }
      }
    );
    
    logWithTimestamp(`Setup default event listeners for channel ${channelName}`, 'info');
  }
  
  /**
   * Add a listener to a channel for a specific event
   * @param channelName The channel name to add the listener to
   * @param eventType The event type to listen for
   * @param callback The callback to call when the event is triggered
   * @returns Function to remove the listener
   */
  public addChannelListener<T>(
    channelName: string,
    eventType: string,
    callback: (data: T) => void
  ): () => void {
    if (!this.sessionId) {
      logWithTimestamp(`Cannot add channel listener: No session ID`, 'warn');
      return () => {};
    }
    
    try {
      // Get or create channel
      this.getOrCreateChannel(channelName);
      
      // Add listener using WebSocketService
      const webSocketService = getWebSocketService();
      
      logWithTimestamp(`Adding listener for event ${eventType} on channel ${channelName}`, 'info');
      
      // Add listener for the event
      const cleanup = webSocketService.addListener(
        channelName,
        'broadcast',
        eventType,
        (payloadWrapper: any) => {
          if (payloadWrapper && payloadWrapper.payload) {
            logWithTimestamp(`Received event ${eventType} on channel ${channelName}`, 'info');
            callback(payloadWrapper.payload as T);
          }
        }
      );
      
      return cleanup;
    } catch (error) {
      logWithTimestamp(`Error adding listener for event ${eventType} on channel ${channelName}: ${error}`, 'error');
      return () => {};
    }
  }
  
  /**
   * Check if a connection exists for a session
   * @param sessionId Session ID to check
   * @returns Whether connected to the session
   */
  public isConnectedToSession(sessionId: string): boolean {
    if (!this.initialized) return false;
    
    try {
      // Check if the GAME_UPDATES channel is in SUBSCRIBED state
      const status = this.channelStatuses.get(CHANNEL_NAMES.GAME_UPDATES);
      return status === WEBSOCKET_STATUS.SUBSCRIBED;
    } catch (error) {
      logWithTimestamp(`Error checking connection status: ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Register a number called listener
   * @param listener Function to call when a number is called
   * @returns Function to remove the listener
   */
  public onNumberCalled(listener: NumberCalledListener): () => void {
    return this.listenerManager.onNumberCalled(listener);
  }
  
  /**
   * Register a session progress update listener
   * @param listener Function to call when session progress is updated
   * @returns Function to remove the listener
   */
  public onSessionProgressUpdate(listener: SessionProgressListener): () => void {
    return this.listenerManager.onSessionProgressUpdate(listener);
  }
  
  /**
   * Register a connection status listener
   * @param listener Function to call when connection status changes
   * @returns Function to remove the listener
   */
  public addConnectionListener(listener: ConnectionStatusListener): () => void {
    return this.listenerManager.addConnectionListener(listener);
  }
  
  /**
   * Call a number
   * @param number Number to call
   * @param sessionId Session ID (optional)
   * @returns Promise resolving to whether the call was successful
   */
  public async callNumber(number: number, sessionId?: string): Promise<boolean> {
    try {
      const effectiveSessionId = sessionId || this.sessionId;
      
      if (!effectiveSessionId) {
        logWithTimestamp('Cannot call number: No session ID', 'error');
        return false;
      }
      
      const webSocketService = getWebSocketService();
      
      // Prepare the called numbers array with just the new number for now
      // Backend will handle combining with existing called numbers
      const payload = {
        number,
        sessionId: effectiveSessionId,
        timestamp: Date.now()
      };
      
      // Broadcast the number
      const success = await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.NUMBER_CALLED,
        payload
      );
      
      return success;
    } catch (error) {
      logWithTimestamp(`Error calling number: ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Broadcast a number called event
   * @param sessionId Session ID
   * @param number Number called
   * @param calledNumbers All called numbers
   * @returns Promise resolving to whether the broadcast was successful
   */
  public async broadcastNumberCalled(sessionId: string, number: number, calledNumbers: number[]): Promise<boolean> {
    if (!this.initialized || !sessionId) return false;
    
    try {
      const webSocketService = getWebSocketService();
      
      // Broadcast the number via WebSocket
      const success = await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.NUMBER_CALLED,
        {
          number,
          sessionId,
          calledNumbers,
          timestamp: Date.now()
        }
      );
      
      return success;
    } catch (error) {
      logWithTimestamp(`Error broadcasting number: ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Reconnect to the current session
   */
  public reconnect(): void {
    if (!this.sessionId) {
      logWithTimestamp(`Cannot reconnect: No session ID`, 'warn');
      return;
    }
    
    logWithTimestamp(`Reconnecting to session ${this.sessionId}`, 'info');
    
    // Clean up existing channels
    this.cleanupAllChannels();
    
    // Delay slightly before reconnecting to ensure proper cleanup
    setTimeout(() => {
      if (this.sessionId) {
        logWithTimestamp(`Setting up new connection after cleanup for session ${this.sessionId}`, 'info');
        this.getOrCreateChannel(CHANNEL_NAMES.GAME_UPDATES);
      }
    }, 500);
    
    // Reset heartbeat reconnect attempts
    this.heartbeat.resetReconnectAttempts();
  }
  
  /**
   * Clean up all channels
   */
  private cleanupAllChannels(): void {
    const webSocketService = getWebSocketService();
    
    // Clean up all channels
    for (const [channelName, channel] of this.activeChannels.entries()) {
      try {
        webSocketService.leaveChannel(channelName);
        logWithTimestamp(`Removed channel ${channelName}`, 'info');
      } catch (error) {
        logWithTimestamp(`Error removing channel ${channelName}: ${error}`, 'warn');
      }
    }
    
    // Clear all channel maps
    this.activeChannels.clear();
    this.channelStatuses.clear();
  }
  
  /**
   * Get the current connection state
   * @returns Current connection state
   */
  public getConnectionState(): ConnectionState {
    return this._connectionState;
  }
  
  /**
   * Get the last ping time
   * @returns Last ping timestamp or null
   */
  public getLastPing(): number | null {
    return this.heartbeat.getLastPing();
  }
  
  /**
   * Check if connected
   * @returns Whether currently connected
   */
  public isConnected(): boolean {
    return this._isConnected;
  }
  
  /**
   * Get the current session ID
   * @returns Current session ID or null
   */
  public getSessionId(): string | null {
    return this.sessionId;
  }
  
  /**
   * Set up number update listeners for a specific session
   * @param sessionId Session ID to listen for
   * @param onNumberUpdate Function to call when a number is updated
   * @param onGameReset Function to call when the game is reset
   * @param instanceId Unique instance identifier for logging
   * @returns Function to remove the listeners
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
    
    // Connect if not already connected
    if (this.sessionId !== sessionId) {
      this.connect(sessionId);
    }
    
    // Set up event listeners
    const numberListener = this.onNumberCalled((number, calledNumbers) => {
      if (number === null) {
        onGameReset();
      } else {
        onNumberUpdate(number, calledNumbers);
      }
    });
    
    return numberListener;
  }
  
  /**
   * Listen for a specific event on the GAME_UPDATES channel
   * @param eventType Event type to listen for
   * @param handler Handler function to call when the event is triggered
   * @returns Function to remove the listener
   */
  public listenForEvent<T>(
    eventType: string, 
    handler: (data: T) => void
  ): () => void {
    if (!this.sessionId) {
      logWithTimestamp(`Cannot listen for event: No session ID`, 'warn');
      return () => {};
    }
    
    return this.addChannelListener<T>(CHANNEL_NAMES.GAME_UPDATES, eventType, (data) => {
      // Special handling for claim validation events
      if (eventType === EVENT_TYPES.CLAIM_VALIDATING_TKT) {
        // For claim validation events, process them regardless of sessionId
        logWithTimestamp(`Processing claim validation event regardless of session match`, 'info');
        handler(data);
        return;
      }
      
      // For other events, check session matching
      if (!data.sessionId || data.sessionId === this.sessionId) {
        handler(data);
      } else {
        logWithTimestamp(`Event ${eventType} sessionId mismatch: ${data.sessionId} vs ${this.sessionId}`, 'debug');
      }
    });
  }
  
  /**
   * Export constants for consistent usage
   */
  public static CHANNEL_NAMES = CHANNEL_NAMES;
  public static EVENT_TYPES = EVENT_TYPES;
  public static WEBSOCKET_STATUS = WEBSOCKET_STATUS;
}

// Export a singleton instance getter
export const getSingleSourceConnection = () => SingleSourceTrueConnections.getInstance();

// Re-export needed types for convenience
export { CHANNEL_NAMES, EVENT_TYPES, WEBSOCKET_STATUS } from '@/services/websocket';
export type { ConnectionState } from '@/constants/connectionConstants';
export type { NumberCalledListener, SessionProgressListener, ConnectionStatusListener } from './connection/connectionTypes';
