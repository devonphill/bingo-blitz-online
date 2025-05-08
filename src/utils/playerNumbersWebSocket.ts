
import { logWithTimestamp } from "./logUtils";
import { supabase } from "@/integrations/supabase/client";

// This singleton manages WebSocket connections for real-time number updates
class PlayerNumbersWebSocketService {
  private static instance: PlayerNumbersWebSocketService;
  private channels: Map<string, any> = new Map();
  private callbacks: Map<string, Set<(number: number, allNumbers: number[]) => void>> = new Map();
  private lastBroadcastIds: Map<string, string> = new Map();
  private lastCalledNumbers: Map<string, number[]> = new Map();

  private constructor() {
    logWithTimestamp('[PlayerNumbersWebSocket] Service initialized', 'debug');
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
    logWithTimestamp(`[PlayerNumbersWebSocket] Subscribing to session ${sessionId}`, 'info');
    
    // Initialize callback set for this session
    if (!this.callbacks.has(sessionId)) {
      this.callbacks.set(sessionId, new Set());
    }

    // Store the callback
    this.callbacks.get(sessionId)?.add(callback);

    // Initialize connection if it doesn't exist
    if (!this.channels.has(sessionId)) {
      this.initializeConnection(sessionId);
    } else {
      // If we have already received numbers, send them to the new subscriber immediately
      const existingNumbers = this.lastCalledNumbers.get(sessionId);
      if (existingNumbers && existingNumbers.length > 0) {
        const lastNumber = existingNumbers[existingNumbers.length - 1];
        callback(lastNumber, existingNumbers);
      }
    }

    // Return unsubscribe function
    return () => {
      logWithTimestamp(`[PlayerNumbersWebSocket] Unsubscribing from session ${sessionId}`, 'debug');
      this.callbacks.get(sessionId)?.delete(callback);

      // Remove channel if no more callbacks for this session
      if (this.callbacks.get(sessionId)?.size === 0) {
        this.removeSession(sessionId);
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

  // Initialize WebSocket channels for a session
  private initializeConnection(sessionId: string) {
    try {
      logWithTimestamp(`[PlayerNumbersWebSocket] Initializing connection for session ${sessionId}`, 'info');

      // Initialize with empty arrays if not already set
      if (!this.lastCalledNumbers.has(sessionId)) {
        this.lastCalledNumbers.set(sessionId, []);
      }

      // Set up multiple broadcast channels for redundancy
      const channelNames = [
        `number-broadcast-${sessionId}`,
        `number-broadcast-backup-${sessionId}`,
        `game-reset-broadcast-${sessionId}`,
        `game-reset-backup-${sessionId}`
      ];

      // Create channels and store them
      channelNames.forEach(channelName => {
        const eventType = channelName.includes('reset') ? 
          (channelName.includes('backup') ? 'game-reset-backup' : 'game-reset') :
          (channelName.includes('backup') ? 'number-called-backup' : 'number-called');

        const channel = supabase.channel(channelName)
          .on('broadcast', { event: eventType }, this.handleBroadcast(sessionId, eventType))
          .subscribe(status => {
            logWithTimestamp(`[PlayerNumbersWebSocket] Channel ${channelName} status: ${status}`, 'debug');
          });
        
        this.channels.set(channelName, channel);
      });

      // Also fetch latest state from database as a backup
      this.fetchStateFromDatabase(sessionId);

      // Add a listener for the generic 'number-broadcast' channel too
      const genericChannel = supabase.channel('number-broadcast')
        .on('broadcast', { event: 'number-called' }, payload => {
          try {
            if (payload.payload && payload.payload.sessionId === sessionId) {
              const { lastCalledNumber, calledNumbers, timestamp, broadcastId } = payload.payload;
              
              logWithTimestamp(`[PlayerNumbersWebSocket] Received number update from generic channel: ${lastCalledNumber}, sessionId: ${sessionId}`, 'info');
              
              this.handleNumberCalledEvent(sessionId, payload.payload);
            }
          } catch (error) {
            logWithTimestamp(`[PlayerNumbersWebSocket] Error handling generic broadcast: ${error}`, 'error');
          }
        })
        .subscribe(status => {
          logWithTimestamp(`[PlayerNumbersWebSocket] Generic channel status: ${status}`, 'debug');
        });
      
      this.channels.set('number-broadcast', genericChannel);

    } catch (error) {
      logWithTimestamp(`[PlayerNumbersWebSocket] Error initializing connection: ${error}`, 'error');
    }
  }

  // Remove a session and clean up
  private removeSession(sessionId: string) {
    logWithTimestamp(`[PlayerNumbersWebSocket] Removing session ${sessionId}`, 'debug');
    
    // Clean up channels
    const channelsToRemove = Array.from(this.channels.keys())
      .filter(name => name.includes(sessionId));

    channelsToRemove.forEach(name => {
      try {
        const channel = this.channels.get(name);
        if (channel) {
          supabase.removeChannel(channel);
        }
        this.channels.delete(name);
      } catch (e) {
        logWithTimestamp(`[PlayerNumbersWebSocket] Error removing channel: ${e}`, 'error');
      }
    });

    // Clean up data
    this.callbacks.delete(sessionId);
    this.lastCalledNumbers.delete(sessionId);
    this.lastBroadcastIds.delete(sessionId);
  }

  // Handle broadcast messages from WebSocket
  private handleBroadcast(sessionId: string, eventType: string) {
    return (payload: any) => {
      try {
        // Validate payload
        if (!payload.payload || payload.payload.sessionId !== sessionId) {
          return;
        }

        // Handle based on event type
        if (eventType.includes('reset')) {
          this.handleResetEvent(sessionId, payload.payload);
        } else {
          this.handleNumberCalledEvent(sessionId, payload.payload);
        }
      } catch (error) {
        logWithTimestamp(`[PlayerNumbersWebSocket] Error handling broadcast: ${error}`, 'error');
      }
    };
  }

  // Handle number called events
  private handleNumberCalledEvent(sessionId: string, payload: any) {
    const { lastCalledNumber, calledNumbers, timestamp, broadcastId } = payload;
    
    // Skip if we've already processed this broadcast
    if (broadcastId && broadcastId === this.lastBroadcastIds.get(sessionId)) {
      return;
    }

    logWithTimestamp(`[PlayerNumbersWebSocket] Received number update: ${lastCalledNumber}, total: ${calledNumbers?.length || 0}`, 'info');
    
    // Update local state
    if (calledNumbers && Array.isArray(calledNumbers)) {
      this.lastCalledNumbers.set(sessionId, [...calledNumbers]);
      
      if (broadcastId) {
        this.lastBroadcastIds.set(sessionId, broadcastId);
      }

      // Store in local storage for backup/offline support
      try {
        const storageKey = `bingo-numbers-session-${sessionId}`;
        localStorage.setItem(storageKey, JSON.stringify({
          sessionId,
          calledNumbers,
          lastCalledNumber,
          timestamp: timestamp || new Date().toISOString(),
          broadcastId,
          synced: true
        }));
      } catch (e) {
        // Ignore storage errors
      }
      
      // Notify all callbacks
      this.notifyCallbacks(sessionId, lastCalledNumber, calledNumbers);
    }
  }

  // Handle reset events
  private handleResetEvent(sessionId: string, payload: any) {
    const { timestamp, broadcastId } = payload;
    
    // Skip if we've already processed this broadcast
    if (broadcastId && broadcastId === this.lastBroadcastIds.get(sessionId)) {
      return;
    }

    logWithTimestamp(`[PlayerNumbersWebSocket] Received game reset event for session ${sessionId}`, 'info');
    
    // Reset local state
    this.lastCalledNumbers.set(sessionId, []);
    
    if (broadcastId) {
      this.lastBroadcastIds.set(sessionId, broadcastId);
    }

    // Clear local storage
    try {
      const storageKey = `bingo-numbers-session-${sessionId}`;
      localStorage.setItem(storageKey, JSON.stringify({
        sessionId,
        calledNumbers: [],
        lastCalledNumber: null,
        timestamp: timestamp || new Date().toISOString(),
        broadcastId,
        synced: true,
        reset: true
      }));
    } catch (e) {
      // Ignore storage errors
    }
    
    // Notify all callbacks with null to signal reset
    this.notifyCallbacks(sessionId, null, []);
  }

  // Notify all callbacks for a session
  private notifyCallbacks(sessionId: string, lastCalledNumber: number | null, allNumbers: number[]) {
    this.callbacks.get(sessionId)?.forEach(callback => {
      try {
        callback(lastCalledNumber!, [...allNumbers]);
      } catch (error) {
        logWithTimestamp(`[PlayerNumbersWebSocket] Error in callback: ${error}`, 'error');
      }
    });
  }

  // Fetch current state from database as a backup
  private async fetchStateFromDatabase(sessionId: string) {
    try {
      logWithTimestamp(`[PlayerNumbersWebSocket] Fetching state from database for session ${sessionId}`, 'info');
      
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers, updated_at')
        .eq('session_id', sessionId)
        .single();
        
      if (error) {
        throw error;
      }
      
      if (data && data.called_numbers) {
        const dbNumbers = data.called_numbers;
        const lastNumber = dbNumbers.length > 0 ? dbNumbers[dbNumbers.length - 1] : null;
        
        // Only update if we have numbers
        if (dbNumbers.length > 0) {
          logWithTimestamp(`[PlayerNumbersWebSocket] Loaded ${dbNumbers.length} numbers from DB, last: ${lastNumber}`, 'info');
          
          // Check if this is newer than what we have
          const currentNumbers = this.lastCalledNumbers.get(sessionId) || [];
          
          if (dbNumbers.length > currentNumbers.length) {
            // Update local state
            this.lastCalledNumbers.set(sessionId, [...dbNumbers]);
            
            // Notify callbacks
            this.notifyCallbacks(sessionId, lastNumber, dbNumbers);
            
            // Update local storage
            const storageKey = `bingo-numbers-session-${sessionId}`;
            localStorage.setItem(storageKey, JSON.stringify({
              sessionId,
              calledNumbers: dbNumbers,
              lastCalledNumber: lastNumber,
              timestamp: new Date(data.updated_at).toISOString(),
              synced: true,
              source: 'db-fetch'
            }));
          }
        }
      }
    } catch (error) {
      logWithTimestamp(`[PlayerNumbersWebSocket] Error fetching from DB: ${error}`, 'error');
    }
  }
}

// Export singleton instance getter
export const getPlayerNumbersService = () => PlayerNumbersWebSocketService.getInstance();
