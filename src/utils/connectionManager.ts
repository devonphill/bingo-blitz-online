
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from './logUtils';
import { webSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';
import { ConnectionState } from '@/constants/connectionConstants';
import { ConnectionListenerManager } from './connectionListeners';
import { ConnectionHeartbeatManager } from './connectionHeartbeat';

/**
 * Connection manager class for reliable WebSocket connections
 */
class ConnectionManager {
  private sessionId: string | null = null;
  private _isConnected: boolean = false;
  private _connectionState: ConnectionState = 'disconnected';
  private listenerManager = new ConnectionListenerManager();
  private heartbeatManager: ConnectionHeartbeatManager;
  
  constructor() {
    // Initialize heartbeat manager with callbacks
    this.heartbeatManager = new ConnectionHeartbeatManager(
      // On connection change
      (connected: boolean) => {
        this._isConnected = connected;
        this._connectionState = connected ? 'connected' : 'disconnected';
        this.listenerManager.notifyConnectionListeners(connected);
      },
      // On reconnect needed
      () => this.reconnect()
    );
  }
  
  /**
   * Initialize the connection manager with a session ID
   */
  public init(sessionId: string) {
    if (this.sessionId === sessionId && this._isConnected) return this;
    
    logWithTimestamp(`ConnectionManager initialized with session ID: ${sessionId}`, 'info');
    
    this.cleanup(); // Clean up any existing connections
    this.sessionId = sessionId;
    this.heartbeatManager.setSessionId(sessionId);
    this.heartbeatManager.resetReconnectAttempts();
    
    // Setup the heartbeat
    this.heartbeatManager.startHeartbeat();
    
    return this;
  }

  /**
   * Connect to a session
   */
  public connect(sessionId: string) {
    if (this.sessionId === sessionId && this._isConnected) {
      logWithTimestamp(`Already connected to session: ${sessionId}`, 'info');
      return this;
    }
    
    this.init(sessionId);
    
    // Create and subscribe to game updates channel
    const channel = webSocketService.createChannel(CHANNEL_NAMES.GAME_UPDATES);
    webSocketService.subscribeWithReconnect(CHANNEL_NAMES.GAME_UPDATES, (status) => {
      this.updateConnectionState(status === 'SUBSCRIBED' ? 'connected' : 'connecting');
    });
    
    // Set up listener for number-called events
    webSocketService.addListener(
      CHANNEL_NAMES.GAME_UPDATES, 
      'broadcast', 
      EVENT_TYPES.NUMBER_CALLED, 
      (payload) => {
        if (payload && payload.payload && payload.payload.sessionId === this.sessionId) {
          const { number } = payload.payload;
          
          logWithTimestamp(`Received number update via WebSocket: ${number}`, 'info');
          
          // Pass to listeners
          this.listenerManager.notifyNumberCalledListeners(number, []);
        }
      }
    );
    
    logWithTimestamp(`Connection to session ${sessionId} initiated`, 'info');
    
    return this;
  }
  
  /**
   * Register a number called listener
   */
  public onNumberCalled(listener: (number: number | null, allNumbers: number[]) => void) {
    this.listenerManager.onNumberCalled(listener);
    return this;
  }
  
  /**
   * Register a session progress update listener
   */
  public onSessionProgressUpdate(listener: (progress: any) => void) {
    this.listenerManager.onSessionProgressUpdate(listener);
    return this;
  }
  
  /**
   * Register a listener for connection status changes
   */
  public addConnectionListener(listener: (connected: boolean) => void): () => void {
    const unsubscribe = this.listenerManager.addConnectionListener(listener);
    
    // Call immediately with current state
    listener(this._isConnected);
    
    return unsubscribe;
  }
  
  /**
   * Call a number and broadcast it to all clients
   */
  public async callNumber(number: number, sessionId?: string): Promise<boolean> {
    const currentSessionId = sessionId || this.sessionId;
    if (!currentSessionId) return false;
    
    try {
      logWithTimestamp(`Broadcasting number ${number} for session ${currentSessionId}`, 'info');
      
      // Broadcast the number via WebSocket
      const success = await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.NUMBER_CALLED,
        {
          number,
          sessionId: currentSessionId,
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
   * Force reconnect all connections
   */
  public reconnect(): void {
    logWithTimestamp('Forcing reconnection of all channels', 'info');
    
    // Reset reconnect attempts
    this.heartbeatManager.resetReconnectAttempts();
    
    // Reconnect game updates channel
    webSocketService.reconnectChannel(CHANNEL_NAMES.GAME_UPDATES);
    
    // Reset heartbeat
    this.heartbeatManager.startHeartbeat();
  }
  
  /**
   * Get the current connection state
   */
  public getConnectionState(): ConnectionState {
    return this._connectionState;
  }
  
  /**
   * Get the last ping time
   */
  public getLastPing(): number | null {
    return this.heartbeatManager.getLastPing();
  }
  
  /**
   * Check if currently connected
   */
  public isConnected(): boolean {
    return this._isConnected;
  }
  
  /**
   * Update the connection state
   */
  private updateConnectionState(state: ConnectionState): void {
    if (this._connectionState !== state) {
      this._connectionState = state;
      this._isConnected = state === 'connected';
      
      // Notify listeners
      this.listenerManager.notifyConnectionListeners(this._isConnected);
    }
  }
  
  /**
   * Clean up all connections and timers
   */
  private cleanup(): void {
    logWithTimestamp('Cleaning up connection manager', 'info');
    
    this.heartbeatManager.stopHeartbeat();
    this.sessionId = null;
    this._isConnected = false;
    this._connectionState = 'disconnected';
    
    // Notify listeners
    this.listenerManager.notifyConnectionListeners(false);
  }
}

// Export a singleton instance
export const connectionManager = new ConnectionManager();
