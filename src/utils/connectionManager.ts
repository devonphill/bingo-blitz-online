/**
 * Unified connection manager for all game-related real-time communication
 */
import { supabase } from "@/integrations/supabase/client";
import { logWithTimestamp } from "./logUtils";
import { toast } from "sonner";

interface NumberCalledCallback {
  (number: number | null, allNumbers: number[]): void;
}

interface SessionProgressCallback {
  (progress: any | null): void;
}

interface PlayersUpdateCallback {
  (players: any[]): void;
}

interface TicketsAssignedCallback {
  (playerCode: string, tickets: any[]): void;
}

class ConnectionManager {
  private static instance: ConnectionManager;
  private sessionId: string | null = null;
  private channelId: string | null = null; // Store a unique identifier for this connection
  private gameUpdatesChannel: any = null;
  private presenceChannel: any = null;
  private numberCallCallbacks: NumberCalledCallback[] = [];
  private sessionProgressCallbacks: SessionProgressCallback[] = [];
  private playersUpdateCallbacks: PlayersUpdateCallback[] = [];
  private ticketsAssignedCallbacks: TicketsAssignedCallback[] = [];
  private connectedState: boolean = false;
  private _heartbeatIntervals: number[] = [];
  private _playerInfo: any = null;
  private _lastHeartbeat: number = 0;
  private _connectionAttempts: number = 0;
  private _uniqueClientId: string = '';
  
  // Private constructor to enforce singleton
  private constructor() {
    // Generate a unique ID for this connection instance
    this._uniqueClientId = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.channelId = this._uniqueClientId;
    logWithTimestamp(`ConnectionManager: Created with ID ${this.channelId}`);
  }
  
