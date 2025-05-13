
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { 
  ChannelConfig, 
  WebSocketChannel, 
  BroadcastOptions, 
  ConnectionListener,
  CHANNEL_NAMES,
  EVENT_TYPES,
  WEBSOCKET_STATUS
} from './types';

export class WebSocketService {
  private static instance: WebSocketService;
  private channels: Map<string, any> = new Map();
  private sessionStateListeners: Map<string, Function[]> = new Map();
  private connectionListeners: Map<string, ConnectionListener[]> = new Map();
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  // Get singleton instance
  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }
  
  // Create a channel with the specified name
  public createChannel(channelName: string, config?: ChannelConfig): WebSocketChannel {
    let channel = this.channels.get(channelName);
    
    if (!channel) {
      try {
        // Create channel with proper configuration object structure that satisfies RealtimeChannelOptions
        channel = supabase.channel(channelName, {
          config: config?.config || { broadcast: { self: true, ack: true } }
        });
        this.channels.set(channelName, channel);
        logWithTimestamp(`WebSocketService: Created channel ${channelName}`, 'info');
      } catch (error) {
        logWithTimestamp(`WebSocketService: Error creating channel ${channelName}: ${error}`, 'error');
        throw new Error(`Failed to create channel: ${error}`);
      }
    }
    
    return channel;
  }
  
  // Subscribe to a channel with reconnect capability
  public subscribeWithReconnect(channelName: string, listener: ConnectionListener): () => void {
    // Create channel if it doesn't exist
    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = this.createChannel(channelName);
    }
    
    // Register the connection listener
    if (!this.connectionListeners.has(channelName)) {
      this.connectionListeners.set(channelName, []);
    }
    
    const listeners = this.connectionListeners.get(channelName)!;
    listeners.push(listener);
    
    // Subscribe to the channel
    channel.subscribe(status => {
      // Notify all listeners with the current status
      listeners.forEach(l => l(status));
    });
    
    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }
  
  // Add an event listener to a channel
  public addListener(
    channelName: string,
    event: string,
    eventType: string,
    callback: (payload: any) => void
  ): () => void {
    let channel = this.channels.get(channelName);
    
    if (!channel) {
      channel = this.createChannel(channelName);
    }
    
    // Register the event listener
    channel.on(event, { event: eventType }, callback);
    
    // Return cleanup function
    return () => {
      // Unfortunately, Supabase doesn't provide a direct way to remove specific listeners
      // We would need to remove the channel and recreate it, which isn't ideal
      logWithTimestamp(`WebSocketService: Removed listener for ${eventType} on ${channelName}`, 'info');
    };
  }
  
  // Get the current connection state for a channel
  public getConnectionState(channelName: string): string {
    const channel = this.channels.get(channelName);
    if (!channel) return 'disconnected';
    
    // The actual state is managed internally by Supabase
    // We would need to track this ourselves based on the subscription callbacks
    return 'connecting';
  }
  
  // Force reconnect a channel
  public reconnectChannel(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (!channel) {
      logWithTimestamp(`WebSocketService: Cannot reconnect non-existent channel ${channelName}`, 'warn');
      return;
    }
    
    try {
      // Remove the existing channel
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
      
      // Create and subscribe to a new channel
      const newChannel = this.createChannel(channelName);
      const listeners = this.connectionListeners.get(channelName) || [];
      
      newChannel.subscribe(status => {
        listeners.forEach(l => l(status));
      });
      
      logWithTimestamp(`WebSocketService: Reconnected channel ${channelName}`, 'info');
    } catch (error) {
      logWithTimestamp(`WebSocketService: Error reconnecting channel ${channelName}: ${error}`, 'error');
    }
  }
  
  // Broadcast a message with retry capability
  public async broadcastWithRetry(
    channelName: string,
    eventType: string,
    payload: any,
    options?: BroadcastOptions
  ): Promise<boolean> {
    const retries = options?.retries || 3;
    const retryDelay = options?.retryDelay || 1000;
    
    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = this.createChannel(channelName);
    }
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        logWithTimestamp(`WebSocketService: Broadcasting ${eventType} (attempt ${attempt+1}/${retries})`, 'info');
        
        await channel.send({
          type: 'broadcast',
          event: eventType,
          payload
        });
        
        logWithTimestamp(`WebSocketService: Successfully broadcast ${eventType}`, 'info');
        return true;
      } catch (error) {
        logWithTimestamp(`WebSocketService: Error broadcasting ${eventType}: ${error}`, 'error');
        
        if (attempt < retries - 1) {
          logWithTimestamp(`WebSocketService: Retrying in ${retryDelay}ms...`, 'info');
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    return false;
  }
  
  // Subscribe to session state changes
  public subscribeToSessionState(sessionId: string, listener: (state: any) => void): () => void {
    if (!this.sessionStateListeners.has(sessionId)) {
      this.sessionStateListeners.set(sessionId, []);
      this.setupSessionStateChannel(sessionId);
    }
    
    const listeners = this.sessionStateListeners.get(sessionId)!;
    listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
      
      // If no more listeners, remove the channel
      if (listeners.length === 0) {
        this.removeChannel(`session-state-${sessionId}`);
        this.sessionStateListeners.delete(sessionId);
      }
    };
  }
  
  // Setup a channel to listen for session state changes
  private setupSessionStateChannel(sessionId: string): void {
    const channelId = `session-state-${sessionId}`;
    
    try {
      // Create a channel for listening to session state changes
      const channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'game_sessions',
            filter: `id=eq.${sessionId}`
          },
          (payload) => {
            logWithTimestamp(`WebSocketService: Received session state update for ${sessionId}`, 'info');
            console.log('Session state update:', payload);
            
            // Notify all listeners
            const listeners = this.sessionStateListeners.get(sessionId) || [];
            listeners.forEach(listener => {
              try {
                listener(payload.new);
              } catch (error) {
                console.error('Error in session state listener:', error);
              }
            });
          }
        )
        .subscribe(status => {
          logWithTimestamp(`WebSocketService: Session state channel status - ${status}`, 'info');
        });
      
      this.channels.set(channelId, channel);
    } catch (error) {
      console.error('Error setting up session state channel:', error);
    }
  }
  
  // Remove a channel by ID
  private removeChannel(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelId);
      logWithTimestamp(`WebSocketService: Removed channel ${channelId}`, 'info');
    }
  }
  
  // Clean up all channels
  public cleanup(): void {
    this.channels.forEach((channel, id) => {
      supabase.removeChannel(channel);
      logWithTimestamp(`WebSocketService: Cleaned up channel ${id}`, 'info');
    });
    this.channels.clear();
    this.sessionStateListeners.clear();
  }
}

// Export singleton instance
export const webSocketService = WebSocketService.getInstance();

// Export function to get the service instance for compatibility
export const getWebSocketService = (): WebSocketService => {
  return WebSocketService.getInstance();
};
