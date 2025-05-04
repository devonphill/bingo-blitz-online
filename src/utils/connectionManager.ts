
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
  private gameUpdatesChannel: any = null;
  private presenceChannel: any = null;
  private numberCallCallbacks: NumberCalledCallback[] = [];
  private sessionProgressCallbacks: SessionProgressCallback[] = [];
  private playersUpdateCallbacks: PlayersUpdateCallback[] = [];
  private ticketsAssignedCallbacks: TicketsAssignedCallback[] = [];
  private connectedState: boolean = false;
  
  // Private constructor to enforce singleton
  private constructor() {}
  
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
    if (this.sessionId === sessionId && this.gameUpdatesChannel) {
      logWithTimestamp(`ConnectionManager: Already connected to session ${sessionId}`);
      return this;
    }
    
    // Clean up any existing connections
    this.cleanup();
    
    // Set the new session
    this.sessionId = sessionId;
    logWithTimestamp(`ConnectionManager: Initializing connection for session ${sessionId}`);
    
    // Set up the game updates channel
    this.setupGameChannel();
    
    // Set up the presence channel for player tracking
    this.setupPresenceChannel();
    
    return this;
  }
  
  /**
   * Clean up all connections
   */
  public cleanup(): void {
    if (this.gameUpdatesChannel) {
      logWithTimestamp(`ConnectionManager: Cleaning up game channel for session ${this.sessionId}`);
      supabase.removeChannel(this.gameUpdatesChannel);
      this.gameUpdatesChannel = null;
    }
    
    if (this.presenceChannel) {
      logWithTimestamp(`ConnectionManager: Cleaning up presence channel for session ${this.sessionId}`);
      supabase.removeChannel(this.presenceChannel);
      this.presenceChannel = null;
    }
    
    this.connectedState = false;
    this.sessionId = null;
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
    
    // Clean up existing connections and set up new ones
    const sessionId = this.sessionId;
    this.cleanup();
    this.initialize(sessionId);
  }
  
  /**
   * Set up the game updates channel
   */
  private setupGameChannel(): void {
    if (!this.sessionId) return;
    
    logWithTimestamp(`ConnectionManager: Setting up game updates channel for session ${this.sessionId}`);
    
    // Create the channel
    this.gameUpdatesChannel = supabase.channel(`game-updates-${this.sessionId}`);
    
    // Subscribe to number calls
    this.gameUpdatesChannel
      .on('broadcast', { event: 'number-called' }, (payload: any) => {
        const number = payload.payload?.number ?? null;
        const allNumbers = payload.payload?.calledNumbers ?? [];
        
        logWithTimestamp(`ConnectionManager: Received number call: ${number}, total called: ${allNumbers.length}`);
        
        // Update connected state
        this.connectedState = true;
        
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
      .subscribe(status => {
        logWithTimestamp(`ConnectionManager: Game updates channel status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          // We're connected
          this.connectedState = true;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          // We're disconnected
          this.connectedState = false;
        }
      });
  }
  
  /**
   * Set up the presence channel for player tracking
   */
  private setupPresenceChannel(): void {
    if (!this.sessionId) return;
    
    logWithTimestamp(`ConnectionManager: Setting up presence channel for session ${this.sessionId}`);
    
    // Create the channel
    this.presenceChannel = supabase.channel(`presence-${this.sessionId}`);
    
    // Set up presence sync
    this.presenceChannel
      .on('presence', { event: 'sync' }, () => {
        // Get the current state - all users in the room
        const state = this.presenceChannel.presenceState();
        
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
        // Someone left
        logWithTimestamp(`ConnectionManager: Player left: ${key}`);
      })
      .subscribe();
      
    // Track our own presence if we have player info
    // This is commented out as it would depend on player info which this class doesn't have
    // If needed, we can add a method to track presence for a specific player
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
   */
  public trackPlayerPresence(playerInfo: {
    player_id: string;
    player_code: string;
    nickname: string;
    tickets?: number;
  }): void {
    if (!this.sessionId || !this.presenceChannel) {
      logWithTimestamp("ConnectionManager: Cannot track presence - no active session");
      return;
    }
    
    logWithTimestamp(`ConnectionManager: Tracking presence for player ${playerInfo.player_code}`);
    
    // Track the player's presence
    this.presenceChannel.track({
      user_id: playerInfo.player_id,
      player_code: playerInfo.player_code,
      nickname: playerInfo.nickname,
      tickets: playerInfo.tickets || 0,
      joined_at: new Date().toISOString()
    });
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
      
      // Broadcast the number to all clients
      const channel = supabase.channel(`number-broadcast-${targetSessionId}`);
      await channel.subscribe();
      
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
      
      // Broadcast the result to the player
      const channel = supabase.channel(`claims-${claim.session_id}-${claim.player_id}`);
      await channel.subscribe();
      
      // Send the broadcast
      await channel.send({
        type: 'broadcast',
        event: 'claim-result',
        payload: {
          claimId: claim.id,
          playerId: claim.player_id,
          sessionId: claim.session_id,
          result: isValid ? 'valid' : 'invalid',
          timestamp: new Date().toISOString()
        }
      });
      
      // Clean up the channel
      supabase.removeChannel(channel);
      
      return true;
    } catch (err) {
      console.error("Error validating claim:", err);
      return false;
    }
  }
}

// Export a singleton instance
export const connectionManager = ConnectionManager.getInstance();
