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
  private connectionStatusInternal: WebSocketConnectionStatus = CONNECTION_STATES.DISCONNECTED;
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
    this.webSocketService.subscribeWithReconnect(systemChannelName, (supabaseStatus) => {
      // Map Supabase status to our internal WebSocketConnectionStatus
      let newInternalStatus: WebSocketConnectionStatus = CONNECTION_STATES.UNKNOWN; // Default to unknown
      let newServiceReadyState = false;
      
      // Map Supabase status strings to our internal connection states
      switch (supabaseStatus) {
        case 'SUBSCRIBED':
          newInternalStatus = CONNECTION_STATES.CONNECTED;
          newServiceReadyState = true;
          logWithTimestamp(`[SSTC] WebSocket connection opened. Service initialized. State: ${newInternalStatus}`, 'info');
          break;
          
        case 'CLOSED':
          newInternalStatus = CONNECTION_STATES.DISCONNECTED;
          newServiceReadyState = false;
          logWithTimestamp(`[SSTC] WebSocket connection closed. Service not initialized. State: ${newInternalStatus}`, 'warn');
          break;
          
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
          newInternalStatus = CONNECTION_STATES.ERROR;
          newServiceReadyState = false;
          logWithTimestamp(`[SSTC] WebSocket connection error. State: ${newInternalStatus}. Status: ${supabaseStatus}`, 'error');
          break;
          
        case 'JOINING':
        case 'CONNECTING':
          newInternalStatus = CONNECTION_STATES.CONNECTING;
          newServiceReadyState = false;
          logWithTimestamp(`[SSTC] WebSocket connection in progress. State: ${newInternalStatus}. Status: ${supabaseStatus}`, 'info');
          break;
          
        default:
          // For any other unhandled statuses
          newInternalStatus = CONNECTION_STATES.UNKNOWN;
          newServiceReadyState = false;
          logWithTimestamp(`[SSTC] Unhandled WebSocket status: ${supabaseStatus}`, 'info');
          break;
      }
      
      // Update internal state with the mapped values
      this.connectionStatusInternal = newInternalStatus;
      this.isServiceInitializedInternal = newServiceReadyState;
      
      // TODO: this.notifyConnectionListeners(newServiceReadyState, newInternalStatus);
    });
    
    // Register for window online/offline events to handle network disconnections
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        // When browser comes online, set state to connecting as reconnection might be attempted
        this.connectionStatusInternal = CONNECTION_STATES.CONNECTING;
        logWithTimestamp('[SSTC] Browser online. Connection state set to: ' + this.connectionStatusInternal + 
          '. Attempting to reconnect if session was active.', 'info');
        // Will implement reconnection logic in a future step
      });
      
      window.addEventListener('offline', () => {
        this.isServiceInitializedInternal = false;
        this.connectionStatusInternal = CONNECTION_STATES.DISCONNECTED;
        logWithTimestamp('[SSTC] Browser offline. Connection state: ' + this.connectionStatusInternal, 'warn');
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
