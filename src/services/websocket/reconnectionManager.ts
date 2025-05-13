
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Manages reconnection strategies for WebSocket channels
 */
export class ReconnectionManager {
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts: number = 10;
  private maxReconnectDelay: number = 10000; // 10 seconds maximum delay
  private baseReconnectDelay: number = 1000; // 1 second base delay
  private instanceId: string;
  private onReconnect: (channelName: string) => void;
  
  constructor(onReconnect: (channelName: string) => void) {
    this.instanceId = `reconnMgr-${Math.random().toString(36).substring(2, 7)}`;
    this.onReconnect = onReconnect;
  }

  /**
   * Schedule reconnect with exponential backoff
   */
  public scheduleReconnect(channelName: string): void {
    // Clear any existing reconnect timer
    this.clearReconnect(channelName);
    
    // Get current retry count and increment it
    const retryCount = (this.reconnectAttempts.get(channelName) || 0) + 1;
    this.reconnectAttempts.set(channelName, retryCount);
    
    // If we've exceeded max attempts, don't try again
    if (retryCount > this.maxReconnectAttempts) {
      logWithTimestamp(`[${this.instanceId}] Maximum reconnect attempts (${this.maxReconnectAttempts}) exceeded for channel ${channelName}`, 'warn');
      return;
    }
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, retryCount - 1),
      this.maxReconnectDelay
    );
    
    logWithTimestamp(`[${this.instanceId}] Scheduling reconnect for ${channelName} in ${delay}ms (retry ${retryCount})`, 'info');
    
    // Schedule reconnect
    const timer = setTimeout(() => {
      this.onReconnect(channelName);
    }, delay);
    
    this.reconnectTimers.set(channelName, timer);
  }
  
  /**
   * Clear any pending reconnect timer
   */
  public clearReconnect(channelName: string): void {
    if (this.reconnectTimers.has(channelName)) {
      clearTimeout(this.reconnectTimers.get(channelName));
      this.reconnectTimers.delete(channelName);
      logWithTimestamp(`[${this.instanceId}] Cleared reconnect timer for ${channelName}`, 'info');
    }
  }
  
  /**
   * Reset reconnect attempts counter
   */
  public resetAttempts(channelName: string): void {
    this.reconnectAttempts.set(channelName, 0);
  }
  
  /**
   * Clean up all reconnect timers
   */
  public cleanup(): void {
    // Clear all reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
    this.reconnectAttempts.clear();
  }
}
