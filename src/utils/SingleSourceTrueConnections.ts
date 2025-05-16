
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { ConnectionState } from '@/constants/connectionConstants';
import { EVENT_TYPES } from '@/constants/websocketConstants';

// Type definitions
type NumberCalledHandler = (number: number | null, allNumbers: number[]) => void;
type ConnectionStatusListener = (connected: boolean) => void;
type SessionProgressListener = (progress: any) => void;
type EventListener<T> = (data: T) => void;

// Define channels
const WEBSOCKET_CHANNELS = {
  GAME_UPDATES: 'game-updates',
  CLAIM_UPDATES: 'claim-updates',
  CLAIM_CHECKING: 'claim-checking',
  PRESENCE: 'presence'
};

// Define events (for backward compatibility)
const WEBSOCKET_EVENTS = {
  NUMBER_CALLED: EVENT_TYPES.NUMBER_CALLED,
  GAME_STATE_CHANGED: EVENT_TYPES.GAME_STATE_UPDATE,
  CLAIM_SUBMITTED: EVENT_TYPES.CLAIM_SUBMITTED,
  CLAIM_VALIDATED: EVENT_TYPES.CLAIM_VALIDATION
};

/**
 * Singleton class for managing WebSocket connections and events
 */
class SingleSourceConnection {
  private static instance: SingleSourceConnection | null = null;
  private sessionId: string | null = null;
  private webSocketService: any = null;
  private isConnectedFlag: boolean = false;
  private connectionListeners: ConnectionStatusListener[] = [];
  private numberCalledHandlers: NumberCalledHandler[] = [];
  private sessionProgressListeners: SessionProgressListener[] = [];
  private eventListeners: Map<string, EventListener<any>[]> = new Map();
  private lastPingTime: number | null = null;
  private connectionState: ConnectionState = 'disconnected';
  
  // Event types for reference
  public static EVENT_TYPES = EVENT_TYPES;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    logWithTimestamp('SingleSourceConnection: Initializing singleton instance', 'info');
    this.initHeartbeat();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SingleSourceConnection {
    if (!SingleSourceConnection.instance) {
      SingleSourceConnection.instance = new SingleSourceConnection();
    }
    return SingleSourceConnection.instance;
  }

  /**
   * Initialize heartbeat to track connection status
   */
  private initHeartbeat() {
    setInterval(() => {
      this.lastPingTime = Date.now();
    }, 30000); // 30-second ping interval
  }

  /**
   * Get WebSocket service (exposed as public for compatibility)
   */
  public getWebSocketService() {
    if (!this.webSocketService) {
      this.webSocketService = {
        channels: new Map(),
        connect: this.connect.bind(this),
        isConnected: this.isConnected.bind(this),
        broadcastWithRetry: this.broadcastWithRetry.bind(this)
      };
    }
    return this.webSocketService;
  }

