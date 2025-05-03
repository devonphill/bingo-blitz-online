
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

// Create a singleton to manage realtime events
class ConnectionManager {
  private sessionId: string | null = null;
  private pollingIntervalId: number | null = null;
  private playerRefreshCallback: ((players: Player[]) => void) | null = null;
  private sessionProgressCallback: ((progress: any) => void) | null = null;
  private numberCalledCallback: ((number: number, allNumbers: number[]) => void) | null = null;
  private channel: any = null;
  
  // Track last poll time to avoid flooding
  private lastPlayerPollTime = 0;
  private lastProgressPollTime = 0;
  
  constructor() {
    logWithTimestamp('ConnectionManager created');
  }
  
  initialize(sessionId: string) {
    logWithTimestamp(`ConnectionManager initialized with sessionId: ${sessionId}`);
    this.cleanup(); // Always clean up existing resources first
    this.sessionId = sessionId;
    this.startPolling();
    this.setupRealtimeChannel();
    return this;
  }
  
  private setupRealtimeChannel() {
    if (!this.sessionId) return;
    
    try {
      // Clean up existing channel if any
      if (this.channel) {
        supabase.removeChannel(this.channel);
      }
      
      const channelId = `number-broadcast-${this.sessionId}-${Date.now()}`;
      logWithTimestamp(`Setting up realtime channel: ${channelId} for session: ${this.sessionId}`);
      
      // Create a new channel for this session
      this.channel = supabase.channel('number-broadcast')
        .on('broadcast', { event: 'number-called' }, (payload) => {
          if (payload?.payload?.sessionId === this.sessionId) {
            logWithTimestamp(`Received realtime number called: ${JSON.stringify(payload.payload)}`);
            
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
        .subscribe(status => {
          logWithTimestamp(`Realtime channel status: ${status}`);
        });
        
      logWithTimestamp('Realtime channel setup complete');
    } catch (err) {
      console.error('Error setting up realtime channel:', err);
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
    if (!this.sessionId || !this.sessionProgressCallback) return;
    
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
      
      logWithTimestamp(`Fetched session progress:`, data);
      this.sessionProgressCallback(data);
    } catch (err) {
      console.error('Exception in fetchSessionProgress:', err);
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
  
  onNumberCalled(callback: (number: number, allNumbers: number[]) => void) {
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
  
  async submitClaim(claimData: any) {
    if (!this.sessionId) return false;
    
    try {
      logWithTimestamp(`Submitting claim for session ${this.sessionId}:`, claimData);
      
      const { error } = await supabase
        .from('universal_game_logs')
        .insert({
          ...claimData,
          session_id: this.sessionId,
          claimed_at: new Date().toISOString()
        });
        
      if (error) {
        console.error('Error submitting claim:', error);
        return false;
      }
      
      logWithTimestamp('Claim submitted successfully');
      return true;
    } catch (err) {
      console.error('Exception in submitClaim:', err);
      return false;
    }
  }
  
  async fetchClaims() {
    if (!this.sessionId) return [];
    
    try {
      logWithTimestamp(`Fetching claims for session ${this.sessionId}`);
      
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
      
      logWithTimestamp(`Fetched ${data?.length || 0} claims`);
      return data || [];
    } catch (err) {
      console.error('Exception in fetchClaims:', err);
      return [];
    }
  }
  
  async validateClaim(claimId: string) {
    if (!this.sessionId) return false;
    
    try {
      logWithTimestamp(`Validating claim ${claimId}`);
      
      const { error } = await supabase
        .from('universal_game_logs')
        .update({ validated_at: new Date().toISOString() })
        .eq('id', claimId);
        
      if (error) {
        console.error('Error validating claim:', error);
        return false;
      }
      
      logWithTimestamp('Claim validated successfully');
      return true;
    } catch (err) {
      console.error('Exception in validateClaim:', err);
      return false;
    }
  }
  
  async rejectClaim(claimId: string) {
    if (!this.sessionId) return false;
    
    try {
      logWithTimestamp(`Rejecting claim ${claimId}`);
      
      const { error } = await supabase
        .from('universal_game_logs')
        .update({ 
          validated_at: new Date().toISOString(),
          prize_shared: false 
        })
        .eq('id', claimId);
        
      if (error) {
        console.error('Error rejecting claim:', error);
        return false;
      }
      
      logWithTimestamp('Claim rejected successfully');
      return true;
    } catch (err) {
      console.error('Exception in rejectClaim:', err);
      return false;
    }
  }
  
  reconnect() {
    logWithTimestamp('Manually reconnecting...');
    
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
  }
}

// Export a singleton instance
export const connectionManager = new ConnectionManager();
