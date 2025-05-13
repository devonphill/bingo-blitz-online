
import { logWithTimestamp } from '@/utils/logUtils';
import { ConnectionListener } from './types';

/**
 * Manages WebSocket connection state
 */
export class ConnectionStateManager {
  private connectionState: Map<string, string> = new Map();
  private connectionListeners: Map<string, Set<ConnectionListener>> = new Map();
  private instanceId: string;
  
  constructor() {
    this.instanceId = `connStateMgr-${Math.random().toString(36).substring(2, 7)}`;
  }

  /**
   * Get connection state for a channel
   */
  public getState(channelName: string): string {
    return this.connectionState.get(channelName) || 'unknown';
  }
  
  /**
   * Set connection state for a channel
   */
  public setState(channelName: string, state: string): void {
    this.connectionState.set(channelName, state);
    logWithTimestamp(`[${this.instanceId}] Channel ${channelName} state: ${state}`, 'info');
    this.notifyStatusListeners(channelName, state);
  }
  
  /**
   * Check if a channel is connected
   */
  public isConnected(channelName: string): boolean {
    return this.getState(channelName) === 'SUBSCRIBED';
  }
  
  /**
   * Add a connection status listener
   */
  public addListener(channelName: string, listener: ConnectionListener): () => void {
    // Initialize connection listeners Set if not exists
    if (!this.connectionListeners.has(channelName)) {
      this.connectionListeners.set(channelName, new Set());
    }
    
    // Add the status change listener
    this.connectionListeners.get(channelName)?.add(listener);
    
    // Return cleanup function
    return () => {
      const listeners = this.connectionListeners.get(channelName);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }
  
  /**
   * Notify all listeners about a status change
   */
  private notifyStatusListeners(channelName: string, status: string): void {
    const listeners = this.connectionListeners.get(channelName);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(status);
        } catch (error) {
          logWithTimestamp(`[${this.instanceId}] Error in status listener: ${error}`, 'error');
        }
      });
    }
  }
  
  /**
   * Clean up all connection state data
   */
  public cleanup(): void {
    this.connectionState.clear();
    this.connectionListeners.clear();
  }
}
