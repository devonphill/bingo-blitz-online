import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

// Define connection states for better type safety
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Singleton connection manager instance
export const connectionManager = {
  // Private fields (used internally)
  supabaseChannel: null as any,
  activeChannels: [] as any[],
  lastPingTimestamp: 0,
  sessionId: null as string | null,
  connectionState: 'disconnected' as ConnectionState,
  isInitializing: false,
  isReconnecting: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  reconnectBackoff: 1000, // Starting at 1 second
  reconnectTimer: null as any,
  
  // Global initialization tracking - prevent multiple initializations
  initializationComplete: false,
  
  // Presence tracking data
  presenceData: null as any,
  presenceTrackingTimer: null as any,
  
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
    // Global flag to prevent multiple initializations
    if (this.initializationComplete && this.sessionId === sessionId && this.connectionState === 'connected') {
      logWithTimestamp(`ConnectionManager already fully initialized and connected for session ${sessionId}`, 'info');
      return this; // Return self for method chaining
    }
    
    // If already initializing, don't start another initialization
    if (this.isInitializing) {
      logWithTimestamp('ConnectionManager initialization already in progress', 'info');
      return this; // Return self for method chaining
    }
    
    this.isInitializing = true;
    this.connectionState = 'connecting';
    this.sessionId = sessionId;
    this.reconnectAttempts = 0; // Reset reconnect attempts on fresh init
    logWithTimestamp(`Initializing connection for session ${sessionId}`, 'info');
    
    // Notify all listeners of the connecting state
    this.notifyConnectionStatusChange('connecting');
    
    try {
      // Clean up existing channel if any
      this.cleanupExistingChannel();
      
      // Create a new channel for this session
      this.supabaseChannel = supabase.channel(`game-${sessionId}`);
      
      // Set up channel listeners
      this.setupChannelListeners();
      
      // Add to active channels
      if (!this.activeChannels.includes(this.supabaseChannel)) {
        this.activeChannels.push(this.supabaseChannel);
      }
      
      // Update last ping time
      this.lastPingTimestamp = Date.now();
      
      // Mark initialization as complete to prevent duplicate setups
      this.initializationComplete = true;
      
    } catch (error) {
      this.handleInitializationError(error);
    }
    
    // We don't call subscribe here anymore - defer to separate method
    
    return this; // Return self for method chaining
  },
  
  // Clean up the existing channel before creating a new one
  cleanupExistingChannel() {
    if (this.supabaseChannel) {
      try {
        logWithTimestamp('Cleaning up existing channel before creating a new one', 'info');
        this.supabaseChannel.unsubscribe();
      } catch (err) {
        logWithTimestamp(`Error unsubscribing from existing channel: ${err}`, 'error');
      }
    }
    
    // Also clear any tracking timer
    if (this.presenceTrackingTimer) {
      clearTimeout(this.presenceTrackingTimer);
      this.presenceTrackingTimer = null;
    }
  },
  
  // Set up all channel event listeners
  setupChannelListeners() {
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
      });
    
    // We don't subscribe yet - that's deferred to the connect method
  },
  
  // Handle initialization errors
  handleInitializationError(error: any) {
    this.isInitializing = false;
    this.connectionState = 'error';
    logWithTimestamp(`Error initializing connection manager: ${error}`, 'error');
    
    // Call error listeners
    this.notifyError(`Error initializing connection: ${error}`);
  },
  
  // Connect to the channel (now requires explicit call after initialization)
  connect() {
    if (!this.sessionId) {
      logWithTimestamp('Cannot connect: No session ID available', 'error');
      this.notifyError('No session ID available');
      return this;
    }
    
    if (this.connectionState === 'connected') {
      logWithTimestamp('Already connected', 'info');
      return this;
    }
    
    if (this.isReconnecting) {
      logWithTimestamp('Connection already in progress (reconnecting)', 'info');
      return this;
    }
    
    // Set to connecting state
    this.connectionState = 'connecting';
    this.notifyConnectionStatusChange('connecting');
    
    // If we have a channel already, check if it's subscribed
    if (this.supabaseChannel) {
      // Check the channel's current state before trying to subscribe
      if (this.supabaseChannel.state === 'SUBSCRIBED') {
        logWithTimestamp('Channel already subscribed, updating connection state', 'info');
        this.connectionState = 'connected';
        this.notifyConnectionStatusChange('connected');
        return this;
      } 
      else if (this.supabaseChannel.state === 'SUBSCRIBING') {
        logWithTimestamp('Channel currently subscribing, waiting for completion', 'info');
        return this;
      }
      
      // Now it's safe to try subscribing
      logWithTimestamp('Subscribing to channel', 'info');
      this.supabaseChannel.subscribe(this.handleSubscriptionStatus.bind(this));
    } else {
      // Initialize first if we don't have a channel
      if (this.sessionId) {
        this.initialize(this.sessionId);
        // And then subscribe
        if (this.supabaseChannel) {
          this.supabaseChannel.subscribe(this.handleSubscriptionStatus.bind(this));
        }
      }
    }
    
    return this;
  },
  
  // Disconnect from the channel
  disconnect() {
    if (this.connectionState === 'disconnected') {
      logWithTimestamp('Already disconnected', 'info');
      return this;
    }
    
    if (this.supabaseChannel) {
      try {
        logWithTimestamp('Disconnecting from channel', 'info');
        this.supabaseChannel.unsubscribe();
        this.connectionState = 'disconnected';
        this.notifyConnectionStatusChange('disconnected');
      } catch (err) {
        logWithTimestamp(`Error disconnecting from channel: ${err}`, 'error');
        this.notifyError(`Error disconnecting: ${err}`);
      }
    } else {
      this.connectionState = 'disconnected';
      this.notifyConnectionStatusChange('disconnected');
    }
    
    return this;
  },
  
  // Smart reconnect method with exponential backoff
  reconnect() {
    // Clear any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Don't try to reconnect if we're already connecting or we've reached max attempts
    if (this.isReconnecting || this.connectionState === 'connecting' || this.isInitializing) {
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
    
    // If we don't have a session ID, we can't reconnect
    if (!this.sessionId) {
      logWithTimestamp('Cannot reconnect: No session ID available', 'error');
      this.connectionState = 'error';
      this.notifyConnectionStatusChange('error');
      return this;
    }
    
    // Mark as reconnecting and increment attempts
    this.isReconnecting = true;
    
    // Increment backoff with exponential delay
    const backoffTime = Math.min(
      this.reconnectBackoff * Math.pow(1.5, this.reconnectAttempts),
      30000 // Max 30 seconds
    );
    
    this.reconnectAttempts++;
    logWithTimestamp(`Reconnect attempt ${this.reconnectAttempts} with ${backoffTime}ms backoff`, 'info');
    
    this.connectionState = 'connecting';
    this.notifyConnectionStatusChange('connecting');
    
    // Schedule reconnect after backoff
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      
      // NEW APPROACH: For reconnect, we properly handle different channel states
      if (this.supabaseChannel) {
        const channelState = this.supabaseChannel.state;
        logWithTimestamp(`Current channel state during reconnect: ${channelState}`, 'info');
        
        if (channelState === 'SUBSCRIBED') {
          // Channel already subscribed, just update connection state
          logWithTimestamp('Channel already subscribed during reconnect, updating state', 'info');
          this.connectionState = 'connected';
          this.notifyConnectionStatusChange('connected');
          this.isReconnecting = false;
          
          // Try to track presence again if we have data
          this.retryPresenceTracking();
        }
        else if (channelState === 'TIMED_OUT' || channelState === 'CLOSED' || channelState === 'CHANNEL_ERROR') {
          // Channel needs to be recreated
          logWithTimestamp('Channel in error state, recreating during reconnect', 'info');
          this.cleanupExistingChannel();
          this.supabaseChannel = supabase.channel(`game-${this.sessionId}`);
          this.setupChannelListeners();
          
          // Now subscribe to the new channel
          this.supabaseChannel.subscribe(this.handleSubscriptionStatus.bind(this));
        }
        else if (channelState === 'SUBSCRIBING') {
          // Already subscribing, just wait
          logWithTimestamp('Channel is already subscribing, waiting for completion', 'info');
          // Don't do anything, the subscription callback will handle state changes
        }
        else {
          // Not subscribed and not subscribing, safe to subscribe
          logWithTimestamp('Channel exists but not subscribed, subscribing during reconnect', 'info');
          this.supabaseChannel.subscribe(this.handleSubscriptionStatus.bind(this));
        }
      } else {
        // Only re-initialize if we don't have a channel
        logWithTimestamp('No channel available, reinitializing connection', 'info');
        this.initialize(this.sessionId as string);
        // And then subscribe
        if (this.supabaseChannel) {
          this.supabaseChannel.subscribe(this.handleSubscriptionStatus.bind(this));
        }
      }
      
      // Mark reconnection as complete unless subscribing
      if (this.supabaseChannel && this.supabaseChannel.state !== 'SUBSCRIBING') {
        this.isReconnecting = false;
      }
    }, backoffTime);
    
    return this;
  },
  
  // Reset reconnect attempt counter on successful connection
  resetReconnectAttempts() {
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    
    // Clear any reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  },
  
  // Helper method to check real connection status - the single source of truth
  isConnected() {
    // Double check both our state and the actual channel state
    return this.connectionState === 'connected' && 
           this.supabaseChannel && 
           this.supabaseChannel.state === 'SUBSCRIBED';
  },
  
  // Get current connection status - the single public API for connection state
  getConnectionState(): ConnectionState {
    // Verify that our internal state matches reality
    if (this.connectionState === 'connected' && 
        (!this.supabaseChannel || this.supabaseChannel.state !== 'SUBSCRIBED')) {
      // Internal state is incorrect, fix it
      this.connectionState = 'disconnected';
    }
    return this.connectionState;
  },
  
  // Notify connection status change listeners
  notifyConnectionStatusChange(status: ConnectionState) {
    // Only update if there is a real change to prevent flashing
    if (this.connectionState === status) {
      return;
    }
    
    // Update internal state
    this.connectionState = status;
    
    // Log the change
    logWithTimestamp(`Connection status changed to ${status}`, 'info');
    
    // Call all connection status change listeners
    this.listeners.connectionStatusChange.forEach(callback => {
      try {
        callback(status === 'connected');
      } catch (err) {
        logWithTimestamp(`Error in connectionStatusChange callback: ${err}`, 'error');
      }
    });
    
    // If we just connected and have presence data, try to track it
    if (status === 'connected' && this.presenceData) {
      this.retryPresenceTracking();
    }
  },
  
  // Try to track presence again after connection is established
  retryPresenceTracking() {
    // Clear any existing timer
    if (this.presenceTrackingTimer) {
      clearTimeout(this.presenceTrackingTimer);
      this.presenceTrackingTimer = null;
    }
    
    // Schedule a retry after short delay to ensure connection is stable
    this.presenceTrackingTimer = setTimeout(() => {
      if (this.isConnected() && this.presenceData) {
        logWithTimestamp('Retrying player presence tracking after reconnect', 'info');
        this.trackPlayerPresence(this.presenceData);
      }
    }, 500);
  },
  
  // Notify error listeners
  notifyError(error: string) {
    logWithTimestamp(`Connection error: ${error}`, 'error');
    
    this.listeners.error.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        logWithTimestamp(`Error in error callback: ${err}`, 'error');
      }
    });
  },
  
  // Helper methods and game state methods
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
  
  // Helper methods - keep existing functionality
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
  
  // Player presence tracking - improved to only track when connected
  trackPlayerPresence(playerData: any) {
    // Store the latest presence data so we can reuse it on reconnect
    this.presenceData = playerData;
    
    // Only track if we're connected
    if (!this.isConnected()) {
      logWithTimestamp('Cannot track player presence: Not connected', 'warn');
      
      // Schedule a retry after a short delay if we're trying to connect
      if (this.connectionState === 'connecting' || this.reconnectAttempts > 0) {
        // Clear any existing timer
        if (this.presenceTrackingTimer) {
          clearTimeout(this.presenceTrackingTimer);
        }
        
        this.presenceTrackingTimer = setTimeout(() => {
          if (this.isConnected() && this.presenceData) {
            logWithTimestamp('Retrying player presence tracking after delay', 'info');
            this.trackPlayerPresence(this.presenceData);
          } else if (this.connectionState === 'connecting' || this.reconnectAttempts > 0) {
            // Try again later if still connecting
            this.trackPlayerPresence(this.presenceData);
          }
        }, 2000);
      }
      
      return false;
    }
    
    if (!this.supabaseChannel) {
      logWithTimestamp('Cannot track player presence: No active channel', 'error');
      return false;
    }
    
    try {
      logWithTimestamp(`Tracking presence for player ${playerData.player_code || playerData.playerCode}`, 'info');
      // Test if player data is valid before tracking
      if (!playerData.player_id && !playerData.playerCode) {
        logWithTimestamp('Invalid player data for presence tracking', 'error');
        return false;
      }
      
      // Track player presence
      this.supabaseChannel.track(playerData);
      logWithTimestamp(`Successfully tracked presence for player ${playerData.player_code || playerData.playerCode}`, 'info');
      return true;
    } catch (err) {
      logWithTimestamp(`Error tracking player presence: ${err}`, 'error');
      return false;
    }
  },
  
  // Get ping time since last message
  getLastPing() {
    return this.lastPingTimestamp ? Date.now() - this.lastPingTimestamp : 0;
  },
  
  // Get status details for debugging
  getStatus() {
    return {
      connectionState: this.connectionState,
      isInitializing: this.isInitializing,
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      sessionId: this.sessionId,
      channelState: this.supabaseChannel?.state || 'NO_CHANNEL',
      lastPing: this.getLastPing(),
      initializationComplete: this.initializationComplete
    };
  },
  
  // Get list of active channels
  getChannels() {
    return this.activeChannels || [];
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
  
  // Event handlers section
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
    // Update last ping time when we receive broadcasts
    this.lastPingTimestamp = Date.now();
    
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
    // Update last ping time when we receive broadcasts
    this.lastPingTimestamp = Date.now();
    
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
    // Update last ping time when we receive broadcasts
    this.lastPingTimestamp = Date.now();
    
    logWithTimestamp(`Bingo claim received from player ${payload.payload?.playerCode}`, 'info');
    // This is handled by claims fetching, no specific listeners for this
  },
  
  handleSubscriptionStatus(status: string) {
    logWithTimestamp(`Channel subscription status: ${status}`, 'info');
    
    if (status === 'SUBSCRIBED') {
      this.connectionState = 'connected';
      this.resetReconnectAttempts();  // Reset the counter on successful connection
      this.notifyConnectionStatusChange('connected');
      
      // Re-track presence data if we have it
      this.retryPresenceTracking();
      
      // Clear any reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      // Clear reconnecting flag
      this.isReconnecting = false;
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      this.connectionState = 'disconnected';
      this.notifyConnectionStatusChange('disconnected');
      this.notifyError(`Connection ${status.toLowerCase()}`);
      
      // Schedule a reconnection attempt if not already reconnecting
      if (!this.isReconnecting && !this.reconnectTimer) {
        this.scheduleReconnect();
      }
    }
    
    this.isInitializing = false; // Always mark initialization as complete after subscription attempt
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
      if (!this.isConnected()) {
        this.reconnect();
      }
    }, backoffTime);
  },
  
  // Claims related functionality
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
  
  submitBingoClaim(ticket: any, playerCode: string, sessionId: string) {
    try {
      if (!this.isConnected() || !sessionId || !playerCode) {
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
