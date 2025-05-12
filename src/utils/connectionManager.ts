
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from './logUtils';
import { webSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/WebSocketService';

// Time constants
const CONNECTION_TIMEOUT = 10000; // 10 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const RECONNECT_BASE_DELAY = 1000; // 1 second base delay

// Export the ConnectionState type for use in other components
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error' | 'unknown';

/**
 * Connection manager class for reliable WebSocket connections
 */
class ConnectionManager {
  private sessionId: string | null = null;
  private _isConnected: boolean = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionListeners: Set<(connected: boolean) => void> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private lastPingTime: number | null = null;
  private _connectionState: ConnectionState = 'disconnected';
  
  /**
   * Initialize the connection manager with a session ID
   */
  public init(sessionId: string): void {
    if (this.sessionId === sessionId && this._isConnected) return;
    
    logWithTimestamp(`ConnectionManager initialized with session ID: ${sessionId}`, 'info');
    
    this.cleanup(); // Clean up any existing connections
    this.sessionId = sessionId;
    this.reconnectAttempts = 0;
    
    // Setup the heartbeat
    this.startHeartbeat();
  }

  /**
   * Connect to a session
   */
  public connect(sessionId: string): void {
    if (this.sessionId === sessionId && this._isConnected) {
      logWithTimestamp(`Already connected to session: ${sessionId}`, 'info');
      return;
    }
    
    this.init(sessionId);
    
    // Create and subscribe to game updates channel
    const channel = webSocketService.createChannel(CHANNEL_NAMES.GAME_UPDATES);
    webSocketService.subscribeWithReconnect(CHANNEL_NAMES.GAME_UPDATES, (status) => {
      this.updateConnectionState(status === 'SUBSCRIBED' ? 'connected' : 'connecting');
    });
    
    logWithTimestamp(`Connection to session ${sessionId} initiated`, 'info');
  }
  
  /**
   * Register a listener for connection status changes
   */
  public addConnectionListener(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    
    // Call immediately with current state
    listener(this._isConnected);
    
    // Return the unsubscribe function
    return () => {
      this.connectionListeners.delete(listener);
    };
  }
  
  /**
   * Call a number and broadcast it to all clients
   */
  public async callNumber(number: number, sessionId?: string): Promise<boolean> {
    const currentSessionId = sessionId || this.sessionId;
    if (!currentSessionId) return false;
    
    try {
      logWithTimestamp(`Broadcasting number ${number} for session ${currentSessionId}`, 'info');
      
      // Update last ping time
      this.lastPingTime = Date.now();
      
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
    this.reconnectAttempts = 0;
    
    // Reconnect game updates channel
    webSocketService.reconnectChannel(CHANNEL_NAMES.GAME_UPDATES);
    
    // Reset heartbeat
    this.startHeartbeat();
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
    return this.lastPingTime;
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
      this.notifyListeners(this._isConnected);
    }
  }
  
  /**
   * Clean up all connections and timers
   */
  private cleanup(): void {
    logWithTimestamp('Cleaning up connection manager', 'info');
    
    this.stopHeartbeat();
    this.sessionId = null;
    this._isConnected = false;
    this._connectionState = 'disconnected';
    
    // Notify listeners
    this.notifyListeners(false);
  }
  
  /**
   * Start the heartbeat timer
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL);
  }
  
  /**
   * Stop the heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  /**
   * Send a heartbeat to verify connection
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.sessionId) return;
    
    try {
      // Check WebSocket connection status
      const connectionState = webSocketService.getConnectionState(CHANNEL_NAMES.GAME_UPDATES);
      const connected = connectionState === 'SUBSCRIBED';
      
      if (connected !== this._isConnected) {
        this._isConnected = connected;
        this._connectionState = connected ? 'connected' : 'disconnected';
        this.notifyListeners(connected);
      }
      
      // Update last ping time if connected
      if (connected) {
        this.lastPingTime = Date.now();
      }
      
      // If not connected, attempt reconnect
      if (!connected && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1);
        
        logWithTimestamp(`Connection lost. Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`, 'warn');
        
        setTimeout(() => {
          webSocketService.reconnectChannel(CHANNEL_NAMES.GAME_UPDATES);
        }, delay);
      }
    } catch (error) {
      logWithTimestamp(`Error in heartbeat: ${error}`, 'error');
    }
  }
  
  /**
   * Notify all listeners of connection status change
   */
  private notifyListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        logWithTimestamp(`Error in connection listener: ${error}`, 'error');
      }
    });
  }
}

// Export a singleton instance
export const connectionManager = new ConnectionManager();
