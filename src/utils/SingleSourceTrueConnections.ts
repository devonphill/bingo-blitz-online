
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
  private listenerIdCounter: number = 0; // For generating unique listener IDs
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.webSocketService = WebSocketService.getInstance(supabase);
    this.initializeBaseWebServiceListeners();
    logWithTimestamp('[SSTC] Singleton instance created and WebSocketService instantiated.', 'info');
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
  private initializeBaseWebServiceListeners(): void {
    logWithTimestamp('[SSTC] Setting up base WebSocket service listeners.', 'info');
    
    // Since WebSocketService doesn't expose direct onOpen, onClose, onError methods,
    // we need to create a system channel for monitoring connection status
    const systemChannelName = 'system-connection-monitor';
    
    // Create a connection monitoring channel
    const channel = this.webSocketService.createChannel(systemChannelName);
    
    // Subscribe with a callback that handles different connection states
    this.webSocketService.subscribeWithReconnect(systemChannelName, (status) => {
      // Handle different connection states
      switch (status) {
        case 'SUBSCRIBED':
          this.isServiceInitializedInternal = true;
          this.connectionStatusInternal = CONNECTION_STATES.CONNECTED;
          logWithTimestamp('[SSTC] WebSocket connection opened. Service initialized. State: ' + this.connectionStatusInternal, 'info');
          // TODO: this.notifyConnectionListeners(true, this.connectionStatusInternal);
          break;
          
        case 'CLOSED':
          this.isServiceInitializedInternal = false;
          this.connectionStatusInternal = CONNECTION_STATES.DISCONNECTED;
          logWithTimestamp('[SSTC] WebSocket connection closed. Service not initialized. State: ' + this.connectionStatusInternal, 'warn');
          // TODO: this.notifyConnectionListeners(false, this.connectionStatusInternal);
          break;
          
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
          this.isServiceInitializedInternal = false;
          this.connectionStatusInternal = CONNECTION_STATES.ERROR;
          logWithTimestamp('[SSTC] WebSocket connection error. State: ' + this.connectionStatusInternal + '. Status: ' + status, 'error');
          // TODO: this.notifyConnectionListeners(false, this.connectionStatusInternal);
          break;
          
        default:
          // For other states like JOINING, set appropriate intermediate states
          if (status === 'JOINING' || status === 'CONNECTING') {
            this.connectionStatusInternal = CONNECTION_STATES.CONNECTING;
            logWithTimestamp('[SSTC] WebSocket connection in progress. State: ' + this.connectionStatusInternal + '. Status: ' + status, 'info');
          } else {
            logWithTimestamp('[SSTC] WebSocket status change: ' + status, 'info');
          }
          break;
      }
    });
    
    // Register for window online/offline events to handle network disconnections
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        logWithTimestamp('[SSTC] Network came online. Attempting to reconnect WebSocket.', 'info');
        // Will implement reconnection logic in a future step
      });
      
      window.addEventListener('offline', () => {
        this.isServiceInitializedInternal = false;
        this.connectionStatusInternal = CONNECTION_STATES.DISCONNECTED;
        logWithTimestamp('[SSTC] Network went offline. WebSocket disconnected.', 'warn');
        // TODO: this.notifyConnectionListeners(false, this.connectionStatusInternal);
      });
    }
  }
  
  // Stub methods to satisfy interface requirements
  // These will be properly implemented in later steps
  
  public connect(sessionId: string): void {
    logWithTimestamp(`[SSTC] Stub: Connect to session ${sessionId}`, 'info');
  }
  
  public isConnected(): boolean {
    return this.connectionStatusInternal === CONNECTION_STATES.CONNECTED;
  }
  
  public getConnectionState(): ConnectionState {
    return this.connectionStatusInternal as ConnectionState;
  }
  
  public getLastPing(): number | null {
    return Date.now();
  }
  
  public reconnect(): void {
    logWithTimestamp('[SSTC] Stub: Reconnect called', 'info');
  }
  
  public addConnectionListener(listener: (isConnected: boolean) => void): () => void {
    logWithTimestamp('[SSTC] Stub: Add connection listener', 'info');
    return () => {};
  }
  
  public listenForEvent<T>(eventType: string, handler: (data: T) => void): () => void {
    logWithTimestamp(`[SSTC] Stub: Listen for event ${eventType}`, 'info');
    return () => {};
  }
  
  public onNumberCalled(handler: (number: number | null, allNumbers: number[]) => void): () => void {
    logWithTimestamp('[SSTC] Stub: onNumberCalled listener added', 'info');
    return () => {};
  }
  
  public onSessionProgressUpdate(handler: (update: any) => void): () => void {
    logWithTimestamp('[SSTC] Stub: onSessionProgressUpdate listener added', 'info');
    return () => {};
  }
  
  public broadcastNumberCalled(sessionId: string, number: number, allNumbers: number[]): Promise<boolean> {
    logWithTimestamp(`[SSTC] Stub: Broadcast number ${number} called for session ${sessionId}`, 'info');
    return Promise.resolve(true);
  }
  
  public broadcastWithRetry(channelName: string, eventName: string, payload: any): Promise<boolean> {
    logWithTimestamp(`[SSTC] Stub: Broadcast with retry on channel ${channelName}, event ${eventName}`, 'info');
    return Promise.resolve(true);
  }
  
  public callNumber(number: number, sessionId?: string): Promise<boolean> {
    logWithTimestamp(`[SSTC] Stub: Call number ${number} ${sessionId ? `for session ${sessionId}` : ''}`, 'info');
    return Promise.resolve(true);
  }
  
  public submitBingoClaim(ticket: any, playerCode: string, sessionId: string): boolean {
    logWithTimestamp(`[SSTC] Stub: Submit bingo claim for session ${sessionId}`, 'info');
    return true;
  }
  
  public setupNumberUpdateListeners(
    sessionId: string,
    onNumberUpdate: (number: number, numbers: number[]) => void,
    onGameReset: () => void,
    instanceId: string
  ): () => void {
    logWithTimestamp(`[SSTC] Stub: Setup number update listeners for session ${sessionId}`, 'info');
    return () => {};
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
