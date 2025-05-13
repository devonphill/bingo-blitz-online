
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { CHANNEL_NAMES, EVENT_TYPES, WEBSOCKET_STATUS } from '@/constants/websocketConstants';

/**
 * Unified WebSocket Service
 * Single source of truth for all WebSocket communications in the application
 */
class WebSocketService {
  private channels: Map<string, any> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private connectionState: Map<string, string> = new Map();
  private connectionListeners: Map<string, Set<(state: string) => void>> = new Map();
  private maxReconnectDelay = 10000; // 10 seconds maximum delay
  private baseReconnectDelay = 1000; // 1 second base delay
  private instanceId: string;
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 10;
  
  constructor() {
    this.instanceId = `ws-${Math.random().toString(36).substring(2, 7)}`;
    logWithTimestamp(`[${this.instanceId}] WebSocketService initialized`, 'info');
  }
  
  /**
   * Creates a channel with proper configuration
   */
  public createChannel(channelName: string, config = {}) {
    try {
      // First check if we already have this channel - if so, remove it to avoid duplicates
      const channelKey = this.getChannelKey(channelName);
      if (this.channels.has(channelKey)) {
        logWithTimestamp(`[${this.instanceId}] Channel ${channelName} already exists, removing before recreating`, 'info');
        try {
          const existingChannel = this.channels.get(channelKey);
          if (existingChannel) {
            supabase.removeChannel(existingChannel);
          }
          this.channels.delete(channelKey);
        } catch (err) {
          logWithTimestamp(`[${this.instanceId}] Error removing existing channel: ${err}`, 'error');
        }
      }
      
      // Default configuration with improved resilience
      const defaultConfig = {
        config: {
          broadcast: { 
            self: true, // Receive own broadcasts
            ack: true   // Request acknowledgment
          },
          presence: {
            key: this.instanceId
          }
        }
      };
      
      // Merge with custom config
      const mergedConfig = { ...defaultConfig, ...config };
      
      // Create the channel
      const channel = supabase.channel(channelName, mergedConfig);
      
      // Store the channel
      this.channels.set(channelKey, channel);
      this.connectionState.set(channelKey, 'connecting');
      
      // Reset reconnect attempts for this channel
      this.reconnectAttempts.set(channelKey, 0);
      
      logWithTimestamp(`[${this.instanceId}] Created channel: ${channelName}`, 'info');
      
      return channel;
    } catch (error) {
      logWithTimestamp(`[${this.instanceId}] Error creating channel: ${error}`, 'error');
      throw error;
    }
  }
  
  /**
   * Subscribe to a channel with automatic reconnection
   */
  public subscribeWithReconnect(channelName: string, onStatusChange?: (status: string) => void) {
    const channelKey = this.getChannelKey(channelName);
    const channel = this.channels.get(channelKey);
    
    if (!channel) {
      logWithTimestamp(`[${this.instanceId}] Cannot subscribe: Channel ${channelName} not found`, 'error');
      return;
    }
    
    // Initialize connection listeners Set if not exists
    if (!this.connectionListeners.has(channelKey)) {
      this.connectionListeners.set(channelKey, new Set());
    }
    
    // Add the status change listener
    if (onStatusChange) {
      this.connectionListeners.get(channelKey)?.add(onStatusChange);
    }
    
    // Add generic connection status handler
    channel.on('system', { event: 'connection_state_change' }, (payload: any) => {
      const status = payload.event;
      this.connectionState.set(channelKey, status);
      logWithTimestamp(`[${this.instanceId}] Channel ${channelName} connection state: ${status}`, 'info');
      
      // Notify all listeners
      this.notifyStatusListeners(channelKey, status);
      
      // If disconnected, attempt reconnect with exponential backoff
      if (status === WEBSOCKET_STATUS.CLOSED || status === WEBSOCKET_STATUS.CHANNEL_ERROR) {
        this.scheduleReconnect(channelName);
      }
      
      // If connected, clear any pending reconnect
      if (status === WEBSOCKET_STATUS.SUBSCRIBED) {
        this.clearReconnect(channelName);
      }
    });
    
    // Subscribe to the channel
    channel.subscribe((status: string) => {
      logWithTimestamp(`[${this.instanceId}] Channel ${channelName} subscription status: ${status}`, 'info');
      this.connectionState.set(channelKey, status);
      
      // Notify all listeners
      this.notifyStatusListeners(channelKey, status);
      
      if (status !== WEBSOCKET_STATUS.SUBSCRIBED) {
        this.scheduleReconnect(channelName);
      }
    });
    
    return channel;
  }
  
