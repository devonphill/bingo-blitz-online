
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from './logUtils';

// Define the type of callback functions
type NumberCalledCallback = (lastCalledNumber: number | null, calledNumbers: number[]) => void;
type PlayersUpdateCallback = (players: any[]) => void;
type SessionProgressUpdateCallback = (progress: any) => void;

class ConnectionManager {
  // Store the session ID and callbacks
  private sessionId: string | null = null;
  private numberCalledCallbacks: NumberCalledCallback[] = [];
  private playersUpdateCallbacks: PlayersUpdateCallback[] = [];
  private sessionProgressUpdateCallbacks: SessionProgressUpdateCallback[] = [];
  private channels: any[] = [];
  private isConnected = false;
  private initialized = false;
  private lastNumberBroadcast = Date.now();
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  
  // Initialize with a session ID
  initialize(sessionId: string) {
    if (this.sessionId === sessionId && this.initialized) {
      logWithTimestamp(`ConnectionManager already initialized for session ${sessionId}`);
      return this; // Already initialized for this session
    }
    
    logWithTimestamp(`Initializing ConnectionManager for session ${sessionId}`);
    
    // Clean up any existing channels if they exist
    this.cleanup();
    
    this.sessionId = sessionId;
    this.initialized = true;
    
    // Set up channels for number calls, player updates, and session progress
    this.setupChannels();
    
    // Set up database polling as a fallback
    this.setupPolling();
    
    return this;
  }
  
