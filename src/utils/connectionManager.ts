
// Complete implementation of the connectionManager with all required methods

import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export const connectionManager = {
  // Private fields (used internally)
  supabaseChannel: null as any,
  activeChannels: [] as any[],
  lastPingTimestamp: 0,
  sessionId: null as string | null,
  listeners: {
    gameStateUpdate: [] as Function[],
    connectionStatusChange: [] as Function[],
    playersUpdate: [] as Function[],
    ticketsAssigned: [] as Function[],
    error: [] as Function[]
  },
  
  // Connection Management
  initialize(sessionId: string) {
    if (this.sessionId === sessionId && this.supabaseChannel) {
      logWithTimestamp(`ConnectionManager already initialized for session ${sessionId}`, 'info');
      return this; // Return self for method chaining
    }
    
    this.sessionId = sessionId;
    logWithTimestamp(`Initializing connection for session ${sessionId}`, 'info');
    
    // Create a new channel for this session
    this.supabaseChannel = supabase.channel(`game-${sessionId}`);
    
    // Set up channel listeners
    this.supabaseChannel
      .on('presence', { event: 'sync' }, () => {
        this.handlePresenceSync();
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        this.handlePresenceJoin(key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        this.handlePresenceLeave(key, leftPresences);
      })
      .on('broadcast', { event: 'game-state-update' }, (payload) => {
        this.handleGameStateUpdate(payload);
      })
      .on('broadcast', { event: 'tickets-assigned' }, (payload) => {
        this.handleTicketsAssigned(payload);
      })
      .on('broadcast', { event: 'number-called' }, (payload) => {
        this.handleNumberCalled(payload);
      })
      .on('broadcast', { event: 'bingo-claim' }, (payload) => {
        this.handleBingoClaim(payload);
      })
      .subscribe((status) => {
        this.handleSubscriptionStatus(status);
      });
    
    // Add to active channels
    if (!this.activeChannels.includes(this.supabaseChannel)) {
      this.activeChannels.push(this.supabaseChannel);
    }
    
    // Update last ping time
    this.lastPingTimestamp = Date.now();
    
    return this; // Return self for method chaining
  },
  
  reconnect() {
    logWithTimestamp('Reconnecting to game server...', 'info');
    
    if (this.sessionId) {
      // Create a new channel with the same session ID
      return this.initialize(this.sessionId);
    } else {
      logWithTimestamp('Cannot reconnect: No session ID available', 'error');
      return this;
    }
  },
  
  isConnected() {
    return this.supabaseChannel && this.supabaseChannel.state === 'SUBSCRIBED';
  },
  
  // Game state methods
  async callNumber(number: number, sessionId: string) {
    try {
      logWithTimestamp(`Calling number ${number} for session ${sessionId}`, 'info');
      
      if (!this.supabaseChannel) {
        logWithTimestamp('Cannot call number: No active channel', 'error');
        return false;
      }
      
      // Update database first
      const { error } = await supabase
        .from('sessions_progress')
        .update({
          called_numbers: supabase.sql`called_numbers || ARRAY[${number}]::integer[]`,
          last_called: number,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);
      
      if (error) {
        logWithTimestamp(`Error updating called numbers: ${error.message}`, 'error');
        return false;
      }
      
      // Return success
      return true;
    } catch (err) {
      logWithTimestamp(`Exception calling number: ${err}`, 'error');
      return false;
    }
  },
  
  // Claim-related methods
  async fetchClaims(sessionId: string) {
    try {
      logWithTimestamp(`Fetching claims for session ${sessionId}`, 'info');
      
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', sessionId)
        .is('validated_at', null)
        .not('claimed_at', 'is', null);
      
      if (error) {
        logWithTimestamp(`Error fetching claims: ${error.message}`, 'error');
        return [];
      }
      
      return data || [];
    } catch (err) {
      logWithTimestamp(`Exception fetching claims: ${err}`, 'error');
      return [];
    }
  },
  
  async validateClaim(claim: any, isValid: boolean) {
    try {
      logWithTimestamp(`Validating claim ${claim.id}, result: ${isValid}`, 'info');
      
      // Update the claim in the database
      const { error } = await supabase
        .from('universal_game_logs')
        .update({ 
          validated_at: new Date().toISOString(),
          prize_shared: isValid ? true : false  // Only share prize if valid
        })
        .eq('id', claim.id);
      
      if (error) {
        logWithTimestamp(`Error validating claim: ${error.message}`, 'error');
        return false;
      }
      
      // Broadcast the validation result if we have a channel
      if (this.supabaseChannel) {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'claim-result',
          payload: {
            claimId: claim.id,
            playerId: claim.player_id,
            result: isValid ? 'valid' : 'rejected',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      return true;
    } catch (err) {
      logWithTimestamp(`Exception validating claim: ${err}`, 'error');
      return false;
    }
  },
  
  // Public event subscription methods (used for chaining)
  onGameStateUpdate(callback: Function) {
    this.listeners.gameStateUpdate.push(callback);
    return this;
  },
  
  onConnectionStatusChange(callback: Function) {
    this.listeners.connectionStatusChange.push(callback);
    return this;
  },
  
  onPlayersUpdate(callback: Function) {
    this.listeners.playersUpdate.push(callback);
    return this;
  },
  
  onTicketsAssigned(callback: Function) {
    this.listeners.ticketsAssigned.push(callback);
    return this;
  },
  
  onError(callback: Function) {
    this.listeners.error.push(callback);
    return this;
  },
  
  // Player presence tracking
  trackPlayerPresence(playerData: any) {
    if (!this.supabaseChannel) {
      logWithTimestamp('Cannot track player presence: No active channel', 'error');
      return false;
    }
    
    try {
      this.supabaseChannel.track(playerData);
      return true;
    } catch (err) {
      logWithTimestamp(`Error tracking player presence: ${err}`, 'error');
      return false;
    }
  },
  
  // Event handlers
  handlePresenceSync() {
    // Get all connected players
    const presenceState = this.supabaseChannel.presenceState();
    const allPlayers = Object.values(presenceState).flat();
    
    // Call all player update listeners
    this.listeners.playersUpdate.forEach(callback => {
      try {
        callback(allPlayers);
      } catch (err) {
        logWithTimestamp(`Error in playersUpdate callback: ${err}`, 'error');
      }
    });
  },
  
  handlePresenceJoin(key: string, newPresences: any[]) {
    logWithTimestamp(`Player joined: ${key}`, 'debug');
    // Get all connected players
    const presenceState = this.supabaseChannel.presenceState();
    const allPlayers = Object.values(presenceState).flat();
    
    // Call all player update listeners
    this.listeners.playersUpdate.forEach(callback => {
      try {
        callback(allPlayers);
      } catch (err) {
        logWithTimestamp(`Error in playersUpdate callback: ${err}`, 'error');
      }
    });
  },
  
  handlePresenceLeave(key: string, leftPresences: any[]) {
    logWithTimestamp(`Player left: ${key}`, 'debug');
    // Get all connected players
    const presenceState = this.supabaseChannel.presenceState();
    const allPlayers = Object.values(presenceState).flat();
    
    // Call all player update listeners
    this.listeners.playersUpdate.forEach(callback => {
      try {
        callback(allPlayers);
      } catch (err) {
        logWithTimestamp(`Error in playersUpdate callback: ${err}`, 'error');
      }
    });
  },
  
  handleGameStateUpdate(payload: any) {
    logWithTimestamp('Received game state update', 'debug');
    
    // Call all game state update listeners
    this.listeners.gameStateUpdate.forEach(callback => {
      try {
        callback(payload.payload || payload);
      } catch (err) {
        logWithTimestamp(`Error in gameStateUpdate callback: ${err}`, 'error');
      }
    });
  },
  
  handleTicketsAssigned(payload: any) {
    logWithTimestamp(`Tickets assigned to player ${payload.payload?.playerCode}`, 'info');
    
    // Call all tickets assigned listeners
    this.listeners.ticketsAssigned.forEach(callback => {
      try {
        callback(payload.payload?.playerCode, payload.payload?.tickets);
      } catch (err) {
        logWithTimestamp(`Error in ticketsAssigned callback: ${err}`, 'error');
      }
    });
  },
  
  handleNumberCalled(payload: any) {
    // Update last ping time when we receive broadcasts
    this.lastPingTimestamp = Date.now();
    
    // This is handled by game state updates, no specific listeners for this
    logWithTimestamp(`Number called: ${payload.payload?.lastCalledNumber}`, 'debug');
  },
  
  handleBingoClaim(payload: any) {
    logWithTimestamp(`Bingo claim received from player ${payload.payload?.playerCode}`, 'info');
    // This is handled by claims fetching, no specific listeners for this
  },
  
  handleSubscriptionStatus(status: string) {
    logWithTimestamp(`Channel subscription status: ${status}`, 'info');
    
    const isConnected = status === 'SUBSCRIBED';
    
    // Call all connection status change listeners
    this.listeners.connectionStatusChange.forEach(callback => {
      try {
        callback(isConnected);
      } catch (err) {
        logWithTimestamp(`Error in connectionStatusChange callback: ${err}`, 'error');
      }
    });
    
    if (!isConnected) {
      // Call all error listeners with a generic error message
      this.listeners.error.forEach(callback => {
        try {
          callback('Connection lost or failed');
        } catch (err) {
          logWithTimestamp(`Error in error callback: ${err}`, 'error');
        }
      });
    }
  },
  
  // Methods added from the previous implementation
  getStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (this.supabaseChannel && this.supabaseChannel.state === 'SUBSCRIBED') {
      return 'connected';
    }
    if (this.supabaseChannel && this.supabaseChannel.state === 'JOINING') {
      return 'connecting';
    }
    return 'disconnected';
  },

  getLastPing(): number {
    return this.lastPingTimestamp || 0;
  },

  getChannels(): any[] {
    return this.activeChannels || [];
  },

  submitBingoClaim(ticket: any, playerCode: string, sessionId: string): boolean {
    try {
      if (!this.supabaseChannel || !sessionId || !playerCode) {
        console.error('Cannot submit claim: not connected or missing data');
        return false;
      }

      console.log('Submitting claim with ticket:', ticket);

      // Broadcast the claim
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'bingo-claim',
        payload: {
          playerCode,
          sessionId,
          ticket,
          timestamp: new Date().toISOString()
        }
      });

      return true;
    } catch (error) {
      console.error('Error submitting bingo claim:', error);
      return false;
    }
  },
};
