
import { supabase } from '@/integrations/supabase/client';

// Simple polling interval (in ms)
const POLLING_INTERVAL = 5000;

interface Player {
  id?: string;
  nickname?: string;
  joinedAt?: string;
  playerCode: string;
  playerName?: string;
  tickets?: number;
}

class ConnectionManager {
  private sessionId: string | null = null;
  private pollingIntervalId: number | null = null;
  private playerRefreshCallback: ((players: Player[]) => void) | null = null;
  private sessionProgressCallback: ((progress: any) => void) | null = null;
  
  // Track last poll time to avoid flooding
  private lastPlayerPollTime = 0;
  private lastProgressPollTime = 0;
  
  constructor() {
    console.log('ConnectionManager created');
  }
  
  initialize(sessionId: string) {
    console.log(`ConnectionManager initialized with sessionId: ${sessionId}`);
    this.sessionId = sessionId;
    this.startPolling();
    return this;
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
    
    console.log(`Polling started with interval of ${POLLING_INTERVAL}ms`);
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
      console.log(`Fetching players for session: ${this.sessionId}`);
      
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', this.sessionId);
        
      if (error) {
        console.error('Error fetching players:', error);
        return;
      }
      
      console.log(`Fetched ${data.length} players`);
      this.playerRefreshCallback(data);
    } catch (err) {
      console.error('Exception in fetchPlayers:', err);
    }
  }
  
  private async fetchSessionProgress() {
    if (!this.sessionId || !this.sessionProgressCallback) return;
    
    try {
      console.log(`Fetching session progress for session: ${this.sessionId}`);
      
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('*')
        .eq('session_id', this.sessionId)
        .single();
        
      if (error) {
        console.error('Error fetching session progress:', error);
        return;
      }
      
      console.log(`Fetched session progress:`, data);
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
  
  async callNumber(number: number, sessionId?: string) {
    const id = sessionId || this.sessionId;
    if (!id) return false;
    
    try {
      console.log(`Calling number ${number} for session ${id}`);
      
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
      
      const { error: updateError } = await supabase
        .from('sessions_progress')
        .update({ called_numbers: updatedNumbers })
        .eq('session_id', id);
        
      if (updateError) {
        console.error('Error updating called numbers:', updateError);
        return false;
      }
      
      console.log(`Number ${number} called successfully`);
      
      // Refresh session progress immediately after update
      this.fetchSessionProgress();
      
      return true;
    } catch (err) {
      console.error('Exception in callNumber:', err);
      return false;
    }
  }
  
  async submitClaim(claimData: any) {
    if (!this.sessionId) return false;
    
    try {
      console.log(`Submitting claim for session ${this.sessionId}:`, claimData);
      
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
      
      console.log('Claim submitted successfully');
      return true;
    } catch (err) {
      console.error('Exception in submitClaim:', err);
      return false;
    }
  }
  
  async fetchClaims() {
    if (!this.sessionId) return [];
    
    try {
      console.log(`Fetching claims for session ${this.sessionId}`);
      
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
      
      console.log(`Fetched ${data?.length || 0} claims`);
      return data || [];
    } catch (err) {
      console.error('Exception in fetchClaims:', err);
      return [];
    }
  }
  
  async validateClaim(claimId: string) {
    if (!this.sessionId) return false;
    
    try {
      console.log(`Validating claim ${claimId}`);
      
      const { error } = await supabase
        .from('universal_game_logs')
        .update({ validated_at: new Date().toISOString() })
        .eq('id', claimId);
        
      if (error) {
        console.error('Error validating claim:', error);
        return false;
      }
      
      console.log('Claim validated successfully');
      return true;
    } catch (err) {
      console.error('Exception in validateClaim:', err);
      return false;
    }
  }
  
  async rejectClaim(claimId: string) {
    if (!this.sessionId) return false;
    
    try {
      console.log(`Rejecting claim ${claimId}`);
      
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
      
      console.log('Claim rejected successfully');
      return true;
    } catch (err) {
      console.error('Exception in rejectClaim:', err);
      return false;
    }
  }
  
  cleanup() {
    console.log('Cleaning up ConnectionManager');
    
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    
    this.sessionId = null;
    this.playerRefreshCallback = null;
    this.sessionProgressCallback = null;
  }
}

// Export a singleton instance
export const connectionManager = new ConnectionManager();
