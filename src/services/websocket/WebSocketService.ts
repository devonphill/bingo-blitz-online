
import { logWithTimestamp } from '@/utils/logUtils';
import { CHANNEL_NAMES, EVENT_TYPES, WEBSOCKET_STATUS } from '@/constants/websocketConstants';
import { ChannelManager } from './channelManager';
import { ReconnectionManager } from './reconnectionManager';
import { BroadcastManager } from './broadcastManager';
import { ConnectionStateManager } from './connectionStateManager';
import { BroadcastOptions, ConnectionListener } from './types';

/**
 * Unified WebSocket Service
 * Single source of truth for all WebSocket communications in the application
 */
class WebSocketService {
  private channelManager: ChannelManager;
  private reconnectionManager: ReconnectionManager;
  private broadcastManager: BroadcastManager;
  private connectionStateManager: ConnectionStateManager;
  private instanceId: string;
  
  constructor() {
    this.instanceId = `ws-${Math.random().toString(36).substring(2, 7)}`;
    this.channelManager = new ChannelManager();
    this.connectionStateManager = new ConnectionStateManager();
    this.broadcastManager = new BroadcastManager();
    
    // Initialize reconnection manager with a callback to handle reconnects
    this.reconnectionManager = new ReconnectionManager((channelName) => {
      this.reconnectChannel(channelName);
    });
    
    logWithTimestamp(`[${this.instanceId}] WebSocketService initialized`, 'info');
  }
  
  /**
   * Creates a channel with proper configuration
   */
  public createChannel(channelName: string, config = {}) {
    const channel = this.channelManager.createChannel(channelName, config);
    this.connectionStateManager.setState(channelName, 'connecting');
    return channel;
  }
  
  /**
   * Subscribe to a channel with automatic reconnection
   */
  public subscribeWithReconnect(channelName: string, onStatusChange?: ConnectionListener) {
    const channel = this.channelManager.getChannel(channelName);
    
    if (!channel) {
      logWithTimestamp(`[${this.instanceId}] Cannot subscribe: Channel ${channelName} not found`, 'error');
      return;
    }
    
    // Add status change listener if provided
    if (onStatusChange) {
      this.connectionStateManager.addListener(channelName, onStatusChange);
    }
    
    // Add generic connection status handler
    channel.on('system', { event: 'connection_state_change' }, (payload: any) => {
      const status = payload.event;
      this.connectionStateManager.setState(channelName, status);
      
      // If disconnected, attempt reconnect with exponential backoff
      if (status === WEBSOCKET_STATUS.CLOSED || status === WEBSOCKET_STATUS.CHANNEL_ERROR) {
        this.reconnectionManager.scheduleReconnect(channelName);
      }
      
      // If connected, clear any pending reconnect
      if (status === WEBSOCKET_STATUS.SUBSCRIBED) {
        this.reconnectionManager.clearReconnect(channelName);
      }
    });
    
    // Subscribe to the channel
    channel.subscribe((status: string) => {
      logWithTimestamp(`[${this.instanceId}] Channel ${channelName} subscription status: ${status}`, 'info');
      this.connectionStateManager.setState(channelName, status);
      
      if (status !== WEBSOCKET_STATUS.SUBSCRIBED) {
        this.reconnectionManager.scheduleReconnect(channelName);
      }
    });
    
    return channel;
  }
  
  /**
   * Send a broadcast message with retry capability
   */
  public async broadcastWithRetry(
    channelName: string, 
    eventType: string, 
    payload: any, 
    options: BroadcastOptions = {}
  ): Promise<boolean> {
    const channel = this.channelManager.getChannel(channelName);
    
    if (!channel) {
      logWithTimestamp(`[${this.instanceId}] Cannot broadcast: Channel ${channelName} not found`, 'error');
      return false;
    }
    
    return this.broadcastManager.broadcastWithRetry(channel, eventType, payload, options);
  }
  
  /**
   * Get connection state for a channel
   */
  public getConnectionState(channelName: string): string {
    return this.connectionStateManager.getState(channelName);
  }
  
  /**
   * Check if a channel is connected
   */
  public isConnected(channelName: string): boolean {
    return this.connectionStateManager.isConnected(channelName);
  }
  
  /**
   * Force reconnect a channel
   */
  public reconnectChannel(channelName: string): void {
    // Remove existing channel
    this.channelManager.removeChannel(channelName);
    
    // Clear any pending reconnect
    this.reconnectionManager.clearReconnect(channelName);
    this.reconnectionManager.resetAttempts(channelName);
    
    // Create a fresh channel
    const channel = this.channelManager.createChannel(channelName);
    this.connectionStateManager.setState(channelName, 'connecting');
    
    logWithTimestamp(`[${this.instanceId}] Forced reconnection for channel ${channelName}`, 'info');
    
    // Resubscribe
    this.subscribeWithReconnect(channelName);
  }
  
  /**
   * Clean up all channels
   */
  public cleanup(): void {
    this.channelManager.cleanupAllChannels();
    this.reconnectionManager.cleanup();
    this.connectionStateManager.cleanup();
    
    logWithTimestamp(`[${this.instanceId}] WebSocketService cleanup complete`, 'info');
  }
  
  /**
   * Add event listener to a channel
   */
  public addListener(channelName: string, eventType: string, event: string, callback: (payload: any) => void) {
    const channel = this.channelManager.getChannel(channelName);
    
    if (!channel) {
      logWithTimestamp(`[${this.instanceId}] Cannot add listener: Channel ${channelName} not found`, 'error');
      return () => {}; // Return empty cleanup function
    }
    
    // Add the listener
    channel.on(eventType, { event }, callback);
    
    // Return cleanup function
    return () => {
      // No direct way to remove specific listeners, so we don't do anything here
      // The listener will be removed when the channel is removed
    };
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();

// Re-export constants for convenience
export { CHANNEL_NAMES, EVENT_TYPES, WEBSOCKET_STATUS };
