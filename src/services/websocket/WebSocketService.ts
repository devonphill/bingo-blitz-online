
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export class WebSocketService {
  private static instance: WebSocketService;
  private channels: Map<string, any> = new Map();
  private sessionStateListeners: Map<string, Function[]> = new Map();
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  // Get singleton instance
  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
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

// Export a function to get the service instance for compatibility
export const getWebSocketService = (): WebSocketService => {
  return WebSocketService.getInstance();
};
