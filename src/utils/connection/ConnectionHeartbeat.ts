
import { logWithTimestamp } from '../logUtils';
import { HEARTBEAT_INTERVAL } from '@/constants/connectionConstants';
import { getWebSocketService, CHANNEL_NAMES, WEBSOCKET_STATUS } from '@/services/websocket';

/**
 * A utility class to manage connection heartbeats
 */
export class ConnectionHeartbeat {
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastPingTime: number | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private isConnected: boolean = false;
  private reconnectInProgress: boolean = false;
  
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
    this.reconnectInProgress = false;
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
      // Check WebSocket connection status using getWebSocketService
      const webSocketService = getWebSocketService();
      const connectionState = webSocketService.getConnectionState(CHANNEL_NAMES.GAME_UPDATES);
      const connected = connectionState === WEBSOCKET_STATUS.SUBSCRIBED;
      
      if (connected !== this.isConnected) {
        this.isConnected = connected;
        this.onConnectionChange(connected);
      }
      
      // Update last ping time if connected
      if (connected) {
        this.lastPingTime = Date.now();
        // Reset reconnect attempts if we're connected
        if (this.reconnectAttempts > 0) {
          this.resetReconnectAttempts();
        }
      }
      
      // If not connected and not already trying to reconnect, attempt reconnect
      if (!connected && !this.reconnectInProgress && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.reconnectInProgress = true;
        
        logWithTimestamp(`Connection lost. Attempting reconnect (attempt ${this.reconnectAttempts})`, 'warn');
        
        // Trigger reconnect
        this.onReconnectNeeded();
        
        // Allow some time before allowing another reconnect attempt
        setTimeout(() => {
          this.reconnectInProgress = false;
        }, 5000); // 5 second cooldown between reconnect attempts
      }
    } catch (error) {
      logWithTimestamp(`Error in heartbeat: ${error}`, 'error');
    }
  }
}
