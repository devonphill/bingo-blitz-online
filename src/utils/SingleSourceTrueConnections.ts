
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { RealtimeChannel } from '@supabase/supabase-js';
import { WebSocketService } from '@/services/websocket/WebSocketService';
import { 
  CHANNEL_NAMES,
  EVENT_TYPES,
  CONNECTION_STATES
} from '@/constants/websocketConstants';
import { WebSocketConnectionStatus } from '@/types/websocket';
import { ConnectionState } from '@/constants/connectionConstants';

/**
 * SingleSourceTrueConnections - A robust singleton manager for WebSocket connections
 * with reference counting to properly manage channel lifecycle
 */
export class SingleSourceTrueConnections {
  // Singleton instance
  private static instance: SingleSourceTrueConnections | null = null;
  
  // WebSocket service
  private webSocketService: WebSocketService;
  
  // Channel management
  private channels: Map<string, RealtimeChannel> = new Map();
  private channelListeners: Map<string, Map<string, Map<string, Function>>> = new Map(); // channelName -> eventName -> listenerId -> callback
  private channelRefCounts: Map<string, number> = new Map();
  
  // Session and connection state
  private currentSessionIdInternal: string | null = null;
  private connectionStatusInternal: WebSocketConnectionStatus = 'disconnected';
  private isServiceInitializedInternal: boolean = false;
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.webSocketService = new WebSocketService(supabase);
    this.initializeBaseListeners();
    logWithTimestamp('[SSTC] Singleton instance created', 'info');
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
   * Check if service is initialized
   */
  public isServiceInitialized(): boolean {
    return this.isServiceInitializedInternal;
  }
  
  /**
   * Initialize base listeners for WebSocket service
   */
  private initializeBaseListeners(): void {
    // Set up global connection event listeners
    // Note: These need to be adapted to match what WebSocketService actually provides
    
    // Connection opened handler
    this.webSocketService.onOpen = () => {
      this.isServiceInitializedInternal = true;
      this.connectionStatusInternal = 'connected';
      logWithTimestamp('[SSTC] WebSocket connection opened', 'info');
    };
    
    // Connection closed handler
    this.webSocketService.onClose = () => {
      this.isServiceInitializedInternal = false;
      this.connectionStatusInternal = 'disconnected';
      logWithTimestamp('[SSTC] WebSocket connection closed', 'info');
    };
    
    // Connection error handler
    this.webSocketService.onError = (error: any) => {
      this.connectionStatusInternal = 'error';
      logWithTimestamp(`[SSTC] WebSocket connection error: ${error}`, 'error');
    };
  }
}

/**
 * Helper function to get the singleton instance
 */
export const getSingleSourceConnection = (): SingleSourceTrueConnections => {
  return SingleSourceTrueConnections.getInstance();
};

// Export isServiceInitialized for backward compatibility
export function isServiceInitialized() {
  return getSingleSourceConnection().isServiceInitialized();
}
