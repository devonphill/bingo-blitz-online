
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
      this.setupChannelSubscription(CHANNEL_NAMES.GAME_UPDATES);
      
      logWithTimestamp(`Connected to session: ${sessionId}`, 'info');
    } catch (error) {
      logWithTimestamp(`Error connecting: ${error}`, 'error');
    }
    
    return this;
  }
  
  /**
   * Setup a channel subscription with proper cleanup of existing subscriptions
   * @param channelName The channel name to subscribe to
   */
  private setupChannelSubscription(channelName: string): void {
    // Get WebSocketService
    const webSocketService = getWebSocketService();
    
    // First, properly clean up any existing channel to prevent multiple subscriptions
    try {
      webSocketService.leaveChannel(channelName);
      logWithTimestamp(`Cleaned up existing channel: ${channelName}`, 'info');
    } catch (cleanupError) {
      logWithTimestamp(`Error during channel cleanup: ${cleanupError}`, 'warn');
      // Continue with new subscription even if cleanup fails
    }
    
    // Create a new channel
    const channel = webSocketService.createChannel(channelName);
    
    // Subscribe with reconnect capability
    webSocketService.subscribeWithReconnect(channelName, (status) => {
      logWithTimestamp(`Game updates channel status: ${status}`, 'info');
      
      // Update connection state
      const connected = status === WEBSOCKET_STATUS.SUBSCRIBED;
      this._isConnected = connected;
      this._connectionState = connected ? 'connected' : 'disconnected';
      this.listenerManager.notifyConnectionListeners(connected);
    });
    
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
  }
  
  /**
   * Check if a connection exists for a session
   * @param sessionId Session ID to check
   * @returns Whether connected to the session
   */
  public isConnectedToSession(sessionId: string): boolean {
    if (!this.initialized) return false;
    
    try {
      const webSocketService = getWebSocketService();
      const channelName = `session-${sessionId}`;
      const status = webSocketService.getConnectionState(channelName);
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
    
    // Clean up existing connections first
    try {
      const webSocketService = getWebSocketService();
      webSocketService.leaveChannel(CHANNEL_NAMES.GAME_UPDATES);
      
      // Delay slightly before reconnecting to ensure proper cleanup
      setTimeout(() => {
        logWithTimestamp(`Setting up new connection after cleanup`, 'info');
        this.setupChannelSubscription(CHANNEL_NAMES.GAME_UPDATES);
      }, 500);
      
    } catch (error) {
      logWithTimestamp(`Error during reconnection cleanup: ${error}`, 'error');
      
      // Even if cleanup fails, try to establish a new connection
      this.setupChannelSubscription(CHANNEL_NAMES.GAME_UPDATES);
    }
    
    // Reset heartbeat reconnect attempts
    this.heartbeat.resetReconnectAttempts();
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
