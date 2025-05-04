import { supabase } from "@/integrations/supabase/client";
import { logWithTimestamp } from "@/utils/logUtils";

type ProgressCallback = (progress: any) => void;
type NumberCallback = (number: number, allNumbers: number[]) => void;
type PlayersCallback = (players: any[]) => void;

class ConnectionManager {
  private sessionId: string | null = null;
  private channel: any | null = null;
  private progressUpdateCallback: ProgressCallback | null = null;
  private numberCalledCallback: NumberCallback | null = null;
  private playersUpdateCallback: PlayersCallback | null = null;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private lastConnectionAttempt: number = 0;
  private connectionAttempts: number = 0;
  private reconnectTimer: any = null;
  private keepAliveInterval: any = null;
  private subscribedChannels: any[] = [];

  constructor() {
    logWithTimestamp("ConnectionManager created");
  }

  public initialize(sessionId: string) {
    if (this.sessionId === sessionId && this.channel) {
      logWithTimestamp(`Already initialized with session ID: ${sessionId}`);
      return this;
    }
    
    // Clean up existing connection if any
    this.cleanup();
    
    this.sessionId = sessionId;
    this.connectionState = 'connecting';
    this.lastConnectionAttempt = Date.now();
    this.connectionAttempts = 0;
    
    logWithTimestamp(`Initializing connection manager with session ID: ${sessionId}`);
    this.setupListeners();
    this.setupKeepAlive();
    
    return this;
  }

  public onSessionProgressUpdate(callback: ProgressCallback) {
    this.progressUpdateCallback = callback;
    return this;
  }

  public onNumberCalled(callback: NumberCallback) {
    this.numberCalledCallback = callback;
    return this;
  }
  
  public onPlayersUpdate(callback: PlayersCallback) {
    this.playersUpdateCallback = callback;
    this.setupPlayerMonitoring();
    return this;
  }

  private setupKeepAlive() {
    // Clear any existing keep-alive timer
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    
    // Set up a keep-alive ping every 30 seconds
    this.keepAliveInterval = setInterval(() => {
      if (this.connectionState !== 'connected') {
        logWithTimestamp("Keep-alive detected disconnected state, attempting to reconnect");
        this.reconnect();
        return;
      }
      
      // Send a keep-alive presence status update
      if (this.channel) {
        try {
          logWithTimestamp("Sending keep-alive ping");
          this.channel.send({
            type: 'broadcast',
            event: 'keep-alive',
            payload: {
              timestamp: Date.now()
            }
          }).catch((error: any) => {
            logWithTimestamp(`Keep-alive error: ${error}`);
            this.connectionState = 'error';
            this.reconnect();
          });
        } catch (error) {
          logWithTimestamp(`Exception in keep-alive: ${error}`);
          this.connectionState = 'error';
          this.reconnect();
        }
      }
    }, 30000);
  }

  private setupListeners() {
    if (!this.sessionId) {
      logWithTimestamp("Cannot setup listeners: no session ID");
      return;
    }

    this.cleanup(); // Clean up existing subscription before creating a new one

    logWithTimestamp(`Setting up listeners for session: ${this.sessionId}`);
    
    const channelName = `session-updates-${this.sessionId}`;
    
    this.channel = supabase
      .channel(channelName)
      .on(
        'broadcast',
        { event: 'number-called' },
        (payload) => {
          logWithTimestamp(`Received number broadcast: ${JSON.stringify(payload)}`);
          if (
            payload.payload &&
            payload.payload.sessionId === this.sessionId &&
            this.numberCalledCallback
          ) {
            const { lastCalledNumber, calledNumbers } = payload.payload;
            this.numberCalledCallback(lastCalledNumber, calledNumbers);
            this.connectionState = 'connected';
          }
        }
      )
      .on(
        'broadcast',
        { event: 'session-progress' },
        (payload) => {
          logWithTimestamp(`Received session progress broadcast: ${JSON.stringify(payload)}`);
          if (
            payload.payload &&
            payload.payload.sessionId === this.sessionId &&
            this.progressUpdateCallback
          ) {
            this.progressUpdateCallback(payload.payload);
            this.connectionState = 'connected';
          }
        }
      )
      .on(
        'presence', 
        { event: 'sync' }, 
        () => {
          logWithTimestamp("Presence synchronized");
          this.connectionState = 'connected';
        }
      )
      .subscribe((status, error) => {
        logWithTimestamp(`Channel subscription status: ${status}`);
        if (error) {
          logWithTimestamp(`Channel subscription error: ${JSON.stringify(error)}`);
          this.connectionState = 'error';
          this.handleConnectionFailure();
        } else if (status === 'SUBSCRIBED') {
          logWithTimestamp("Channel successfully subscribed");
          this.connectionState = 'connected';
          this.connectionAttempts = 0; // Reset attempts on successful connection
          
          // Track presence to help with connection monitoring
          this.channel.track({
            online_at: new Date().toISOString(),
            client_type: 'player'
          }).catch((err: any) => {
            logWithTimestamp(`Error tracking presence: ${err}`);
          });
          
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          logWithTimestamp(`Channel subscription failed with status: ${status}`);
          this.connectionState = 'error';
          this.handleConnectionFailure();
        } else {
          this.connectionState = 'connecting';
        }
      });
      
    this.subscribedChannels.push(this.channel);
  }
  
