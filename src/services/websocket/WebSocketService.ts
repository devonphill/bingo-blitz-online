import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { logWithTimestamp } from '@/utils/logUtils';

type GameSessions = Database['public']['Tables']['game_sessions']['Row'];

class WebSocketService {
  private static instance: WebSocketService;
  private client: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();
  private listeners: Map<string, Array<(data: any) => void>> = new Map();
  private connectionState: string = 'disconnected';

  private constructor(supabaseClient: SupabaseClient) {
    this.client = supabaseClient;
  }

  public static getInstance(supabaseClient?: SupabaseClient): WebSocketService {
    if (!WebSocketService.instance && supabaseClient) {
      WebSocketService.instance = new WebSocketService(supabaseClient);
    }
    if (!WebSocketService.instance) {
      throw new Error('WebSocketService instance not initialized. Call getInstance with a SupabaseClient first.');
    }
    return WebSocketService.instance;
  }

  public setClient(supabaseClient: SupabaseClient): void {
    this.client = supabaseClient;
  }

  public getConnectionState(): string {
    return this.connectionState;
  }

  // Initialize a channel
  public initializeChannel(channelName: string): RealtimeChannel {
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = this.client.channel(channelName);
    this.channels.set(channelName, channel);
    logWithTimestamp(`WebSocketService: Initialized channel ${channelName}`, 'info');
    return channel;
  }

  // Join a channel and set up listeners
  public joinChannel(channelName: string, onMessage: (payload: any) => void): void {
    const channel = this.initializeChannel(channelName);

    channel.on('broadcast', { event: '*' }, (payload) => {
      logWithTimestamp(`WebSocketService: Received broadcast on channel ${channelName}: ${JSON.stringify(payload)}`, 'debug');
      onMessage(payload);
    });

    channel.subscribe(async (status) => {
      this.connectionState = status;
      logWithTimestamp(`WebSocketService: Subscription status for channel ${channelName}: ${status}`, 'info');
      if (status === 'SUBSCRIBED') {
        logWithTimestamp(`WebSocketService: Successfully subscribed to channel ${channelName}`, 'info');
      } else {
        logWithTimestamp(`WebSocketService: Issue subscribing to channel ${channelName}: ${status}`, 'warn');
      }
    });
  }

  // Leave a channel
  public leaveChannel(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.unsubscribe().then(() => {
        this.channels.delete(channelName);
        logWithTimestamp(`WebSocketService: Unsubscribed from channel ${channelName}`, 'info');
      }).catch(error => {
        logWithTimestamp(`WebSocketService: Error unsubscribing from channel ${channelName}: ${error}`, 'error');
      });
    }
  }

  // Broadcast a message to a channel with retry logic
  public async broadcastWithRetry(channelName: string, event: string, message: any, retries: number = 3): Promise<boolean> {
    let lastError: any = null;

    for (let i = 0; i < retries; i++) {
      try {
        const channel = this.channels.get(channelName);
        if (!channel) {
          throw new Error(`Channel ${channelName} not initialized`);
        }

        const status = channel.state;
        if (status !== 'joined') {
          throw new Error(`Channel ${channelName} not joined. Current status: ${status}`);
        }

        const result = await channel.send({
          type: 'broadcast',
          event: event,
          payload: message
        });

        logWithTimestamp(`WebSocketService: Broadcast message on channel ${channelName} with event ${event}: ${JSON.stringify(message)}`, 'debug');
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

  public subscribeToSessionState(sessionId: string, callback: (update: GameSessions | null) => void): () => void {
    const channelName = `session-state:${sessionId}`;
    this.initializeChannel(channelName);

    const channel = this.client.channel(channelName);

    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'game_sessions',
      filter: `id=eq.${sessionId}`
    }, (payload) => {
      logWithTimestamp(`WebSocketService: Received session state update for session ${sessionId}: ${JSON.stringify(payload)}`, 'debug');
      callback(payload.new as GameSessions);
    });

    channel.subscribe(async (status) => {
      logWithTimestamp(`WebSocketService: Subscription status for session state channel ${channelName}: ${status}`, 'info');
      if (status === 'SUBSCRIBED') {
        logWithTimestamp(`WebSocketService: Successfully subscribed to session state channel ${channelName}`, 'info');
        // Fetch the current session state upon subscription
        try {
          const { data, error } = await this.client
            .from<GameSessions>('game_sessions')
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

  // Subscribe to a specific channel
  public subscribe(channelName: string, callback: (data: any) => void): string {
    const listenerId = `${channelName}-${Math.random().toString(36).substring(2, 9)}`;
    
    if (!this.listeners.has(channelName)) {
      this.listeners.set(channelName, []);
    }
    
    this.listeners.get(channelName)?.push((data: any) => {
      callback(data);
    });
    
    logWithTimestamp(`WebSocketService: Added listener ${listenerId} to channel ${channelName}`, 'debug');
    return listenerId;
  }
  
  // Unsubscribe from a specific listener
  public unsubscribe(listenerId: string): boolean {
    for (const [channelName, listeners] of this.listeners.entries()) {
      const index = listeners.findIndex(listener => listener === listenerId);
      if (index !== -1) {
        listeners.splice(index, 1);
        logWithTimestamp(`WebSocketService: Removed listener ${listenerId} from channel ${channelName}`, 'debug');
        return true;
      }
    }
    return false;
  }
  
  // Broadcast a message to a specific channel
  public broadcast(channelName: string, data: any): boolean {
    const listeners = this.listeners.get(channelName);
    if (listeners && listeners.length > 0) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logWithTimestamp(`WebSocketService: Error in listener callback for channel ${channelName}: ${error}`, 'error');
        }
      });
      logWithTimestamp(`WebSocketService: Broadcast message to ${listeners.length} listeners on channel ${channelName}`, 'debug');
      return true;
    }
    return false;
  }
}

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

export { WebSocketService, webSocketService, getWebSocketService, initializeWebSocketService };