  // Set up the broadcast channels with improved error handling
  private setupChannels() {
    if (!this.sessionId) return;
    
    logWithTimestamp(`Setting up channels for session ${this.sessionId}`);
    
    try {
      // Create a single main channel for all game events
      const gameChannel = supabase.channel(`game-channel-${this.sessionId}`);
      gameChannel
        .on('broadcast', { event: 'number-called' }, payload => {
          if (payload.payload?.sessionId === this.sessionId) {
            logWithTimestamp(`Received number call: ${payload.payload.lastCalledNumber}, total numbers: ${payload.payload.calledNumbers?.length || 0}`);
            this.notifyNumberCalled(payload.payload.lastCalledNumber, payload.payload.calledNumbers || []);
          }
        })
        .on('broadcast', { event: 'players-update' }, payload => {
          if (payload.payload?.sessionId === this.sessionId) {
            logWithTimestamp(`Received players update for session ${this.sessionId}`);
            this.notifyPlayersUpdate(payload.payload.players || []);
          }
        })
        .on('broadcast', { event: 'session-progress' }, payload => {
          if (payload.payload?.sessionId === this.sessionId) {
            logWithTimestamp(`Received session progress update for session ${this.sessionId}`);
            this.notifySessionProgressUpdate(payload.payload);
          }
        })
        .on('broadcast', { event: 'claim-result' }, payload => {
          logWithTimestamp(`Received claim result: ${JSON.stringify(payload.payload)}`);
          // Just log this event for now - specific handling will be in the client components
        })
        .subscribe((status) => {
          logWithTimestamp(`Game channel status: ${status}`);
          this.isConnected = status === 'SUBSCRIBED';
          
          // If connection failed, schedule a single retry
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setTimeout(() => {
              logWithTimestamp(`Attempting to reconnect game channel after error`);
              // Only attempt to reconnect if we're still initialized
              if (this.initialized) {
                this.reconnect();
              }
            }, 5000);
          }
        });
      
      this.channels.push(gameChannel);
      
      // Also set up a dedicated claims channel
      const claimsChannel = supabase.channel(`claims-channel-${this.sessionId}`);
      claimsChannel
        .on('broadcast', { event: 'bingo-claim' }, payload => {
          if (payload.payload?.sessionId === this.sessionId) {
            logWithTimestamp(`Received bingo claim for session ${this.sessionId}`);
            // This will be handled by the claim verification component
          }
        })
        .subscribe();
      
      this.channels.push(claimsChannel);
      
    } catch (error) {
      console.error('Error setting up channels:', error);
      logWithTimestamp(`Error setting up channels: ${error}`);
    }
  }
  
  // Set up database polling as a fallback with improved error handling
  private setupPolling() {
    if (!this.sessionId) return;
    
    // Clear any existing polling interval
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    // Set up polling every 10 seconds
    this.pollingInterval = setInterval(async () => {
      try {
        // Only poll if we haven't received a broadcast recently
        if (Date.now() - this.lastNumberBroadcast > 8000) {
          logWithTimestamp(`Polling for session progress data for session ${this.sessionId}`);
          
          // Fetch session progress
          const { data: progressData, error: progressError } = await supabase
            .from('sessions_progress')
            .select('*')
            .eq('session_id', this.sessionId)
            .single();
            
          if (progressError) {
            console.error('Error fetching session progress:', progressError);
            return;
          }
          
          if (progressData) {
            this.notifySessionProgressUpdate(progressData);
            
            // If there are called numbers, notify about them
            if (progressData.called_numbers && progressData.called_numbers.length > 0) {
              const lastCalledNumber = progressData.called_numbers[progressData.called_numbers.length - 1];
              this.notifyNumberCalled(lastCalledNumber, progressData.called_numbers);
            }
          }
        }
      } catch (error) {
        console.error('Error during polling:', error);
      }
    }, 10000); // Poll every 10 seconds
  }
  
  // Clean up channels and reset state
  cleanup() {
    logWithTimestamp('Cleaning up ConnectionManager');
    
    // Clear polling interval if it exists
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    // Remove all channels with improved error handling
    if (this.channels.length > 0) {
      try {
        this.channels.forEach(channel => {
          if (channel) {
            if (typeof channel.unsubscribe === 'function') {
              channel.unsubscribe();
            } else {
              supabase.removeChannel(channel);
            }
          }
        });
      } catch (error) {
        console.error('Error removing channels:', error);
      }
    }
    
    this.channels = [];
    this.isConnected = false;
    this.initialized = false;
    this.sessionId = null;
  }
  
  // Register a callback for number calls
  onNumberCalled(callback: NumberCalledCallback) {
    this.numberCalledCallbacks.push(callback);
    return this;
  }
  
  // Register a callback for player updates
  onPlayersUpdate(callback: PlayersUpdateCallback) {
    this.playersUpdateCallbacks.push(callback);
    return this;
  }
  
  // Register a callback for session progress updates
  onSessionProgressUpdate(callback: SessionProgressUpdateCallback) {
    this.sessionProgressUpdateCallbacks.push(callback);
    return this;
  }
  
  // Notify all callbacks about a number call
  private notifyNumberCalled(lastCalledNumber: number, calledNumbers: number[]) {
    this.lastNumberBroadcast = Date.now();
    this.numberCalledCallbacks.forEach(callback => callback(lastCalledNumber, calledNumbers));
  }
  
  // Notify all callbacks about player updates
  private notifyPlayersUpdate(players: any[]) {
    this.playersUpdateCallbacks.forEach(callback => callback(players));
  }
  
  // Notify all callbacks about session progress updates
  private notifySessionProgressUpdate(progress: any) {
    this.sessionProgressUpdateCallbacks.forEach(callback => callback(progress));
  }
  
  // Manually call a number with improved error handling
  callNumber(number: number, sessionId?: string) {
    if (!this.sessionId && !sessionId) {
      logWithTimestamp('Cannot call number: no session ID');
      return;
    }
    
    const targetSessionId = sessionId || this.sessionId;
    logWithTimestamp(`Calling number ${number} for session ${targetSessionId}`);
    
    // Get current called numbers from database
    supabase
      .from('sessions_progress')
      .select('called_numbers')
      .eq('session_id', targetSessionId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching current called numbers:', error);
          return;
        }
        
        // Add new number to the array
        const calledNumbers = data?.called_numbers || [];
        if (!calledNumbers.includes(number)) {
          calledNumbers.push(number);
        }
        
        // Update the database
        supabase
          .from('sessions_progress')
          .update({ 
            called_numbers: calledNumbers,
            updated_at: new Date().toISOString()
          })
          .eq('session_id', targetSessionId)
          .then(({ error: updateError }) => {
            if (updateError) {
              console.error('Error updating called numbers:', updateError);
              return;
            }
            
            // Broadcast the number call
            this.broadcastNumberCall(number, calledNumbers, targetSessionId);
          });
      });
  }
  
  // Broadcast a number call to all channels with improved error handling
  private broadcastNumberCall(lastCalledNumber: number, calledNumbers: number[], sessionId: string) {
    logWithTimestamp(`Broadcasting number call: ${lastCalledNumber}, total numbers: ${calledNumbers.length}`);
    
    const payload = {
      lastCalledNumber,
      calledNumbers,
      sessionId,
      timestamp: new Date().toISOString()
    };
    
    // Fix the Promise chain by using a proper async/await pattern
    try {
      const channel = supabase.channel(`game-channel-${sessionId}`);
      
      // Convert the send operation into a proper Promise using an async function
      const sendBroadcast = async () => {
        try {
          await channel.send({
            type: 'broadcast',
            event: 'number-called',
            payload
          });
          logWithTimestamp('Number call broadcast successful');
        } catch (error) {
          console.error('Error broadcasting number call:', error);
          logWithTimestamp(`Error broadcasting number call: ${error}`);
        }
      };
      
      // Execute the async function
      sendBroadcast();
      
      // Also notify local callbacks
      this.notifyNumberCalled(lastCalledNumber, calledNumbers);
    } catch (error) {
      console.error('Error in broadcastNumberCall:', error);
      logWithTimestamp(`Error in broadcastNumberCall: ${error}`);
    }
  }
  
  // Fetch claims for the current session with improved error handling
  async fetchClaims() {
    if (!this.sessionId) {
      logWithTimestamp('Cannot fetch claims: no session ID');
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', this.sessionId)
        .is('validated_at', null)
        .not('claimed_at', 'is', null);
        
      if (error) {
        console.error('Error fetching claims:', error);
        logWithTimestamp(`Error fetching claims: ${error}`);
        return [];
      }
      
      logWithTimestamp(`Fetched ${data?.length || 0} pending claims`);
      return data || [];
    } catch (error) {
      console.error('Error fetching claims:', error);
      logWithTimestamp(`Error in fetchClaims: ${error}`);
      return [];
    }
  }
  
  // Reconnect all channels with improved error handling
  reconnect() {
    if (!this.sessionId) {
      logWithTimestamp('Cannot reconnect: no session ID');
      return;
    }
    
    logWithTimestamp(`Reconnecting ConnectionManager for session ${this.sessionId}`);
    
    try {
      // Clean up existing channels but keep session ID
      const sessionIdToReconnect = this.sessionId;
      
      // Remove channels but don't reset session/initialized state
      if (this.channels.length > 0) {
        this.channels.forEach(channel => {
          if (channel) {
            try {
              if (typeof channel.unsubscribe === 'function') {
                channel.unsubscribe();
              } else {
                supabase.removeChannel(channel);
              }
            } catch (err) {
              console.error('Error removing channel during reconnect:', err);
            }
          }
        });
      }
      
      this.channels = [];
      
      // Clear polling interval if it exists
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
      
      // Re-setup channels and polling
      this.setupChannels();
      this.setupPolling();
      
      // Force a database refresh using proper async/await pattern
      const refreshData = async () => {
        try {
          const { data } = await supabase
            .from('sessions_progress')
            .select('*')
            .eq('session_id', sessionIdToReconnect)
            .single();
            
          if (data) {
            this.notifySessionProgressUpdate(data);
            
            if (data.called_numbers && data.called_numbers.length > 0) {
              const lastCalledNumber = data.called_numbers[data.called_numbers.length - 1];
              this.notifyNumberCalled(lastCalledNumber, data.called_numbers);
            }
          }
        } catch (error) {
          console.error('Error during reconnection data fetch:', error);
          logWithTimestamp(`Error during reconnection data fetch: ${error}`);
        }
      };
      
      // Execute the async function
      refreshData();
        
    } catch (error) {
      console.error('Error during reconnect:', error);
      logWithTimestamp(`Error during reconnect: ${error}`);
    }
  }
  
  // Validate a claim from a player
  validateClaim(claim: any, isValid: boolean) {
    if (!this.sessionId) {
      logWithTimestamp('Cannot validate claim: no session ID');
      return;
    }
    
    logWithTimestamp(`Validating claim for player ${claim.playerName || claim.player_name}, isValid: ${isValid}`);
    
    try {
      // Update the claim in the database using async/await pattern
      const processClaim = async () => {
        try {
          // First update the database
          const { error } = await supabase
            .from('universal_game_logs')
            .update({
              validated_at: new Date().toISOString(),
              prize_shared: isValid
            })
            .eq('id', claim.id);
            
          if (error) {
            console.error('Error validating claim:', error);
            return;
          }
          
          // Then broadcast the result
          const broadcastChannel = supabase.channel(`game-channel-${this.sessionId}`);
          
          try {
            await broadcastChannel.send({
              type: 'broadcast',
              event: 'claim-result',
              payload: {
                playerId: claim.player_id || claim.playerId,
                sessionId: this.sessionId,
                result: isValid ? 'valid' : 'rejected',
                timestamp: new Date().toISOString()
              }
            });
            
            logWithTimestamp(`Claim result broadcast successful: ${isValid ? 'valid' : 'rejected'}`);
          } catch (err) {
            console.error('Error broadcasting claim result:', err);
            logWithTimestamp(`Error broadcasting claim result: ${err}`);
          }
        } catch (err) {
          console.error('Error in validateClaim:', err);
          logWithTimestamp(`Error in validateClaim: ${err}`);
        }
      };
      
      // Execute the async function
      processClaim();
    } catch (error) {
      console.error('Error in validateClaim:', error);
      logWithTimestamp(`Error in validateClaim: ${error}`);
    }
  }
}

// Create a singleton instance
export const connectionManager = new ConnectionManager();
