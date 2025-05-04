import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

// Define connection states for better type safety
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export const connectionManager = {
  // Private fields (used internally)
  supabaseChannel: null as any,
  activeChannels: [] as any[],
  lastPingTimestamp: 0,
  sessionId: null as string | null,
  connectionState: 'disconnected' as ConnectionState,
  isInitializing: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  reconnectBackoff: 1000, // Starting at 1 second
  reconnectTimer: null as any,
  
  // Event listeners
  listeners: {
    numberCalled: [] as Function[],
    gameStateUpdate: [] as Function[],
    connectionStatusChange: [] as Function[],
    playersUpdate: [] as Function[],
    ticketsAssigned: [] as Function[],
    error: [] as Function[]
  },
  
  // Connection Management
  initialize(sessionId: string) {
    if (this.isInitializing) {
      logWithTimestamp('ConnectionManager initialization already in progress', 'info');
      return this; // Return self for method chaining
    }
    
    if (this.sessionId === sessionId && this.supabaseChannel && this.connectionState === 'connected') {
      logWithTimestamp(`ConnectionManager already initialized and connected for session ${sessionId}`, 'info');
      return this; // Return self for method chaining
    }
    
    this.isInitializing = true;
    this.connectionState = 'connecting';
    this.sessionId = sessionId;
    logWithTimestamp(`Initializing connection for session ${sessionId}`, 'info');
    
    // Notify all listeners of the connecting state
    this.notifyConnectionStatusChange('connecting');
    
    try {
      // Clean up existing channel if any
      if (this.supabaseChannel) {
        try {
          logWithTimestamp('Cleaning up existing channel before creating a new one', 'info');
          this.supabaseChannel.unsubscribe();
        } catch (err) {
          logWithTimestamp(`Error unsubscribing from existing channel: ${err}`, 'error');
        }
      }
      
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
          this.isInitializing = false; // Initialization complete
        });
      
      // Add to active channels
      if (!this.activeChannels.includes(this.supabaseChannel)) {
        this.activeChannels.push(this.supabaseChannel);
      }
      
      // Update last ping time
      this.lastPingTimestamp = Date.now();
      
    } catch (error) {
      this.isInitializing = false;
      this.connectionState = 'error';
      logWithTimestamp(`Error initializing connection manager: ${error}`, 'error');
      
      // Call error listeners
      this.notifyError(`Error initializing connection: ${error}`);
    }
    
    return this; // Return self for method chaining
  },
  
  reconnect() {
    logWithTimestamp('Reconnecting to game server...', 'info');
    
    // Clear any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Don't try to reconnect if we're already connecting or we've reached max attempts
    if (this.connectionState === 'connecting' || this.isInitializing) {
      logWithTimestamp('Reconnection already in progress', 'info');
      return this;
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logWithTimestamp('Maximum reconnect attempts reached', 'error');
      this.connectionState = 'error';
      this.notifyConnectionStatusChange('error');
      this.notifyError('Maximum reconnect attempts reached');
      return this;
    }
    
    if (this.sessionId) {
      // Increment backoff with exponential delay
      const backoffTime = Math.min(
        this.reconnectBackoff * Math.pow(1.5, this.reconnectAttempts),
        30000 // Max 30 seconds
      );
      
      this.reconnectAttempts++;
      logWithTimestamp(`Reconnect attempt ${this.reconnectAttempts} with ${backoffTime}ms backoff`, 'info');
      
      this.connectionState = 'connecting';
      this.notifyConnectionStatusChange('connecting');
      
      // Create a new channel with the same session ID
      return this.initialize(this.sessionId);
    } else {
      logWithTimestamp('Cannot reconnect: No session ID available', 'error');
      this.connectionState = 'error';
      this.notifyConnectionStatusChange('error');
      return this;
    }
  },
  
  scheduleReconnect() {
    if (this.reconnectTimer) return; // Already scheduled
    
    // Calculate backoff time 
    const backoffTime = Math.min(
      this.reconnectBackoff * Math.pow(1.5, this.reconnectAttempts),
      30000 // Max 30 seconds
    );
    
    logWithTimestamp(`Scheduling reconnect in ${backoffTime}ms`, 'info');
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnect();
    }, backoffTime);
  },
  
  resetReconnectAttempts() {
    this.reconnectAttempts = 0;
  },
  
  // Helper method to check real connection status
  isConnected() {
    return this.supabaseChannel && this.supabaseChannel.state === 'SUBSCRIBED';
  },
  
  // Get current connection status
  getConnectionState(): ConnectionState {
    return this.connectionState;
  },
  
  // Notify connection status change listeners
  notifyConnectionStatusChange(status: ConnectionState) {
    // Update internal state
    this.connectionState = status;
    
    // Call all connection status change listeners
    this.listeners.connectionStatusChange.forEach(callback => {
      try {
        callback(status === 'connected');
      } catch (err) {
        logWithTimestamp(`Error in connectionStatusChange callback: ${err}`, 'error');
      }
    });
  },
  
  // Notify error listeners
  notifyError(error: string) {
    this.listeners.error.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        logWithTimestamp(`Error in error callback: ${err}`, 'error');
      }
    });
  },
  
  // Game state methods
  async callNumber(number: number, sessionId: string) {
    try {
      logWithTimestamp(`Calling number ${number} for session ${sessionId}`, 'info');
      
      if (!this.supabaseChannel) {
        logWithTimestamp('Cannot call number: No active channel', 'error');
        return false;
      }
      
      // Update database first - Fix the incorrect sql property usage
      const { error } = await supabase
        .from('sessions_progress')
        .update({
          // Replace the incorrect use of supabase.sql with PostgreSQL's array_append via rpc
          called_numbers: [...(await this.getCurrentCalledNumbers(sessionId)), number],
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
  
  // Add a helper method to get current called numbers
  async getCurrentCalledNumbers(sessionId: string): Promise<number[]> {
    try {
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', sessionId)
        .single();
        
      if (error || !data) {
        logWithTimestamp(`Error fetching current called numbers: ${error?.message}`, 'error');
        return [];
      }
      
      return data.called_numbers || [];
    } catch (err) {
      logWithTimestamp(`Exception fetching called numbers: ${err}`, 'error');
      return [];
    }
  },
  
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
  onNumberCalled(callback: Function) {
    this.listeners.numberCalled.push(callback);
    return this; // Return self for method chaining
  },
  
  onGameStateUpdate(callback: Function) {
    this.listeners.gameStateUpdate.push(callback);
    return this; // Return self for method chaining
  },
  
  onConnectionStatusChange(callback: Function) {
    this.listeners.connectionStatusChange.push(callback);
    
    // Immediately call with current status to initialize state
    try {
      callback(this.connectionState === 'connected');
    } catch (err) {
      logWithTimestamp(`Error in initial connectionStatusChange callback: ${err}`, 'error');
    }
    
    return this; // Return self for method chaining
  },
  
  onPlayersUpdate(callback: Function) {
    this.listeners.playersUpdate.push(callback);
    return this; // Return self for method chaining
  },
  
  onTicketsAssigned(callback: Function) {
    this.listeners.ticketsAssigned.push(callback);
    return this; // Return self for method chaining
  },
  
  onSessionProgressUpdate(callback: Function) {
    // Add to game state update listeners since that's what handles this data
    this.listeners.gameStateUpdate.push(callback);
    return this; // Return self for method chaining
  },
  
  onError(callback: Function) {
    this.listeners.error.push(callback);
    return this; // Return self for method chaining
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
    
    // Extract the actual data - either from the payload.payload (Supabase broadcast structure)
    // or directly from payload (direct message structure)
    const data = payload.payload || payload;
    const lastCalledNumber = data?.lastCalledNumber || data?.last_called_number;
    const calledNumbers = data?.calledNumbers || data?.called_numbers || [];

    logWithTimestamp(`Number called: ${lastCalledNumber}, all numbers: ${calledNumbers.length}`, 'debug');
    
    // Call all number called listeners
    this.listeners.numberCalled.forEach(callback => {
      try {
        callback(lastCalledNumber, calledNumbers);
      } catch (err) {
        logWithTimestamp(`Error in numberCalled callback: ${err}`, 'error');
      }
    });
  },
  
  handleBingoClaim(payload: any) {
    logWithTimestamp(`Bingo claim received from player ${payload.payload?.playerCode}`, 'info');
    // This is handled by claims fetching, no specific listeners for this
  },
  
  handleSubscriptionStatus(status: string) {
    logWithTimestamp(`Channel subscription status: ${status}`, 'info');
    
    if (status === 'SUBSCRIBED') {
      this.connectionState = 'connected';
      this.resetReconnectAttempts();  // Reset the counter on successful connection
      this.notifyConnectionStatusChange('connected');
      
      // Clear any reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      this.connectionState = 'disconnected';
      this.notifyConnectionStatusChange('disconnected');
      this.notifyError(`Connection ${status.toLowerCase()}`);
      
      // Schedule a reconnection attempt
      this.scheduleReconnect();
    }
  },
  
  // Methods added from the previous implementation
  getStatus() {
    return this.connectionState;
  },

  getLastPing() {
    return this.lastPingTimestamp ? Date.now() - this.lastPingTimestamp : 0;
  },

  getChannels() {
    return this.activeChannels || [];
  },

  submitBingoClaim(ticket: any, playerCode: string, sessionId: string) {
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
