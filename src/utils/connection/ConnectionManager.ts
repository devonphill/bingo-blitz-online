
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '../logUtils';
import { getWebSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';
import { ConnectionState } from '@/constants/connectionConstants';
import { ConnectionListenerManager } from './ConnectionListenerManager';
import { ConnectionHeartbeat } from './ConnectionHeartbeat';
import { ConnectionService, NumberCalledListener, SessionProgressListener } from './connectionTypes';

/**
 * Connection manager class for reliable WebSocket connections
 */
class ConnectionManager implements ConnectionService {
  private sessionId: string | null = null;
  private _isConnected: boolean = false;
  private _connectionState: ConnectionState = 'disconnected';
  private listenerManager = new ConnectionListenerManager();
  private heartbeat: ConnectionHeartbeat;
  
  constructor() {
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
  }
  
  /**
   * Initialize the connection with a session ID
   */
  public init(sessionId: string): ConnectionService {
    this.sessionId = sessionId;
    this.heartbeat.setSessionId(sessionId);
    this.heartbeat.startHeartbeat();
    return this;
  }
  
  /**
   * Connect to a session
   */
  public connect(sessionId: string): ConnectionService {
    // Update our session ID
    this.sessionId = sessionId;
    this.heartbeat.setSessionId(sessionId);
    
    // Start heartbeat
    this.heartbeat.startHeartbeat();
    
    // Get WebSocketService instead of using webSocketService directly
    const webSocketService = getWebSocketService();
    
    try {
      // Create and subscribe to channels
      const gameChannel = webSocketService.createChannel(CHANNEL_NAMES.GAME_UPDATES);
      
      // Subscribe with reconnect capability
      webSocketService.subscribeWithReconnect(CHANNEL_NAMES.GAME_UPDATES, (status) => {
        logWithTimestamp(`Game updates channel status: ${status}`, 'info');
        
        // Update connection state
        const connected = status === 'SUBSCRIBED';
        this._isConnected = connected;
        this._connectionState = connected ? 'connected' : 'disconnected';
        this.listenerManager.notifyConnectionListeners(connected);
      });
      
      // Subscribe to number called events
      webSocketService.addListener(
        CHANNEL_NAMES.GAME_UPDATES,
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
        CHANNEL_NAMES.GAME_UPDATES,
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
    } catch (error) {
      logWithTimestamp(`Error connecting: ${error}`, 'error');
    }
    
    return this;
  }
  
  /**
   * Register a number called listener
   */
  public onNumberCalled(listener: NumberCalledListener): ConnectionService {
    this.listenerManager.onNumberCalled(listener);
    return this;
  }
  
  /**
   * Register a session progress update listener
   */
  public onSessionProgressUpdate(listener: SessionProgressListener): ConnectionService {
    this.listenerManager.onSessionProgressUpdate(listener);
    return this;
  }
  
  /**
   * Register a connection status listener
   */
  public addConnectionListener(listener: (connected: boolean) => void): () => void {
    return this.listenerManager.addConnectionListener(listener);
  }
  
  /**
   * Call a number
   */
  public async callNumber(number: number, sessionId?: string): Promise<boolean> {
    try {
      const effectiveSessionId = sessionId || this.sessionId;
      
      if (!effectiveSessionId) {
        logWithTimestamp('Cannot call number: No session ID', 'error');
        return false;
      }
      
      // Get WebSocketService instead of using webSocketService directly
      const webSocketService = getWebSocketService();
      
      // Broadcast the number
      const success = await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.NUMBER_CALLED,
        {
          number,
          sessionId: effectiveSessionId,
          timestamp: Date.now()
        }
      );
      
      return success;
    } catch (error) {
      logWithTimestamp(`Error calling number: ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Reconnect to the current session
   */
  public reconnect(): void {
    if (!this.sessionId) return;
    
    logWithTimestamp(`Reconnecting to session ${this.sessionId}`, 'info');
    
    // Get WebSocketService instead of using webSocketService directly
    const webSocketService = getWebSocketService();
    
    // Reconnect the channel
    webSocketService.reconnectChannel(CHANNEL_NAMES.GAME_UPDATES);
    
    // Reset heartbeat reconnect attempts
    this.heartbeat.resetReconnectAttempts();
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
    return this.heartbeat.getLastPing();
  }
  
  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this._isConnected;
  }
}

// Export a singleton instance
export const connectionManager = new ConnectionManager();
