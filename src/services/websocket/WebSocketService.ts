
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { logWithTimestamp } from '@/utils/logUtils';
import { CHANNEL_NAMES, EVENT_TYPES, WebSocketStatus } from './types';

// Constants for WebSocket statuses
export const WEBSOCKET_STATUS = {
  SUBSCRIBED: 'SUBSCRIBED',
  TIMED_OUT: 'TIMED_OUT',
  CLOSED: 'CLOSED',
  CHANNEL_ERROR: 'CHANNEL_ERROR'
};

/**
 * Service for managing WebSocket connections with Supabase Realtime
 */
class WebSocketService {
  private static instance: WebSocketService;
  private client: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();
  private listeners: Map<string, Array<{id: string, callback: (data: any) => void}>> = new Map();
  private connectionState: Map<string, string> = new Map();

  private constructor(supabaseClient: SupabaseClient) {
    this.client = supabaseClient;
    logWithTimestamp('WebSocketService instance created', 'info');
  }

  /**
   * Get the singleton instance of WebSocketService
   */
  public static getInstance(supabaseClient?: SupabaseClient): WebSocketService {
    if (!WebSocketService.instance && supabaseClient) {
      WebSocketService.instance = new WebSocketService(supabaseClient);
    }
    if (!WebSocketService.instance) {
      throw new Error('WebSocketService instance not initialized. Call getInstance with a SupabaseClient first.');
    }
    return WebSocketService.instance;
  }

  /**
   * Set the Supabase client
   */
  public setClient(supabaseClient: SupabaseClient): void {
    this.client = supabaseClient;
    logWithTimestamp('WebSocketService client updated', 'info');
  }

  /**
   * Get the connection state for a specific channel
   */
  public getConnectionState(channelName: string): string {
    return this.connectionState.get(channelName) || 'CLOSED';
  }

  /**
   * Create a channel with Supabase Realtime
   */
  public createChannel(channelName: string): RealtimeChannel {
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = this.client.channel(channelName, {
      config: {
        broadcast: { 
          self: true,
          ack: true
        }
      }
    });
    
    this.channels.set(channelName, channel);
    logWithTimestamp(`WebSocketService: Created channel ${channelName}`, 'info');
    return channel;
  }

  /**
   * Subscribe to a channel with reconnect capability
   */
  public subscribeWithReconnect(
    channelName: string, 
    statusCallback: (status: string) => void
  ): () => void {
    const channel = this.createChannel(channelName);
    
    const subscription = channel.subscribe((status) => {
      this.connectionState.set(channelName, status);
      statusCallback(status);
      logWithTimestamp(`WebSocketService: Channel ${channelName} status: ${status}`, 'info');
    });
    
    return () => {
      this.leaveChannel(channelName);
    };
  }

