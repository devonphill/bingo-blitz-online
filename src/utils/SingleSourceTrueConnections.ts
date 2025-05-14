
import { supabase } from '@/integrations/supabase/client';
import { getWebSocketService, initializeWebSocketService, CHANNEL_NAMES, EVENT_TYPES, WEBSOCKET_STATUS } from '@/services/websocket';
import { logWithTimestamp } from './logUtils';

/**
 * Singleton manager for all WebSocket connections in the application
 * This is the ONLY place where WebSocket connections should be initialized
 */
export class SingleSourceTrueConnections {
  private static instance: SingleSourceTrueConnections;
  private initialized = false;
  
  private constructor() {
    // Initialize WebSocket service with Supabase client
    initializeWebSocketService(supabase);
    this.initialized = true;
    logWithTimestamp('SingleSourceTrueConnections initialized', 'info');
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): SingleSourceTrueConnections {
    if (!SingleSourceTrueConnections.instance) {
      SingleSourceTrueConnections.instance = new SingleSourceTrueConnections();
    }
    return SingleSourceTrueConnections.instance;
  }
  
  /**
   * Get the WebSocket service
   */
  public getWebSocketService() {
    return getWebSocketService();
  }
  
  /**
   * Check if a connection exists for a session
   */
  public isConnectedToSession(sessionId: string): boolean {
    if (!this.initialized) return false;
    
    try {
      const webSocketService = getWebSocketService();
      const channelName = `session-${sessionId}`;
      const status = webSocketService.getConnectionState(channelName);
      return status === WEBSOCKET_STATUS.SUBSCRIBED;
    } catch (error) {
      logWithTimestamp(`Error checking connection status: ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Connect to a session channel
   */
  public connectToSession(sessionId: string): boolean {
    if (!this.initialized || !sessionId) return false;
    
    try {
      const webSocketService = getWebSocketService();
      const channelName = `session-${sessionId}`;
      
      // Create and subscribe to the channel
      webSocketService.subscribeWithReconnect(channelName, (status) => {
        logWithTimestamp(`Session ${sessionId} connection status: ${status}`, 'info');
      });
      
      return true;
    } catch (error) {
      logWithTimestamp(`Error connecting to session ${sessionId}: ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Broadcast a number called event
   */
  public async broadcastNumberCalled(sessionId: string, number: number, calledNumbers: number[]): Promise<boolean> {
    if (!this.initialized || !sessionId) return false;
    
    try {
      const webSocketService = getWebSocketService();
      
      // Broadcast the number via WebSocket
      const success = await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.NUMBER_CALLED,
        {
          number,
          sessionId,
          calledNumbers,
          timestamp: Date.now()
        }
      );
      
      return success;
    } catch (error) {
      logWithTimestamp(`Error broadcasting number: ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Export constants for consistent usage
   */
  public static CHANNEL_NAMES = CHANNEL_NAMES;
  public static EVENT_TYPES = EVENT_TYPES;
  public static WEBSOCKET_STATUS = WEBSOCKET_STATUS;
}

// Export a singleton instance getter
export const getSingleSourceConnection = () => SingleSourceTrueConnections.getInstance();

// Re-export needed types for convenience
export { CHANNEL_NAMES, EVENT_TYPES, WEBSOCKET_STATUS } from '@/services/websocket';