  /**
   * Broadcast with retry functionality
   */
  public broadcastWithRetry(channel: string, event: string, payload: any, options = {}) {
    try {
      const channelObj = supabase.channel(channel);
      
      channelObj.send({
        type: 'broadcast',
        event: event,
        payload: payload
      });
      
      return true;
    } catch (error) {
      logWithTimestamp(`SingleSourceConnection: Error broadcasting message: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Check if service is initialized
   */
  public isServiceInitialized(): boolean {
    return this.webSocketService !== null;
  }

  /**
   * Connect to a session
   */
  public connect(sessionId: string) {
    if (!sessionId) {
      logWithTimestamp('SingleSourceConnection: Cannot connect, no session ID provided', 'error');
      return this;
    }

    logWithTimestamp(`SingleSourceConnection: Connecting to session ${sessionId}`, 'info');
    
    this.sessionId = sessionId;
    this.setConnectionState('connecting');
    
    // Create the primary game updates channel if it doesn't exist
    if (!this.hasChannel(WEBSOCKET_CHANNELS.GAME_UPDATES)) {
      try {
        const channel = supabase
          .channel(WEBSOCKET_CHANNELS.GAME_UPDATES)
          .on('broadcast', { event: WEBSOCKET_EVENTS.NUMBER_CALLED }, (payload) => {
            this.handleNumberCalled(payload);
          })
          .on('broadcast', { event: WEBSOCKET_EVENTS.GAME_STATE_CHANGED }, (payload) => {
            this.handleGameStateUpdate(payload);
          })
          .subscribe((status) => {
            logWithTimestamp(`SingleSourceConnection: Game updates channel status: ${status}`, 'info');
            const isConnected = status === 'SUBSCRIBED';
            this.setIsConnected(isConnected);
            this.setConnectionState(isConnected ? 'connected' : 'disconnected');
          });
          
        this.registerChannel(WEBSOCKET_CHANNELS.GAME_UPDATES, channel);
      } catch (error) {
        logWithTimestamp(`SingleSourceConnection: Error creating game updates channel: ${error}`, 'error');
        this.setConnectionState('error');
      }
    }
    
    // Set last ping time on connect
    this.lastPingTime = Date.now();
    
    return this;
  }

  /**
   * Reconnect to current session
   */
  public reconnect(): void {
    if (this.sessionId) {
      logWithTimestamp(`SingleSourceConnection: Reconnecting to session ${this.sessionId}`, 'info');
      
      // Close all existing channels
      this.closeAllChannels();
      
      // Reconnect
      this.connect(this.sessionId);
    } else {
      logWithTimestamp('SingleSourceConnection: Cannot reconnect, no session ID available', 'warn');
    }
  }

  /**
   * Check if a channel exists
   */
  private hasChannel(channelName: string): boolean {
    return this.webSocketService?.channels?.has(channelName) || false;
  }

  /**
   * Register a channel
   */
  private registerChannel(channelName: string, channel: any): void {
    if (!this.webSocketService) {
      this.getWebSocketService();
    }
    
    if (!this.webSocketService.channels) {
      this.webSocketService.channels = new Map();
    }
    
    this.webSocketService.channels.set(channelName, channel);
  }

  /**
   * Close all channels
   */
  private closeAllChannels(): void {
    if (this.webSocketService?.channels) {
      this.webSocketService.channels.forEach((channel, name) => {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          logWithTimestamp(`SingleSourceConnection: Error closing channel ${name}: ${error}`, 'error');
        }
      });
      
      this.webSocketService.channels.clear();
    }
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.isConnectedFlag;
  }

  /**
   * Set connection status and notify listeners
   */
  private setIsConnected(connected: boolean): void {
    if (this.isConnectedFlag !== connected) {
      this.isConnectedFlag = connected;
      this.notifyConnectionListeners(connected);
    }
  }

  /**
   * Set connection state
   */
  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
  }

  /**
   * Get connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get last ping time
   */
  public getLastPing(): number | null {
    return this.lastPingTime;
  }

  /**
   * Add connection listener
   */
  public addConnectionListener(listener: ConnectionStatusListener): () => void {
    this.connectionListeners.push(listener);
    
    // Call immediately with current status
    listener(this.isConnectedFlag);
    
    return () => {
      this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all connection listeners
   */
  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        logWithTimestamp(`SingleSourceConnection: Error in connection listener: ${error}`, 'error');
      }
    });
  }

  /**
   * Listen for number called events
   */
  public onNumberCalled(handler: NumberCalledHandler): () => void {
    this.numberCalledHandlers.push(handler);
    
    return () => {
      this.numberCalledHandlers = this.numberCalledHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Handle number called event
   */
  private handleNumberCalled(payload: any): void {
    if (!payload || !payload.payload) return;
    
    const { number, calledNumbers } = payload.payload;
    
    this.numberCalledHandlers.forEach(handler => {
      try {
        handler(number, calledNumbers || []);
      } catch (error) {
        logWithTimestamp(`SingleSourceConnection: Error in number called handler: ${error}`, 'error');
      }
    });
  }

  /**
   * Listen for session progress updates
   */
  public onSessionProgressUpdate(listener: SessionProgressListener): () => void {
    this.sessionProgressListeners.push(listener);
    
    return () => {
      this.sessionProgressListeners = this.sessionProgressListeners.filter(l => l !== listener);
    };
  }

  /**
   * Handle game state update
   */
  private handleGameStateUpdate(payload: any): void {
    if (!payload || !payload.payload) return;
    
    this.sessionProgressListeners.forEach(listener => {
      try {
        listener(payload.payload);
      } catch (error) {
        logWithTimestamp(`SingleSourceConnection: Error in session progress listener: ${error}`, 'error');
      }
    });
  }

  /**
   * Listen for specific event
   */
  public listenForEvent<T>(eventType: string, handler: (data: T) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    
    this.eventListeners.get(eventType)!.push(handler);
    
    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        this.eventListeners.set(eventType, listeners.filter(h => h !== handler));
      }
    };
  }

  /**
   * Call a number
   */
  public async callNumber(number: number, sessionId?: string): Promise<boolean> {
    const targetSessionId = sessionId || this.sessionId;
    
    if (!targetSessionId) {
      logWithTimestamp('SingleSourceConnection: Cannot call number, no session ID available', 'error');
      return false;
    }
    
    try {
      logWithTimestamp(`SingleSourceConnection: Calling number ${number} for session ${targetSessionId}`, 'info');
      
      // Update called numbers in the database
      const { data: progressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', targetSessionId)
        .single();
      
      if (progressError) {
        throw new Error(`Failed to get session progress: ${progressError.message}`);
      }
      
      // Check if number is already called
      const calledNumbers = progressData?.called_numbers || [];
      if (calledNumbers.includes(number)) {
        logWithTimestamp(`SingleSourceConnection: Number ${number} already called for session ${targetSessionId}`, 'warn');
        return true; // Already called, consider it successful
      }
      
      // Add the number to called numbers
      const updatedCalledNumbers = [...calledNumbers, number];
      
      // Update database
      const { error: updateError } = await supabase
        .from('sessions_progress')
        .update({ 
          called_numbers: updatedCalledNumbers,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', targetSessionId);
      
      if (updateError) {
        throw new Error(`Failed to update called numbers: ${updateError.message}`);
      }
      
      // Broadcast to all players via the game updates channel
      this.broadcastNumberCalled(targetSessionId, number, updatedCalledNumbers);
      
      return true;
    } catch (error) {
      logWithTimestamp(`SingleSourceConnection: Error calling number: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Broadcast number called event
   */
  public broadcastNumberCalled(sessionId: string, number: number, calledNumbers: number[]): void {
    try {
      const channel = supabase.channel(WEBSOCKET_CHANNELS.GAME_UPDATES);
      
      channel.send({
        type: 'broadcast',
        event: EVENT_TYPES.NUMBER_CALLED,
        payload: {
          sessionId,
          number,
          calledNumbers,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      logWithTimestamp(`SingleSourceConnection: Error broadcasting number called: ${error}`, 'error');
    }
  }

  /**
   * Submit a bingo claim
   */
  public submitBingoClaim(ticket: any, playerCode: string, sessionId: string): boolean {
    if (!ticket || !playerCode || !sessionId) {
      logWithTimestamp('SingleSourceConnection: Cannot submit claim, missing required parameters', 'error');
      return false;
    }
    
    try {
      logWithTimestamp(`SingleSourceConnection: Submitting bingo claim for player ${playerCode} in session ${sessionId}`, 'info');
      
      const channel = supabase.channel(WEBSOCKET_CHANNELS.CLAIM_UPDATES);
      
      channel.send({
        type: 'broadcast',
        event: EVENT_TYPES.CLAIM_SUBMITTED,
        payload: {
          sessionId,
          playerCode,
          ticket,
          timestamp: Date.now()
        }
      });
      
      return true;
    } catch (error) {
      logWithTimestamp(`SingleSourceConnection: Error submitting bingo claim: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Set up number update listeners
   */
  public setupNumberUpdateListeners(
    sessionId: string, 
    onNumberUpdate: (number: number, numbers: number[]) => void,
    onGameReset: () => void,
    instanceId: string
  ): () => void {
    const numberCleanup = this.onNumberCalled((number, calledNumbers) => {
      if (number !== null) {
        onNumberUpdate(number, calledNumbers);
      }
    });
    
    const resetCleanup = this.listenForEvent(EVENT_TYPES.GAME_RESET, () => {
      onGameReset();
    });
    
    return () => {
      numberCleanup();
      resetCleanup();
    };
  }
}

/**
 * Get singleton instance of SingleSourceConnection
 */
export const getSingleSourceConnection = (): SingleSourceConnection => {
  return SingleSourceConnection.getInstance();
};

// Export isServiceInitialized for backward compatibility
export function isServiceInitialized() {
  return getSingleSourceConnection().isServiceInitialized();
}
