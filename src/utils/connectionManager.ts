
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
    
    // Set up database polling
    this.setupPolling();
    
    return this;
  }
  
  // Set up the broadcast channels
  private setupChannels() {
    if (!this.sessionId) return;
    
    logWithTimestamp(`Setting up channels for session ${this.sessionId}`);
    
    // Create primary number broadcast channel
    const numberBroadcastChannel = supabase.channel('number-broadcast');
    numberBroadcastChannel
      .on('broadcast', { event: 'number-called' }, payload => {
        if (payload.payload?.sessionId === this.sessionId) {
          logWithTimestamp(`Received number call: ${payload.payload.lastCalledNumber}, total numbers: ${payload.payload.calledNumbers?.length || 0}`);
          this.notifyNumberCalled(payload.payload.lastCalledNumber, payload.payload.calledNumbers || []);
        }
      })
      .subscribe((status) => {
        logWithTimestamp(`Number broadcast channel status: ${status}`);
        this.isConnected = status === 'SUBSCRIBED';
      });
    
    // Create backup channel specific to this session
    const sessionNumberChannel = supabase.channel(`number-broadcast-${this.sessionId}`);
    sessionNumberChannel
      .on('broadcast', { event: 'number-called' }, payload => {
        if (payload.payload?.sessionId === this.sessionId) {
          logWithTimestamp(`[Backup] Received number call: ${payload.payload.lastCalledNumber}`);
          this.notifyNumberCalled(payload.payload.lastCalledNumber, payload.payload.calledNumbers || []);
        }
      })
      .subscribe();
    
    // Channel for game updates
    const gameUpdatesChannel = supabase.channel('game-updates');
    gameUpdatesChannel
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
      .subscribe();
    
    // Store channels for later cleanup
    this.channels = [numberBroadcastChannel, sessionNumberChannel, gameUpdatesChannel];
  }
  
  // Set up database polling as a fallback
  private setupPolling() {
    if (!this.sessionId) return;
    
    // Set up polling every 10 seconds
    const pollingIntervalId = setInterval(async () => {
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
    
    // Create dummy channel just to store the interval for cleanup
    const pollingChannel = { id: 'polling', unsubscribe: () => clearInterval(pollingIntervalId) };
    this.channels.push(pollingChannel);
  }
  
  // Clean up channels and reset state
  cleanup() {
    logWithTimestamp('Cleaning up ConnectionManager');
    
    // Remove all channels
    this.channels.forEach(channel => {
      if (channel.unsubscribe) channel.unsubscribe();
      else if (channel.id !== 'polling') supabase.removeChannel(channel);
    });
    
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
  
  // Manually call a number
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
  
  // Broadcast a number call to all channels
  private broadcastNumberCall(lastCalledNumber: number, calledNumbers: number[], sessionId: string) {
    logWithTimestamp(`Broadcasting number call: ${lastCalledNumber}, total numbers: ${calledNumbers.length}`);
    
    const payload = {
      lastCalledNumber,
      calledNumbers,
      sessionId,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast on multiple channels for redundancy
    const promises = [
      supabase.channel('number-broadcast').send({
        type: 'broadcast',
        event: 'number-called',
        payload
      }),
      supabase.channel(`number-broadcast-${sessionId}`).send({
        type: 'broadcast',
        event: 'number-called',
        payload
      })
    ];
    
    Promise.all(promises)
      .then(() => logWithTimestamp('Number call broadcast successful'))
      .catch(error => console.error('Error broadcasting number call:', error));
      
    // Also notify local callbacks
    this.notifyNumberCalled(lastCalledNumber, calledNumbers);
  }
  
  // Fetch claims for the current session
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
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching claims:', error);
      return [];
    }
  }
  
  // Reconnect all channels
  reconnect() {
    if (!this.sessionId) {
      logWithTimestamp('Cannot reconnect: no session ID');
      return;
    }
    
    logWithTimestamp(`Reconnecting ConnectionManager for session ${this.sessionId}`);
    
    // Clean up and re-initialize everything
    this.cleanup();
    this.initialize(this.sessionId);
    
    // Force a database refresh
    supabase
      .from('sessions_progress')
      .select('*')
      .eq('session_id', this.sessionId)
      .single()
      .then(({ data }) => {
        if (data) {
          this.notifySessionProgressUpdate(data);
          
          if (data.called_numbers && data.called_numbers.length > 0) {
            const lastCalledNumber = data.called_numbers[data.called_numbers.length - 1];
            this.notifyNumberCalled(lastCalledNumber, data.called_numbers);
          }
        }
      })
      .catch(error => console.error('Error during reconnection data fetch:', error));
  }
}

// Create a singleton instance
export const connectionManager = new ConnectionManager();
