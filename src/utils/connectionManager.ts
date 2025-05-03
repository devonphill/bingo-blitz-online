
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

// Simple polling interval (in ms)
const POLLING_INTERVAL = 5000;

interface Player {
  id?: string;
  nickname?: string;
  joinedAt?: string;
  playerCode: string;
  playerName?: string;
  tickets?: number;
  clientId?: string;
}

interface BingoClaim {
  id: string;
  player_id: string;
  player_name?: string;
  session_id: string;
  game_number?: number;
  ticket_id: string;
  ticket_serial?: string;
  status: string;
  created_at: string;
  [key: string]: any; // Add index signature to allow additional properties
}

// Create a singleton to manage realtime events
class ConnectionManager {
  private sessionId: string | null = null;
  private pollingIntervalId: number | null = null;
  private playerRefreshCallback: ((players: Player[]) => void) | null = null;
  private sessionProgressCallback: ((progress: any) => void) | null = null;
  private numberCalledCallback: ((number: number, allNumbers: number[]) => void) | null = null;
  private channel: any = null;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  
  // Track last poll time to avoid flooding
  private lastPlayerPollTime = 0;
  private lastProgressPollTime = 0;
  private lastClaimsPollTime = 0;
  
  // Track connection management state
  public isInCooldown = false;
  public cooldownUntil = 0;
  public isConnecting = false;
  private activeInstanceId: string | null = null;
  
  constructor() {
    logWithTimestamp('ConnectionManager created');
  }
  
