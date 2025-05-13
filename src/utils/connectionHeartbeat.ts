
import { logWithTimestamp } from './logUtils';
import { HEARTBEAT_INTERVAL } from '@/constants/connectionConstants';
import { webSocketService, CHANNEL_NAMES } from '@/services/WebSocketService';

/**
 * A utility class to manage connection heartbeats
 */
export class ConnectionHeartbeatManager {
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastPingTime: number | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private isConnected: boolean = false;
  
  constructor(
    private readonly onConnectionChange: (connected: boolean) => void,
    private readonly onReconnectNeeded: () => void
  ) {}

  /**
   * Set the session ID
   */
  public setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }

  /**
   * Get the last ping time
   */
  public getLastPing(): number | null {
    return this.lastPingTime;
  }

  /**
   * Update connection status
   */
  public updateConnection(isConnected: boolean): void {
    if (this.isConnected !== isConnected) {
      this.isConnected = isConnected;
      this.onConnectionChange(isConnected);
    }
  }

  /**
   * Reset reconnect attempts
   */
  public resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }

  /**
   * Start the heartbeat timer
   */
  public startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL);
  }
  
  /**
   * Stop the heartbeat timer
   */
  public stopHeartbeat(): void {
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
      
      if (connected !== this.isConnected) {
        this.isConnected = connected;
        this.onConnectionChange(connected);
      }
      
      // Update last ping time if connected
      if (connected) {
        this.lastPingTime = Date.now();
      }
      
      // If not connected, attempt reconnect
      if (!connected && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        
        logWithTimestamp(`Connection lost. Attempting reconnect (attempt ${this.reconnectAttempts})`, 'warn');
        
        this.onReconnectNeeded();
      }
    } catch (error) {
      logWithTimestamp(`Error in heartbeat: ${error}`, 'error');
    }
  }
}