  /**
   * Notify all listeners about a status change
   */
  private notifyStatusListeners(channelKey: string, status: string) {
    const listeners = this.connectionListeners.get(channelKey);
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
   * Send a broadcast message with retry capability
   */
  public async broadcastWithRetry(channelName: string, eventType: string, payload: any, maxRetries = 3): Promise<boolean> {
    const channelKey = this.getChannelKey(channelName);
    const channel = this.channels.get(channelKey);
    
    if (!channel) {
      logWithTimestamp(`[${this.instanceId}] Cannot broadcast: Channel ${channelName} not found`, 'error');
      return false;
    }
    
    // Generate a unique ID for this broadcast for deduplication
    const broadcastId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const enrichedPayload = { 
      ...payload,
      broadcastId,
      timestamp: Date.now()
    };
    
    let retries = 0;
    
    while (retries <= maxRetries) {
      try {
        logWithTimestamp(`[${this.instanceId}] Broadcasting ${eventType} to ${channelName} (attempt ${retries + 1})`, 'info');
        
        await channel.send({
          type: 'broadcast',
          event: eventType,
          payload: enrichedPayload
        });
        
        logWithTimestamp(`[${this.instanceId}] Broadcast ${eventType} successful`, 'info');
        return true;
      } catch (error) {
        retries++;
        logWithTimestamp(`[${this.instanceId}] Broadcast error (attempt ${retries}): ${error}`, 'error');
        
        // For the last retry, if it fails, return false
        if (retries > maxRetries) {
          return false;
        }
        
        // Wait exponentially longer between retries
        await new Promise(resolve => setTimeout(resolve, 300 * Math.pow(2, retries)));
      }
    }
    
    return false;
  }
  
  /**
   * Get connection state for a channel
   */
  public getConnectionState(channelName: string): string {
    const channelKey = this.getChannelKey(channelName);
    return this.connectionState.get(channelKey) || 'unknown';
  }
  
  /**
   * Check if a channel is connected
   */
  public isConnected(channelName: string): boolean {
    return this.getConnectionState(channelName) === WEBSOCKET_STATUS.SUBSCRIBED;
  }
  
  /**
   * Force reconnect a channel
   */
  public reconnectChannel(channelName: string): void {
    const channelKey = this.getChannelKey(channelName);
    
    // Remove existing channel
    if (this.channels.has(channelKey)) {
      try {
        const channel = this.channels.get(channelKey);
        if (channel) {
          supabase.removeChannel(channel);
        }
        this.channels.delete(channelKey);
      } catch (error) {
        logWithTimestamp(`[${this.instanceId}] Error removing channel ${channelName}: ${error}`, 'error');
      }
    }
    
    // Clear any pending reconnect
    this.clearReconnect(channelName);
    
    // Create a fresh channel
    const channel = this.createChannel(channelName);
    
    // Store in our map
    this.channels.set(channelKey, channel);
    this.connectionState.set(channelKey, 'connecting');
    
    logWithTimestamp(`[${this.instanceId}] Forced reconnection for channel ${channelName}`, 'info');
    
    // Resubscribe
    this.subscribeWithReconnect(channelName);
  }
  
  /**
   * Clean up all channels
   */
  public cleanup(): void {
    // Clean up all channels
    for (const [key, channel] of this.channels.entries()) {
      try {
        if (channel) {
          supabase.removeChannel(channel);
        }
        logWithTimestamp(`[${this.instanceId}] Removed channel ${key}`, 'info');
      } catch (error) {
        logWithTimestamp(`[${this.instanceId}] Error removing channel ${key}: ${error}`, 'error');
      }
    }
    
    // Clear all channels
    this.channels.clear();
    
    // Clear all reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
    
    // Clear connection state and listeners
    this.connectionState.clear();
    this.connectionListeners.clear();
    this.reconnectAttempts.clear();
    
    logWithTimestamp(`[${this.instanceId}] WebSocketService cleanup complete`, 'info');
  }
  
  /**
   * Schedule reconnect with exponential backoff
   */
  private scheduleReconnect(channelName: string): void {
    const channelKey = this.getChannelKey(channelName);
    
    // Clear any existing reconnect timer
    this.clearReconnect(channelName);
    
    // Get current retry count and increment it
    const retryCount = (this.reconnectAttempts.get(channelKey) || 0) + 1;
    this.reconnectAttempts.set(channelKey, retryCount);
    
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
      this.reconnectChannel(channelName);
    }, delay);
    
    this.reconnectTimers.set(channelKey, timer);
  }
  
  /**
   * Clear any pending reconnect timer
   */
  private clearReconnect(channelName: string): void {
    const channelKey = this.getChannelKey(channelName);
    
    if (this.reconnectTimers.has(channelKey)) {
      clearTimeout(this.reconnectTimers.get(channelKey));
      this.reconnectTimers.delete(channelKey);
      logWithTimestamp(`[${this.instanceId}] Cleared reconnect timer for ${channelName}`, 'info');
    }
  }
  
  /**
   * Add event listener to a channel
   */
  public addListener(channelName: string, eventType: string, event: string, callback: (payload: any) => void) {
    const channelKey = this.getChannelKey(channelName);
    const channel = this.channels.get(channelKey);
    
    if (!channel) {
      logWithTimestamp(`[${this.instanceId}] Cannot add listener: Channel ${channelName} not found`, 'error');
      return () => {}; // Return empty cleanup function
    }
    
    // Add the listener
    channel.on(eventType, { event }, callback);
    
    // Return cleanup function
    return () => {
      try {
        // No direct way to remove specific listeners, so we don't do anything here
        // The listener will be removed when the channel is removed
      } catch (error) {
        logWithTimestamp(`[${this.instanceId}] Error removing listener: ${error}`, 'error');
      }
    };
  }
  
  /**
   * Get a unique key for a channel
   */
  private getChannelKey(channelName: string): string {
    return `${channelName}`;
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();

// Re-export constants for convenience
export { CHANNEL_NAMES, EVENT_TYPES, WEBSOCKET_STATUS };