  initialize(sessionId: string) {
    if (this.isConnecting) {
      logWithTimestamp(`ConnectionManager already connecting, skipping duplicate initialization`);
      return this;
    }
    
    this.isConnecting = true;
    
    logWithTimestamp(`ConnectionManager initialized with sessionId: ${sessionId}`);
    
    // Store active session ID
    this.sessionId = sessionId;
    this.connectionState = 'connecting';
    
    // Create unique instance ID for this connection
    this.activeInstanceId = `conn-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const instanceId = this.activeInstanceId;
    
    this.startPolling();
    
    // Set up realtime channel with a slight delay to avoid race conditions
    setTimeout(() => {
      // Make sure we're still in the same connection attempt
      if (instanceId === this.activeInstanceId) {
        this.setupRealtimeChannel();
      }
    }, 500);
    
    return this;
  }
  
  // Get the current connection state
  getConnectionState() {
    return this.connectionState;
  }
  
  // Check if connected
  isConnected() {
    return this.connectionState === 'connected';
  }
  
  // Reset cooldown and connection state to force a new connection attempt
  forceReconnect() {
    logWithTimestamp(`Forcing reconnection`);
    this.isInCooldown = false;
    this.cooldownUntil = 0;
    this.isConnecting = false;
  }
  
  // Track connection state for better reconnection handling
  startConnection() {
    this.isConnecting = true;
  }
  
  endConnection(success: boolean) {
    this.isConnecting = false;
    
    if (!success && !this.isInCooldown) {
      // Start a cooldown period after a failed connection
      this.isInCooldown = true;
      this.cooldownUntil = Date.now() + 5000; // 5 second cooldown
      
      // Schedule end of cooldown
      setTimeout(() => {
        this.isInCooldown = false;
        logWithTimestamp(`Connection cooldown ended`);
      }, 5000);
    }
  }
  
  // Full reset of state
  reset() {
    this.isConnecting = false;
    this.isInCooldown = false;
    this.activeInstanceId = null;
  }
  
  // Helper function to schedule reconnections with backoff
  scheduleReconnect(reconnectFn: () => void) {
    if (this.isInCooldown) {
      logWithTimestamp(`Skipping reconnect due to active cooldown`);
      return;
    }
    
    const delay = Math.floor(Math.random() * 3000) + 2000; // 2-5 second random delay
    
    logWithTimestamp(`Scheduling reconnect in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isConnecting) {
        reconnectFn();
      }
    }, delay);
  }
  
  private setupRealtimeChannel() {
    if (!this.sessionId) return;
    
    try {
      // Clean up existing channel if any
      if (this.channel) {
        logWithTimestamp(`Removing existing channel before creating a new one`);
        supabase.removeChannel(this.channel);
        this.channel = null;
      }
      
      const channelId = `number-broadcast-${this.sessionId}-${Date.now()}`;
      logWithTimestamp(`Setting up realtime channel: ${channelId} for session: ${this.sessionId}`);
      
      // Create a new channel for this session
      this.channel = supabase.channel(channelId)
        .on('broadcast', { event: 'number-called' }, (payload) => {
          if (payload?.payload?.sessionId === this.sessionId) {
            logWithTimestamp(`Received realtime number called: ${payload.payload.lastCalledNumber}`);
            
            // Update connection state when we receive messages
            this.connectionState = 'connected';
            
            if (this.numberCalledCallback && payload.payload.lastCalledNumber) {
              const calledNumbers = payload.payload.calledNumbers || [];
              logWithTimestamp(`Calling number callback with: ${payload.payload.lastCalledNumber}, total numbers: ${calledNumbers.length}`);
              this.numberCalledCallback(
                payload.payload.lastCalledNumber, 
                calledNumbers
              );
            }
          }
        })
        .on('broadcast', { event: 'game-force-closed' }, (payload) => {
          if (payload?.payload?.sessionId === this.sessionId) {
            logWithTimestamp(`Received force close event for session: ${this.sessionId}`);
            
            if (this.numberCalledCallback) {
              // Reset called numbers on force close
              this.numberCalledCallback(null, []);
            }
          }
        })
        .on('broadcast', { event: 'game-reset' }, (payload) => {
          if (payload?.payload?.sessionId === this.sessionId) {
            logWithTimestamp(`Received game reset event for session: ${this.sessionId}`);
            
            if (this.numberCalledCallback) {
              // Reset called numbers on game reset
              this.numberCalledCallback(null, []);
            }
          }
        })
        .subscribe(status => {
          logWithTimestamp(`Realtime channel status: ${status}`);
          
          // Update connection state based on the channel status
          if (status === 'SUBSCRIBED') {
            this.connectionState = 'connected';
            this.endConnection(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            this.connectionState = 'disconnected';
            this.endConnection(false);
          } else if (status === 'TIMED_OUT') {
            this.connectionState = 'error';
            this.endConnection(false);
          }
        });
        
      logWithTimestamp('Realtime channel setup complete');
    } catch (err) {
      console.error('Error setting up realtime channel:', err);
      this.connectionState = 'error';
      this.endConnection(false);
    }
  }
  
  private startPolling() {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
    }
    
    this.pollingIntervalId = window.setInterval(() => {
      this.pollForUpdates();
    }, POLLING_INTERVAL);
    
    // Do an immediate first poll
    this.pollForUpdates();
    
    logWithTimestamp(`Polling started with interval of ${POLLING_INTERVAL}ms`);
    return this;
  }
  
  private async pollForUpdates() {
    if (!this.sessionId) return;
    
    const now = Date.now();
    
    // Only poll for players if we have a callback registered
    if (this.playerRefreshCallback && (now - this.lastPlayerPollTime) >= POLLING_INTERVAL) {
      this.lastPlayerPollTime = now;
      await this.fetchPlayers();
    }
    
    // Only poll for session progress if we have a callback registered
    if (this.sessionProgressCallback && (now - this.lastProgressPollTime) >= POLLING_INTERVAL) {
      this.lastProgressPollTime = now;
      await this.fetchSessionProgress();
    }
  }
  
  private async fetchPlayers() {
    if (!this.sessionId || !this.playerRefreshCallback) return;
    
    try {
      logWithTimestamp(`Fetching players for session: ${this.sessionId}`);
      
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', this.sessionId);
        
      if (error) {
        console.error('Error fetching players:', error);
        return;
      }
      
      logWithTimestamp(`Fetched ${data.length} players`);
      
      // Map database fields to our Player interface
      const mappedPlayers: Player[] = data.map(player => ({
        id: player.id,
        nickname: player.nickname,
        joinedAt: player.joined_at,
        playerCode: player.player_code,
        playerName: player.nickname,
        tickets: player.tickets,
      }));
      
      this.playerRefreshCallback(mappedPlayers);
    } catch (err) {
      console.error('Exception in fetchPlayers:', err);
    }
  }
  
  private async fetchSessionProgress() {
    if (!this.sessionId) return;
    
    // Check if the callback is defined before attempting to use it
    if (!this.sessionProgressCallback) {
      logWithTimestamp(`Cannot fetch session progress: No callback registered`);
      return;
    }
    
    try {
      logWithTimestamp(`Fetching session progress for session: ${this.sessionId}`);
      
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('*')
        .eq('session_id', this.sessionId)
        .single();
        
      if (error) {
        console.error('Error fetching session progress:', error);
        return;
      }
      
      // Update connection state when we receive data
      this.connectionState = 'connected';
      
      logWithTimestamp(`Fetched session progress:`, data);
      this.sessionProgressCallback(data);
    } catch (err) {
      console.error('Exception in fetchSessionProgress:', err);
    }
  }
  
  async fetchClaims(): Promise<BingoClaim[]> {
    if (!this.sessionId) return [];
    
    const now = Date.now();
    // Add rate limiting to prevent excessive polling
    if ((now - this.lastClaimsPollTime) < 2000) {
      return [];
    }
    
    this.lastClaimsPollTime = now;
    
    try {
      logWithTimestamp(`Fetching bingo claims for session: ${this.sessionId}`);
      
      // Use the custom RPC function to get pending claims
      // Adding a type assertion to overcome TypeScript limitations with dynamic RPC functions
      const { data, error } = await supabase.rpc(
        'get_pending_claims' as any, 
        { p_session_id: this.sessionId }
      );
        
      if (error) {
        console.error('Error fetching bingo claims:', error);
        return [];
      }
      
      if (!data || !Array.isArray(data)) {
        logWithTimestamp('No pending claims found or invalid response format');
        return [];
      }
      
      logWithTimestamp(`Fetched ${data.length} pending claims`);
      // Convert the data to the BingoClaim type after validating it's an array
      return data as unknown as BingoClaim[];
      
    } catch (err) {
      console.error('Exception in fetchClaims:', err);
      return [];
    }
  }
  
  onPlayersUpdate(callback: (players: Player[]) => void) {
    this.playerRefreshCallback = callback;
    
    // Immediately fetch players to populate data
    if (this.sessionId) {
      this.fetchPlayers();
    }
    
    return this;
  }
  
  onSessionProgressUpdate(callback: (progress: any) => void) {
    this.sessionProgressCallback = callback;
    
    // Immediately fetch session progress to populate data
    if (this.sessionId) {
      this.fetchSessionProgress();
    }
    
    return this;
  }
  
  onNumberCalled(callback: (number: number | null, allNumbers: number[]) => void) {
    this.numberCalledCallback = callback;
    logWithTimestamp('Number called callback registered');
    return this;
  }
  
  async callNumber(number: number, sessionId?: string) {
    const id = sessionId || this.sessionId;
    if (!id) return false;
    
    try {
      logWithTimestamp(`Calling number ${number} for session ${id}`);
      
      // Fetch current session progress first
      const { data: progressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', id)
        .single();
        
      if (progressError) {
        console.error('Error fetching current called numbers:', progressError);
        return false;
      }
      
      // Update called numbers in the database
      const currentNumbers = progressData.called_numbers || [];
      const updatedNumbers = [...currentNumbers, number];
      
      // FIRST - Send realtime update before database update for instant feedback
      try {
        logWithTimestamp(`Broadcasting number ${number} via realtime`);
        
        // Use a separate broadcast channel to ensure all clients receive the update
        await supabase.channel('number-broadcast').send({
          type: 'broadcast',
          event: 'number-called',
          payload: {
            sessionId: id,
            lastCalledNumber: number,
            calledNumbers: updatedNumbers,
            timestamp: new Date().getTime()
          }
        });
        
        logWithTimestamp('Number broadcast sent');
      } catch (err) {
        console.error('Error broadcasting number:', err);
      }
      
      // THEN - Update the database for persistence
      const { error: updateError } = await supabase
        .from('sessions_progress')
        .update({ called_numbers: updatedNumbers })
        .eq('session_id', id);
        
      if (updateError) {
        console.error('Error updating called numbers:', updateError);
        return false;
      }
      
      // Also trigger our local callback if one is registered
      if (this.numberCalledCallback) {
        this.numberCalledCallback(number, updatedNumbers);
      }
      
      logWithTimestamp(`Number ${number} called successfully`);
      
      return true;
    } catch (err) {
      console.error('Exception in callNumber:', err);
      return false;
    }
  }
  
  // Exposed reconnect method for users to manually trigger reconnection
  reconnect() {
    logWithTimestamp('Manually reconnecting...');
    this.connectionState = 'connecting';
    this.forceReconnect(); // Clear cooldown state
    
    // Refresh realtime channel
    this.setupRealtimeChannel();
    
    // Force immediate polling
    this.pollForUpdates();
    
    return this;
  }
  
  cleanup() {
    logWithTimestamp('Cleaning up ConnectionManager');
    
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    
    this.sessionId = null;
    this.playerRefreshCallback = null;
    this.sessionProgressCallback = null;
    this.numberCalledCallback = null;
    this.connectionState = 'disconnected';
    this.reset();
  }
}

// Export a singleton instance
export const connectionManager = new ConnectionManager();
