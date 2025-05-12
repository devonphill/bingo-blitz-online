
import { logWithTimestamp } from "./logUtils";
import { supabase } from "@/integrations/supabase/client";

// Define consistent channel names used across the application
const GAME_UPDATES_CHANNEL = 'game-updates';
const NUMBER_CALLED_EVENT = 'number-called';
const GAME_RESET_EVENT = 'game-reset';

// This singleton manages WebSocket connections for real-time number updates
class PlayerNumbersWebSocketService {
  private static instance: PlayerNumbersWebSocketService;
  private channels: Map<string, any> = new Map();
  private callbacks: Map<string, Set<(number: number, allNumbers: number[]) => void>> = new Map();
  private lastBroadcastIds: Map<string, string> = new Map();
  private lastCalledNumbers: Map<string, number[]> = new Map();
  private instanceId: string;

  private constructor() {
    this.instanceId = `NumWS-${Math.random().toString(36).substring(2, 7)}`;
    logWithTimestamp(`[${this.instanceId}] Service initialized`, 'info');
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new PlayerNumbersWebSocketService();
    }
    return this.instance;
  }

  // Subscribe to number updates for a specific session
  public subscribeToSession(
    sessionId: string, 
    callback: (number: number, allNumbers: number[]) => void
  ): () => void {
    logWithTimestamp(`[${this.instanceId}] Subscribing to session ${sessionId}`, 'info');
    
    if (!sessionId) {
      logWithTimestamp(`[${this.instanceId}] Cannot subscribe: empty session ID`, 'error');
      return () => {};
    }
    
    // Initialize callback set for this session
    if (!this.callbacks.has(sessionId)) {
      this.callbacks.set(sessionId, new Set());
    }

    // Store the callback
    this.callbacks.get(sessionId)?.add(callback);

    // Initialize connection if it doesn't exist
    if (!this.channels.has(`${GAME_UPDATES_CHANNEL}-${sessionId}`)) {
      this.initializeConnection(sessionId);
    } else {
      // If we have already received numbers, send them to the new subscriber immediately
      const existingNumbers = this.lastCalledNumbers.get(sessionId);
      if (existingNumbers && existingNumbers.length > 0) {
        const lastNumber = existingNumbers[existingNumbers.length - 1];
        try {
          callback(lastNumber, [...existingNumbers]);
          logWithTimestamp(`[${this.instanceId}] Sent existing numbers to new subscriber: ${existingNumbers.length} numbers`, 'info');
        } catch (err) {
          logWithTimestamp(`[${this.instanceId}] Error sending existing numbers to new subscriber: ${err}`, 'error');
        }
      }
    }

    // Return unsubscribe function
    return () => {
      logWithTimestamp(`[${this.instanceId}] Unsubscribing from session ${sessionId}`, 'info');
      const callbacks = this.callbacks.get(sessionId);
      if (callbacks) {
        callbacks.delete(callback);
        
        // Remove channel if no more callbacks for this session
        if (callbacks.size === 0) {
          this.removeSession(sessionId);
        }
      }
    };
  }

  // Get current called numbers for a session
  public getCalledNumbers(sessionId: string): number[] {
    return [...(this.lastCalledNumbers.get(sessionId) || [])];
  }

  // Get last called number for a session
  public getLastCalledNumber(sessionId: string): number | null {
    const numbers = this.lastCalledNumbers.get(sessionId);
    return numbers && numbers.length > 0 ? numbers[numbers.length - 1] : null;
  }

  // Force a reconnection for a specific session
  public reconnect(sessionId: string): void {
    logWithTimestamp(`[${this.instanceId}] Forcing reconnection for session ${sessionId}`, 'info');
    
    if (!sessionId) {
      logWithTimestamp(`[${this.instanceId}] Cannot reconnect with empty session ID`, 'error');
      return;
    }
    
    // Remove the existing channel
    this.removeSession(sessionId, false); // Don't remove callbacks
    
    // Wait a moment before reconnecting
    setTimeout(() => {
      if (this.callbacks.has(sessionId) && this.callbacks.get(sessionId)!.size > 0) {
        this.initializeConnection(sessionId);
        
        // Also fetch latest state from database as a backup
        this.fetchStateFromDatabase(sessionId).then(numbers => {
          if (numbers.length > 0) {
            logWithTimestamp(`[${this.instanceId}] Reconnected and fetched ${numbers.length} numbers from DB`, 'info');
          }
        });
      }
    }, 300);
  }

  // Initialize WebSocket channels for a session
  private initializeConnection(sessionId: string) {
    try {
      logWithTimestamp(`[${this.instanceId}] Initializing connection for session ${sessionId}`, 'info');

      // Initialize with empty arrays if not already set
      if (!this.lastCalledNumbers.has(sessionId)) {
        this.lastCalledNumbers.set(sessionId, []);
      }

      // Set up the primary channel for number updates
      const mainChannel = supabase
        .channel(GAME_UPDATES_CHANNEL, {
          config: {
            broadcast: { self: true, ack: true }
          }
        })
        .on('broadcast', { event: NUMBER_CALLED_EVENT }, payload => {
          try {
            if (payload.payload && payload.payload.sessionId === sessionId) {
              const { number, timestamp, broadcastId } = payload.payload;
              
              logWithTimestamp(`[${this.instanceId}] Received number update: ${number}, sessionId: ${sessionId}`, 'info');
              
              // Update our stored numbers
              const currentNumbers = this.lastCalledNumbers.get(sessionId) || [];
              if (!currentNumbers.includes(number)) {
                const updatedNumbers = [...currentNumbers, number];
                this.lastCalledNumbers.set(sessionId, updatedNumbers);
                
                // Store broadcast ID to prevent duplicates
                if (broadcastId) {
                  this.lastBroadcastIds.set(sessionId, broadcastId);
                }
                
                // Store in local storage for backup
                this.saveNumbersToLocalStorage(sessionId, updatedNumbers, number);
                
                // Notify all callbacks
                this.notifyCallbacks(sessionId, number, updatedNumbers);
              }
            }
          } catch (error) {
            logWithTimestamp(`[${this.instanceId}] Error handling number update: ${error}`, 'error');
          }
        })
        .on('broadcast', { event: GAME_RESET_EVENT }, payload => {
          try {
            if (payload.payload && payload.payload.sessionId === sessionId) {
              logWithTimestamp(`[${this.instanceId}] Received game reset event for session ${sessionId}`, 'info');
              
              // Reset stored numbers
              this.lastCalledNumbers.set(sessionId, []);
              
              // Clear localStorage
              localStorage.removeItem(`bingo-numbers-session-${sessionId}`);
              
              // Notify callbacks with null to signal reset
              this.callbacks.get(sessionId)?.forEach(callback => {
                try {
                  callback(0, []);
                } catch (error) {
                  logWithTimestamp(`[${this.instanceId}] Error in reset callback: ${error}`, 'error');
                }
              });
            }
          } catch (error) {
            logWithTimestamp(`[${this.instanceId}] Error handling reset event: ${error}`, 'error');
          }
        })
        .subscribe(status => {
          logWithTimestamp(`[${this.instanceId}] Main channel status: ${status}`, 'info');
        });
      
      this.channels.set(`${GAME_UPDATES_CHANNEL}-${sessionId}`, mainChannel);

      // Also fetch latest state from database as a backup
      this.fetchStateFromDatabase(sessionId);

    } catch (error) {
      logWithTimestamp(`[${this.instanceId}] Error initializing connection: ${error}`, 'error');
    }
  }

  // Remove a session and clean up
  private removeSession(sessionId: string, removeCallbacks = true) {
    logWithTimestamp(`[${this.instanceId}] Removing session ${sessionId}`, 'info');
    
    // Clean up channel
    const channelKey = `${GAME_UPDATES_CHANNEL}-${sessionId}`;
    
    if (this.channels.has(channelKey)) {
      try {
        const channel = this.channels.get(channelKey);
        if (channel) {
          supabase.removeChannel(channel);
        }
        this.channels.delete(channelKey);
      } catch (e) {
        logWithTimestamp(`[${this.instanceId}] Error removing channel: ${e}`, 'error');
      }
    }

    // Clean up data if needed
    if (removeCallbacks) {
      this.callbacks.delete(sessionId);
    }
  }

  // Notify all callbacks for a session
  private notifyCallbacks(sessionId: string, lastCalledNumber: number | null, allNumbers: number[]) {
    this.callbacks.get(sessionId)?.forEach(callback => {
      try {
        callback(lastCalledNumber!, [...allNumbers]);
      } catch (error) {
        logWithTimestamp(`[${this.instanceId}] Error in callback: ${error}`, 'error');
      }
    });
  }

  // Fetch current state from database as a backup
  private async fetchStateFromDatabase(sessionId: string): Promise<number[]> {
    try {
      logWithTimestamp(`[${this.instanceId}] Fetching state from database for session ${sessionId}`, 'info');
      
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers, updated_at')
        .eq('session_id', sessionId)
        .single();
        
      if (error) {
        throw error;
      }
      
      if (data && data.called_numbers && Array.isArray(data.called_numbers)) {
        const dbNumbers = data.called_numbers;
        const lastNumber = dbNumbers.length > 0 ? dbNumbers[dbNumbers.length - 1] : null;
        
        // Only update if we have numbers
        if (dbNumbers.length > 0) {
          logWithTimestamp(`[${this.instanceId}] Loaded ${dbNumbers.length} numbers from DB, last: ${lastNumber}`, 'info');
          
          // Check if this is newer than what we have
          const currentNumbers = this.lastCalledNumbers.get(sessionId) || [];
          
          if (dbNumbers.length > currentNumbers.length) {
            // Update local state
            this.lastCalledNumbers.set(sessionId, [...dbNumbers]);
            
            // Notify callbacks
            this.notifyCallbacks(sessionId, lastNumber, dbNumbers);
            
            // Update local storage
            this.saveNumbersToLocalStorage(sessionId, dbNumbers, lastNumber);
          }
          
          return dbNumbers;
        }
      }
      
      return [];
    } catch (error) {
      logWithTimestamp(`[${this.instanceId}] Error fetching from DB: ${error}`, 'error');
      return [];
    }
  }
  
  // Save numbers to local storage
  private saveNumbersToLocalStorage(sessionId: string, numbers: number[], lastNumber: number | null) {
    try {
      const storageKey = `bingo-numbers-session-${sessionId}`;
      localStorage.setItem(storageKey, JSON.stringify({
        sessionId,
        calledNumbers: numbers,
        lastCalledNumber: lastNumber,
        timestamp: new Date().toISOString(),
        broadcastId: this.lastBroadcastIds.get(sessionId) || `local-${Date.now()}`,
        synced: true
      }));
    } catch (e) {
      // Ignore storage errors
    }
  }
}

// Export singleton instance getter
export const getPlayerNumbersService = () => PlayerNumbersWebSocketService.getInstance();