  // Get the single instance
  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }
  
  /**
   * Initialize the connection manager with a session
   */
  public initialize(sessionId: string | null): ConnectionManager {
    if (!sessionId) {
      logWithTimestamp("ConnectionManager: No session ID provided");
      return this;
    }
    
    // If we're already connected to this session, just return
    if (this.sessionId === sessionId && this.gameUpdatesChannel && this.connectedState) {
      logWithTimestamp(`ConnectionManager: Already connected to session ${sessionId}`);
      return this;
    }
    
    // Clean up any existing connections
    this.cleanup();
    
    // Set the new session
    this.sessionId = sessionId;
    this._connectionAttempts = 0;
    logWithTimestamp(`ConnectionManager: Initializing connection for session ${sessionId}`);
    
    // Set up the game updates channel
    this.setupGameChannel();
    
    // Set up the presence channel for player tracking
    this.setupPresenceChannel();
    
    return this;
  }
  
  /**
   * Clean up all connections and intervals
   */
  public cleanup(): void {
    if (this.gameUpdatesChannel) {
      logWithTimestamp(`ConnectionManager: Cleaning up game channel for session ${this.sessionId}`);
      try {
        supabase.removeChannel(this.gameUpdatesChannel);
      } catch (err) {
        console.error("Error removing game updates channel:", err);
      }
      this.gameUpdatesChannel = null;
    }
    
    if (this.presenceChannel) {
      logWithTimestamp(`ConnectionManager: Cleaning up presence channel for session ${this.sessionId}`);
      try {
        supabase.removeChannel(this.presenceChannel);
      } catch (err) {
        console.error("Error removing presence channel:", err);
      }
      this.presenceChannel = null;
    }
    
    // Clear all heartbeat intervals
    if (this._heartbeatIntervals) {
      this._heartbeatIntervals.forEach(interval => clearInterval(interval));
      this._heartbeatIntervals = [];
    }
    
    this.connectedState = false;
    this._lastHeartbeat = 0;
  }
  
  /**
   * Reconnect to the current session
   */
  public reconnect(): void {
    logWithTimestamp(`ConnectionManager: Attempting to reconnect to session ${this.sessionId}`);
    if (!this.sessionId) {
      logWithTimestamp("ConnectionManager: Cannot reconnect - no session ID");
      return;
    }
    
    // Store player info for re-tracking
    const playerInfo = this._playerInfo;
    
    // Increment connection attempts
    this._connectionAttempts++;
    
    // Clean up existing connections and set up new ones
    const sessionId = this.sessionId;
    this.cleanup();
    this.initialize(sessionId);
    
    // Re-track player presence if we had player info
    if (playerInfo) {
      this.trackPlayerPresence(playerInfo);
    }
    
    // Log the reconnection attempt
    logWithTimestamp(`ConnectionManager: Reconnection attempt #${this._connectionAttempts} initiated`);
    
    // Show a toast notification after multiple reconnection attempts
    if (this._connectionAttempts > 2) {
      toast.info(`Reconnecting to game server (attempt #${this._connectionAttempts})`, {
        duration: 3000,
        position: "bottom-center"
      });
    }
    
    // If we've tried too many times, alert the user
    if (this._connectionAttempts > 5) {
      toast.error("Having trouble connecting to the game server. Please check your internet connection.", {
        duration: 5000,
        position: "bottom-center"
      });
    }
  }
  
  /**
   * Set up the game updates channel
   */
  private setupGameChannel(): void {
    if (!this.sessionId) return;
    
    // Generate a unique channel name that includes our connection ID
    const channelName = `game-updates-${this.sessionId}-${this.channelId}`;
    logWithTimestamp(`ConnectionManager: Setting up game updates channel: ${channelName}`);
    
    // Create the channel with our unique name
    this.gameUpdatesChannel = supabase.channel(channelName);
    
    // Subscribe to number calls
    this.gameUpdatesChannel
      .on('broadcast', { event: 'number-called' }, (payload: any) => {
        const number = payload.payload?.number ?? null;
        const allNumbers = payload.payload?.calledNumbers ?? [];
        
        logWithTimestamp(`ConnectionManager: Received number call: ${number}, total called: ${allNumbers.length}`);
        
        // Update connected state
        this.connectedState = true;
        this._lastHeartbeat = Date.now();
        
        // Notify all callbacks
        this.numberCallCallbacks.forEach(callback => {
          try {
            callback(number, allNumbers);
          } catch (err) {
            console.error("Error in number call callback:", err);
          }
        });
      })
      .on('broadcast', { event: 'session-progress' }, (payload: any) => {
        const progress = payload.payload ?? null;
        
        logWithTimestamp(`ConnectionManager: Received session progress update`);
        
        // Update connected state
        this.connectedState = true;
        this._lastHeartbeat = Date.now();
        
        // Notify all callbacks
        this.sessionProgressCallbacks.forEach(callback => {
          try {
            callback(progress);
          } catch (err) {
            console.error("Error in session progress callback:", err);
          }
        });
      })
      .on('broadcast', { event: 'tickets-assigned' }, (payload: any) => {
        const playerCode = payload.payload?.playerCode;
        const tickets = payload.payload?.tickets;
        
        if (playerCode && tickets) {
          logWithTimestamp(`ConnectionManager: Received tickets assigned to player ${playerCode}: ${tickets.length} tickets`);
          
          // Notify all callbacks
          this.ticketsAssignedCallbacks.forEach(callback => {
            try {
              callback(playerCode, tickets);
            } catch (err) {
              console.error("Error in tickets assigned callback:", err);
            }
          });
        }
      })
      .on('broadcast', { event: 'heartbeat' }, () => {
        // Update the heartbeat timestamp when we get any heartbeat event
        this._lastHeartbeat = Date.now();
        this.connectedState = true;
      })
      .subscribe(status => {
        logWithTimestamp(`ConnectionManager: Game updates channel status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          // We're connected
          this.connectedState = true;
          this._lastHeartbeat = Date.now();
          
          // Send an initial heartbeat
          setTimeout(() => {
            try {
              this.gameUpdatesChannel.send({
                type: 'broadcast',
                event: 'heartbeat',
                payload: {
                  clientId: this.channelId,
                  timestamp: new Date().toISOString()
                }
              }).catch((err: any) => {
                console.error("Initial heartbeat error:", err);
              });
            } catch (e) {
              console.error("Error sending initial heartbeat:", e);
            }
          }, 500);
          
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          // We're disconnected
          this.connectedState = false;
          
          // Try to reconnect automatically after a short delay
          setTimeout(() => this.reconnect(), 2000);
        }
      });
  }
  
  /**
   * Set up the presence channel for player tracking
   */
  private setupPresenceChannel(): void {
    if (!this.sessionId) return;
    
    // Use a consistent presence key that doesn't change on reconnect
    const presenceKey = this._uniqueClientId;
    logWithTimestamp(`ConnectionManager: Setting up presence channel for session ${this.sessionId} with key ${presenceKey}`);
    
    // Clean up any existing presence channel first to prevent duplicates
    if (this.presenceChannel) {
      try {
        supabase.removeChannel(this.presenceChannel);
      } catch (err) {
        console.error("Error removing existing presence channel:", err);
      }
      this.presenceChannel = null;
    }
    
    // Create the channel with a consistent name
    this.presenceChannel = supabase.channel(`presence-${this.sessionId}`, {
      config: {
        presence: {
          key: presenceKey
        }
      }
    });
    
    // Set up presence sync with debounce
    let lastSyncTimestamp = 0;
    
    this.presenceChannel
      .on('presence', { event: 'sync' }, () => {
        // Get the current state - all users in the room
        const state = this.presenceChannel.presenceState();
        
        // Avoid multiple rapid-fire sync events by using a timestamp check
        const now = Date.now();
        if (now - lastSyncTimestamp < 300) { // 300ms debounce
          return;
        }
        lastSyncTimestamp = now;
        
        // Convert state to array of players
        const players = Object.keys(state).map(key => {
          const userPresence = state[key][0];
          return {
            id: userPresence.user_id,
            playerCode: userPresence.player_code,
            nickname: userPresence.nickname,
            playerName: userPresence.nickname,
            joinedAt: userPresence.joined_at,
            tickets: userPresence.tickets,
            clientId: key
          };
        });
        
        logWithTimestamp(`ConnectionManager: Presence sync, ${players.length} players online`);
        
        // Notify all callbacks
        this.playersUpdateCallbacks.forEach(callback => {
          try {
            callback(players);
          } catch (err) {
            console.error("Error in players update callback:", err);
          }
        });
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // Ignore joins from our own client to prevent loops
        if (key === presenceKey) return;
        
        // Someone joined
        logWithTimestamp(`ConnectionManager: Player joined: ${key}`);
        
        // Show a toast notification
        const newPlayer = newPresences[0];
        if (newPlayer?.nickname) {
          toast.success(`${newPlayer.nickname} joined the game`, {
            position: "bottom-right",
            duration: 2000
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // Ignore leaves from our own client to prevent loops
        if (key === presenceKey) return;
        
        // Someone left
        logWithTimestamp(`ConnectionManager: Player left: ${key}`);
      })
      .subscribe((status) => {
        logWithTimestamp(`ConnectionManager: Presence channel status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          // We're connected to the presence channel
          // Update our connection state
          this.connectedState = true;
          this._lastHeartbeat = Date.now();
          
          // Track presence if we have player info
          if (this._playerInfo) {
            this.trackPlayerPresenceInternal();
          }
        } else if (status === 'CHANNEL_ERROR') {
          // Try to reconnect if we get an error
          setTimeout(() => this.reconnect(), 2000);
        }
      });
  }
  
  /**
   * Register a callback for number calls
   */
  public onNumberCalled(callback: NumberCalledCallback): ConnectionManager {
    this.numberCallCallbacks.push(callback);
    return this;
  }
  
  /**
   * Register a callback for session progress updates
   */
  public onSessionProgressUpdate(callback: SessionProgressCallback): ConnectionManager {
    this.sessionProgressCallbacks.push(callback);
    return this;
  }
  
  /**
   * Register a callback for player updates
   */
  public onPlayersUpdate(callback: PlayersUpdateCallback): ConnectionManager {
    this.playersUpdateCallbacks.push(callback);
    return this;
  }
  
  /**
   * Register a callback for ticket assignments
   */
  public onTicketsAssigned(callback: TicketsAssignedCallback): ConnectionManager {
    this.ticketsAssignedCallbacks.push(callback);
    return this;
  }
  
  /**
   * Track a player's presence in the current session
   * This is key to keeping players online and visible to each other
   */
  public trackPlayerPresence(playerInfo: {
    player_id: string;
    player_code: string;
    nickname: string;
    tickets?: any[];
  }): void {
    if (!this.sessionId || !this.presenceChannel) {
      logWithTimestamp("ConnectionManager: Cannot track presence - no active session");
      return;
    }
    
    logWithTimestamp(`ConnectionManager: Tracking presence for player ${playerInfo.player_code}`);
    
    // Store player info for reconnection
    this._playerInfo = {
      user_id: playerInfo.player_id,
      player_code: playerInfo.player_code,
      nickname: playerInfo.nickname,
      tickets: playerInfo.tickets || [],
      joined_at: new Date().toISOString(),
      client_id: this._uniqueClientId  // Use consistent ID
    };
    
    // Configure heartbeat for presence
    this.setupHeartbeat(playerInfo);
    
    // Track the player with actual presence tracking
    this.trackPlayerPresenceInternal();
  }
  
  /**
   * Internal method to handle presence tracking
   * Extracted to avoid duplication
   */
  private trackPlayerPresenceInternal(): void {
    if (!this._playerInfo || !this.presenceChannel) return;
    
    try {
      this.presenceChannel.track(this._playerInfo)
        .then(() => {
          logWithTimestamp(`ConnectionManager: Successfully tracked player presence`);
          this.connectedState = true;
          this._lastHeartbeat = Date.now();
        })
        .catch((err: any) => {
          console.error("Error tracking player presence:", err);
          // Try to reconnect but not immediately to avoid loops
          setTimeout(() => this.reconnect(), 2000);
        });
    } catch (err) {
      console.error("Error tracking player presence:", err);
      setTimeout(() => this.reconnect(), 2000);
    }
  }
  
  /**
   * Set up heartbeat for keeping connection alive
   */
  private setupHeartbeat(playerInfo: {
    player_id: string;
    player_code: string;
    nickname: string;
  }): void {
    // Clear any existing heartbeat intervals first
    if (this._heartbeatIntervals.length > 0) {
      this._heartbeatIntervals.forEach(interval => clearInterval(interval));
      this._heartbeatIntervals = [];
    }
    
    // Send presence heartbeat every 10 seconds
    const heartbeatInterval = window.setInterval(() => {
      if (this.presenceChannel) {
        try {
          // Send a heartbeat through the presence channel
          this.presenceChannel.send({
            type: 'broadcast',
            event: 'heartbeat',
            payload: {
              player_code: playerInfo.player_code,
              client_id: this._uniqueClientId,
              timestamp: new Date().toISOString()
            }
          })
          .then(() => {
            // Update heartbeat timestamp
            this._lastHeartbeat = Date.now();
            this.connectedState = true;
          })
          .catch(err => {
            console.error("Heartbeat error:", err);
            
            // Check if we need to reconnect
            const timeSinceLastHeartbeat = Date.now() - this._lastHeartbeat;
            if (timeSinceLastHeartbeat > 15000) { // 15 seconds
              logWithTimestamp(`ConnectionManager: No heartbeat for ${timeSinceLastHeartbeat}ms, reconnecting`);
              this.reconnect();
            }
          });
        } catch (err) {
          console.error("Error sending heartbeat:", err);
        }
      }
    }, 10000); // Heartbeat every 10 seconds
    
    // Track connection health
    const healthCheckInterval = window.setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - this._lastHeartbeat;
      if (this._lastHeartbeat > 0 && timeSinceLastHeartbeat > 15000) { // 15 seconds
        logWithTimestamp(`ConnectionManager: No heartbeat for ${timeSinceLastHeartbeat}ms, reconnecting`);
        this.reconnect();
      }
    }, 5000);
    
    // Store the heartbeat intervals for cleanup
    this._heartbeatIntervals.push(heartbeatInterval);
    this._heartbeatIntervals.push(healthCheckInterval);
  }
  
  /**
   * Check if we're currently connected
   */
  public isConnected(): boolean {
    return this.connectedState;
  }
  
  /**
   * Get the current session ID
   */
  public getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Call a number for a bingo game
   * @param number The number to call
   * @param sessionId The session ID
   */
  public async callNumber(number: number, sessionId: string | null = null): Promise<boolean> {
    const targetSessionId = sessionId || this.sessionId;
    if (!targetSessionId) {
      logWithTimestamp("ConnectionManager: Cannot call number - no session ID");
      return false;
    }

    try {
      logWithTimestamp(`ConnectionManager: Calling number ${number} for session ${targetSessionId}`);
      
      // First, update the database with the new called number
      const { data: progressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', targetSessionId)
        .single();
      
      if (progressError) {
        console.error("Error fetching current called numbers:", progressError);
        return false;
      }
      
      // Get the current called numbers and add the new one
      const calledNumbers = progressData?.called_numbers || [];
      if (!calledNumbers.includes(number)) {
        calledNumbers.push(number);
      }
      
      // Update the database
      const { error: updateError } = await supabase
        .from('sessions_progress')
        .update({ called_numbers: calledNumbers })
        .eq('session_id', targetSessionId);
      
      if (updateError) {
        console.error("Error updating called numbers:", updateError);
        return false;
      }
      
      // Broadcast the number directly to the game updates channel
      if (this.gameUpdatesChannel) {
        try {
          await this.gameUpdatesChannel.send({
            type: 'broadcast',
            event: 'number-called',
            payload: {
              number,
              calledNumbers,
              sessionId: targetSessionId,
              timestamp: new Date().toISOString()
            }
          });
          
          logWithTimestamp(`ConnectionManager: Number ${number} broadcast successfully`);
          return true;
        } catch (err) {
          console.error("Error broadcasting number call:", err);
        }
      }
      
      // Fallback to creating a temporary channel if needed
      const channel = supabase.channel(`number-broadcast-${targetSessionId}`);
      await channel.subscribe();
      
      try {
        // Send the broadcast
        await channel.send({
          type: 'broadcast',
          event: 'number-called',
          payload: {
            number,
            calledNumbers,
            sessionId: targetSessionId,
            timestamp: new Date().toISOString()
          }
        });
        
        // Clean up the channel
        supabase.removeChannel(channel);
        
        return true;
      } catch (err) {
        console.error("Error sending number call broadcast:", err);
        return false;
      }
    } catch (err) {
      console.error("Error calling number:", err);
      return false;
    }
  }

  /**
   * Fetch pending claims for a session
   * @returns Array of pending claims
   */
  public async fetchClaims(sessionId: string | null = null): Promise<any[]> {
    const targetSessionId = sessionId || this.sessionId;
    if (!targetSessionId) {
      logWithTimestamp("ConnectionManager: Cannot fetch claims - no session ID");
      return [];
    }

    try {
      logWithTimestamp(`Fetching pending claims for session ${targetSessionId}`);
      
      // Query the database for pending claims
      const { data, error } = await supabase
        .from('universal_game_logs')
        .select('*')
        .eq('session_id', targetSessionId)
        .is('validated_at', null)
        .not('claimed_at', 'is', null);
      
      if (error) {
        console.error("Error fetching claims:", error);
        return [];
      }
      
      logWithTimestamp(`Found ${data?.length || 0} pending claims`);
      return data || [];
    } catch (err) {
      console.error("Error fetching claims:", err);
      return [];
    }
  }

  /**
   * Validate a claim as valid or invalid
   * @param claim The claim to validate
   * @param isValid Whether the claim is valid
   */
  public async validateClaim(claim: any, isValid: boolean): Promise<boolean> {
    if (!this.sessionId) {
      logWithTimestamp("ConnectionManager: Cannot validate claim - no session ID");
      return false;
    }

    try {
      logWithTimestamp(`ConnectionManager: Validating claim ${claim.id} as ${isValid ? 'valid' : 'invalid'}`);
      
      // Update the claim in the database
      const { error } = await supabase
        .from('universal_game_logs')
        .update({
          validated_at: new Date().toISOString(),
          validation_result: isValid ? 'valid' : 'invalid'
        })
        .eq('id', claim.id);
      
      if (error) {
        console.error("Error validating claim:", error);
        return false;
      }
      
      // Get the player ID and session ID from the claim
      const playerId = claim.player_id;
      const sessionId = claim.session_id;
      
      // Broadcast the result to the player using the existing game channel
      if (this.gameUpdatesChannel) {
        try {
          await this.gameUpdatesChannel.send({
            type: 'broadcast',
            event: 'claim-result',
            payload: {
              claimId: claim.id,
              playerId: playerId,
              sessionId: sessionId,
              result: isValid ? 'valid' : 'invalid',
              timestamp: new Date().toISOString()
            }
          });
          
          logWithTimestamp(`ConnectionManager: Claim result broadcast successfully`);
          return true;
        } catch (err) {
          console.error("Error broadcasting claim result:", err);
        }
      }
      
      // Fallback to player-specific channel if needed
      const channel = supabase.channel(`claims-${sessionId}-${playerId}`);
      await channel.subscribe();
      
      try {
        // Send the broadcast
        await channel.send({
          type: 'broadcast',
          event: 'claim-result',
          payload: {
            claimId: claim.id,
            playerId: playerId,
            sessionId: sessionId,
            result: isValid ? 'valid' : 'invalid',
            timestamp: new Date().toISOString()
          }
        });
        
        // Clean up the channel
        supabase.removeChannel(channel);
        
        return true;
      } catch (err) {
        console.error("Error broadcasting claim validation:", err);
        return false;
      }
    } catch (err) {
      console.error("Error validating claim:", err);
      return false;
    }
  }
}

// Export a singleton instance
export const connectionManager = ConnectionManager.getInstance();