  /**
   * Add a listener for a specific event on a channel
   */
  public addListener(
    channelName: string,
    type: 'broadcast',
    event: string,
    callback: (payload: any) => void
  ): () => void {
    const channel = this.createChannel(channelName);
    
    channel.on(type, { event }, (payload) => {
      callback(payload);
    });
    
    // Generate a unique ID for this listener
    const listenerId = `${channelName}-${event}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Store the listener for management
    if (!this.listeners.has(channelName)) {
      this.listeners.set(channelName, []);
    }
    
    this.listeners.get(channelName)!.push({
      id: listenerId,
      callback
    });
    
    // Return a cleanup function
    return () => {
      if (this.listeners.has(channelName)) {
        const listenerArray = this.listeners.get(channelName)!;
        const index = listenerArray.findIndex(listener => listener.id === listenerId);
        if (index !== -1) {
          listenerArray.splice(index, 1);
        }
      }
    };
  }

  /**
   * Leave a channel
   */
  public leaveChannel(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.unsubscribe().then(() => {
        this.channels.delete(channelName);
        this.connectionState.set(channelName, 'CLOSED');
        logWithTimestamp(`WebSocketService: Unsubscribed from channel ${channelName}`, 'info');
      }).catch(error => {
        logWithTimestamp(`WebSocketService: Error unsubscribing from channel ${channelName}: ${error}`, 'error');
      });
    }
  }

  /**
   * Reconnect a specific channel
   */
  public reconnectChannel(channelName: string): void {
    // First, leave the channel if it exists
    this.leaveChannel(channelName);
    
    // Then create a new channel
    const channel = this.createChannel(channelName);
    
    // Re-subscribe
    channel.subscribe((status) => {
      this.connectionState.set(channelName, status);
      logWithTimestamp(`WebSocketService: Reconnected channel ${channelName}, status: ${status}`, 'info');
    });
    
    logWithTimestamp(`WebSocketService: Reconnected channel ${channelName}`, 'info');
  }

  /**
   * Broadcast a message to a channel with retry logic
   */
  public async broadcastWithRetry(
    channelName: string, 
    event: string, 
    message: any,
    retries: number = 3
  ): Promise<boolean> {
    let lastError: any = null;

    for (let i = 0; i < retries; i++) {
      try {
        const channel = this.channels.get(channelName);
        if (!channel) {
          throw new Error(`Channel ${channelName} not initialized`);
        }

        const result = await channel.send({
          type: 'broadcast',
          event: event,
          payload: message
        });

        logWithTimestamp(`WebSocketService: Broadcast message on channel ${channelName} with event ${event}`, 'debug');
        return true; // Success
      } catch (error: any) {
        lastError = error;
        logWithTimestamp(`WebSocketService: Attempt ${i + 1} failed to broadcast message on channel ${channelName}: ${error}`, 'warn');
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }

    logWithTimestamp(`WebSocketService: Failed to broadcast message on channel ${channelName} after ${retries} attempts: ${lastError}`, 'error');
    return false; // Failure
  }

  /**
   * Subscribe to session state changes
   */
  public subscribeToSessionState(
    sessionId: string, 
    callback: (update: any | null) => void
  ): () => void {
    const channelName = `session-state:${sessionId}`;
    const channel = this.createChannel(channelName);

    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'game_sessions',
      filter: `id=eq.${sessionId}`
    }, (payload) => {
      logWithTimestamp(`WebSocketService: Received session state update for session ${sessionId}`, 'debug');
      callback(payload.new);
    });

    channel.subscribe(async (status) => {
      logWithTimestamp(`WebSocketService: Subscription status for session state channel ${channelName}: ${status}`, 'info');
      if (status === 'SUBSCRIBED') {
        logWithTimestamp(`WebSocketService: Successfully subscribed to session state channel ${channelName}`, 'info');
        // Fetch the current session state upon subscription
        try {
          const { data, error } = await this.client
            .from('game_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

          if (error) {
            logWithTimestamp(`WebSocketService: Error fetching session data: ${error.message}`, 'error');
          } else {
            callback(data || null);
          }
        } catch (error: any) {
          logWithTimestamp(`WebSocketService: Error fetching session data: ${error.message}`, 'error');
          callback(null);
        }
      } else {
        logWithTimestamp(`WebSocketService: Issue subscribing to session state channel ${channelName}: ${status}`, 'warn');
        callback(null);
      }
    });

    return () => {
      this.leaveChannel(channelName);
    };
  }

  /**
   * Broadcast a message without using a channel
   */
  public broadcast(channel: string, data: any): boolean {
    if (this.listeners.has(channel)) {
      const listeners = this.listeners.get(channel)!;
      listeners.forEach(({callback}) => {
        try {
          callback(data);
        } catch (error) {
          logWithTimestamp(`WebSocketService: Error in listener callback for channel ${channel}: ${error}`, 'error');
        }
      });
      logWithTimestamp(`WebSocketService: Broadcast message to ${listeners.length} listeners on channel ${channel}`, 'debug');
      return true;
    }
    return false;
  }

  /**
   * Subscribe to a specific channel
   */
  public subscribe(channelName: string, callback: (data: any) => void): string {
    const listenerId = `${channelName}-${Math.random().toString(36).substring(2, 9)}`;
    
    if (!this.listeners.has(channelName)) {
      this.listeners.set(channelName, []);
    }
    
    this.listeners.get(channelName)!.push({
      id: listenerId,
      callback
    });
    
    logWithTimestamp(`WebSocketService: Added listener ${listenerId} to channel ${channelName}`, 'debug');
    return listenerId;
  }
  
  /**
   * Unsubscribe from a specific listener
   */
  public unsubscribe(listenerId: string): boolean {
    for (const [channelName, listeners] of this.listeners.entries()) {
      const index = listeners.findIndex(item => item.id === listenerId);
      if (index !== -1) {
        listeners.splice(index, 1);
        logWithTimestamp(`WebSocketService: Removed listener ${listenerId} from channel ${channelName}`, 'debug');
        return true;
      }
    }
    return false;
  }
}

// Create a singleton instance of WebSocketService
let webSocketService: WebSocketService;

// Initialize the WebSocketService with the Supabase client
const getWebSocketService = (): WebSocketService => {
  if (!webSocketService) {
    throw new Error("WebSocketService has not been initialized. Ensure it's initialized with a Supabase client instance.");
  }
  return webSocketService;
};

const initializeWebSocketService = (supabaseClient: SupabaseClient): WebSocketService => {
  if (!webSocketService) {
    webSocketService = WebSocketService.getInstance(supabaseClient);
  } else {
    webSocketService.setClient(supabaseClient);
  }
  return webSocketService;
};

export { 
  WebSocketService, 
  webSocketService, 
  getWebSocketService, 
  initializeWebSocketService, 
  CHANNEL_NAMES, 
  EVENT_TYPES, 
  WEBSOCKET_STATUS 
};