  private handleConnectionFailure() {
    this.connectionAttempts += 1;
    
    // Implement exponential backoff for reconnection attempts
    const backoffTime = Math.min(1000 * Math.pow(2, this.connectionAttempts), 30000); // Max 30 seconds
    
    logWithTimestamp(`Connection attempt ${this.connectionAttempts} failed. Retrying in ${backoffTime}ms`);
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnect();
    }, backoffTime);
  }
  
  private setupPlayerMonitoring() {
    if (!this.sessionId || !this.playersUpdateCallback) {
      return;
    }
    
    // Initial fetch
    this.fetchConnectedPlayers();
    
    // Set up polling
    setInterval(() => {
      this.fetchConnectedPlayers();
    }, 10000);
  }

  public async fetchConnectedPlayers() {
    if (!this.sessionId || !this.playersUpdateCallback) {
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, nickname, player_code')
        .eq('session_id', this.sessionId);
        
      if (error) {
        logWithTimestamp(`Error fetching players: ${JSON.stringify(error)}`);
        this.connectionState = 'error';
        return [];
      }
      
      if (data && this.playersUpdateCallback) {
        this.playersUpdateCallback(data);
      }
      
      return data || [];
    } catch (err) {
      logWithTimestamp(`Exception fetching players: ${err}`);
      this.connectionState = 'error';
      return [];
    }
  }
  
  public async fetchClaims() {
    if (!this.sessionId) {
      return [];
    }
    
    try {
      logWithTimestamp(`Fetching claims for session ${this.sessionId}`);
      
      // Use direct query instead of RPC
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', this.sessionId)
        .is('validated_at', null);
      
      if (error) {
        logWithTimestamp(`Error fetching claims: ${JSON.stringify(error)}`);
        this.connectionState = 'error';
        return [];
      }
      
      return data || [];
    } catch (err) {
      logWithTimestamp(`Exception fetching claims: ${err}`);
      this.connectionState = 'error';
      return [];
    }
  }

  public callNumber(number: number, sessionId?: string) {
    const targetSessionId = sessionId || this.sessionId;
    if (!targetSessionId) {
      logWithTimestamp("Cannot call number: no session ID");
      return;
    }
    
    logWithTimestamp(`Calling number ${number} for session ${targetSessionId}`);
    
    // Calculate the current called numbers
    this.fetchSessionProgress().then(progressData => {
      const currentCalledNumbers = progressData?.called_numbers || [];
      const updatedCalledNumbers = [...currentCalledNumbers, number];
      
      // Update the database
      supabase
        .from('sessions_progress')
        .update({ called_numbers: updatedCalledNumbers })
        .eq('session_id', targetSessionId)
        .then(({ error }) => {
          if (error) {
            logWithTimestamp(`Error updating called numbers: ${JSON.stringify(error)}`);
            this.connectionState = 'error';
          } else {
            logWithTimestamp(`Successfully updated called numbers in database`);
            this.connectionState = 'connected';
          }
        });
      
      // Broadcast the number in real-time
      supabase
        .channel('number-broadcast')
        .send({
          type: 'broadcast',
          event: 'number-called',
          payload: {
            sessionId: targetSessionId,
            lastCalledNumber: number,
            calledNumbers: updatedCalledNumbers,
            timestamp: new Date().getTime()
          }
        })
        .then(() => {
          logWithTimestamp(`Successfully broadcast number ${number}`);
          this.connectionState = 'connected';
        })
        .catch(err => {
          logWithTimestamp(`Error broadcasting number: ${err}`);
          this.connectionState = 'error';
        });
    });
  }

  private async fetchSessionProgress() {
    if (!this.sessionId) {
      return null;
    }
    
    try {
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('*')
        .eq('session_id', this.sessionId)
        .single();
        
      if (error) {
        logWithTimestamp(`Error fetching session progress: ${JSON.stringify(error)}`);
        this.connectionState = 'error';
        return null;
      }
      
      return data;
    } catch (err) {
      logWithTimestamp(`Exception fetching session progress: ${err}`);
      this.connectionState = 'error';
      return null;
    }
  }

  public reconnect() {
    logWithTimestamp("Attempting to reconnect");
    this.connectionState = 'connecting';
    this.lastConnectionAttempt = Date.now();
    
    // Clean up existing connection
    this.cleanup();
    
    // Set up new connection
    if (this.sessionId) {
      this.setupListeners();
    }
  }

  public cleanup() {
    // Clean up all subscribed channels
    this.subscribedChannels.forEach(channel => {
      try {
        logWithTimestamp(`Cleaning up channel`);
        supabase.removeChannel(channel);
      } catch (error) {
        logWithTimestamp(`Error cleaning up channel: ${error}`);
      }
    });
    
    // Reset subscribed channels array
    this.subscribedChannels = [];
    
    // Clear keep-alive interval
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.channel = null;
    this.connectionState = 'disconnected';
  }
  
  // Add method to get connection state
  public getConnectionState(): 'disconnected' | 'connecting' | 'connected' | 'error' {
    return this.connectionState;
  }
}

// Export a singleton instance
export const connectionManager = new ConnectionManager();
