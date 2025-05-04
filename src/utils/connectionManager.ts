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
  private isInitializing: boolean = false;

  constructor() {
    logWithTimestamp("ConnectionManager created");
  }

  public initialize(sessionId: string) {
    if (this.isInitializing) {
      logWithTimestamp(`Already in the process of initializing session ID: ${sessionId}, avoiding duplicate initialization`);
      return this;
    }
    
    if (this.sessionId === sessionId && this.channel && this.connectionState === 'connected') {
      logWithTimestamp(`Already initialized and connected with session ID: ${sessionId}`);
      return this;
    }
    
    this.isInitializing = true;
    
    // Clean up existing connection if any
    this.cleanup();
    
    this.sessionId = sessionId;
    this.connectionState = 'connecting';
    this.lastConnectionAttempt = Date.now();
    this.connectionAttempts = 0;
    
    logWithTimestamp(`Initializing connection manager with session ID: ${sessionId}`);
    this.setupListeners();
    this.setupKeepAlive();
    
    // Set a timeout to clear the initializing flag if something goes wrong
    setTimeout(() => {
      this.isInitializing = false;
    }, 10000); // 10 seconds timeout
    
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
          }).then(() => {
            // Keep-alive sent successfully
          }, (error: any) => {
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
      this.isInitializing = false;
      return;
    }

    // Clean up existing subscriptions before creating new ones
    this.subscribedChannels.forEach(channel => {
      try {
        supabase.removeChannel(channel);
      } catch (error) {
        console.error("Error removing channel:", error);
      }
    });
    this.subscribedChannels = [];

    logWithTimestamp(`Setting up listeners for session: ${this.sessionId}`);
    
    // Use multiple channels for redundancy
    const channelNames = [
      `session-updates-${this.sessionId}`,
      `number-broadcast-${this.sessionId}`,
      'number-broadcast'
    ];
    
    // Subscribe to all channels for redundancy
    channelNames.forEach((channelName, index) => {
      const channel = supabase.channel(channelName);
      
      channel
        .on(
          'broadcast',
          { event: 'number-called' },
          (payload) => {
            if (
              payload.payload &&
              payload.payload.sessionId === this.sessionId &&
              this.numberCalledCallback
            ) {
              const { lastCalledNumber, calledNumbers } = payload.payload;
              logWithTimestamp(`Received number broadcast on channel ${channelName}: ${lastCalledNumber}`);
              this.numberCalledCallback(lastCalledNumber, calledNumbers);
              this.connectionState = 'connected';
              this.isInitializing = false;
            }
          }
        )
        .on(
          'broadcast',
          { event: 'session-progress' },
          (payload) => {
            if (
              payload.payload &&
              payload.payload.sessionId === this.sessionId &&
              this.progressUpdateCallback
            ) {
              logWithTimestamp(`Received session progress broadcast: ${JSON.stringify(payload)}`);
              this.progressUpdateCallback(payload.payload);
              this.connectionState = 'connected';
              this.isInitializing = false;
            }
          }
        )
        .subscribe((status, error) => {
          logWithTimestamp(`Channel ${channelName} subscription status: ${status}`);
          if (error) {
            logWithTimestamp(`Channel ${channelName} subscription error: ${JSON.stringify(error)}`);
            
            // Only set connection error if all channels have failed
            if (index === channelNames.length - 1) {
              this.connectionState = 'error';
              this.handleConnectionFailure();
            }
          } else if (status === 'SUBSCRIBED') {
            logWithTimestamp(`Channel ${channelName} successfully subscribed`);
            this.connectionState = 'connected';
            this.connectionAttempts = 0; // Reset attempts on successful connection
            this.isInitializing = false;
            
            // Track this channel
            this.subscribedChannels.push(channel);
            
            // If this is the primary channel, store it directly
            if (index === 0) {
              this.channel = channel;
            }
          }
        });
        
      // For the primary channel, also set up presence tracking
      if (index === 0) {
        channel.track({
          online_at: new Date().toISOString(),
          client_type: 'player'
        }).then(() => {
          logWithTimestamp("Presence tracking established");
        }, (err) => {
          logWithTimestamp(`Error tracking presence: ${err}`);
        });
      }
    });
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
    
    this.isInitializing = false;
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
    
    if (this.isInitializing) {
      logWithTimestamp("Already initializing connection, skipping redundant reconnect");
      return;
    }
    
    this.isInitializing = true;
    this.connectionState = 'connecting';
    this.lastConnectionAttempt = Date.now();
    
    // Clean up existing connection
    this.cleanup();
    
    // Set up new connection
    if (this.sessionId) {
      this.setupListeners();
    }
    
    // Set a timeout to clear the initializing flag if something goes wrong
    setTimeout(() => {
      this.isInitializing = false;
    }, 10000); // 10 seconds timeout
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
    this.isInitializing = false;
  }
  
  // Add method to get connection state
  public getConnectionState(): 'disconnected' | 'connecting' | 'connected' | 'error' {
    return this.connectionState;
  }
}

// Export a singleton instance
export const connectionManager = new ConnectionManager();
