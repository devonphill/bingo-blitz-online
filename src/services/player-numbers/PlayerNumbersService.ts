import { logWithTimestamp } from "@/utils/logUtils";
import { NumberUpdateCallback, NumberBroadcastPayload, SessionSubscriptionOptions } from "./types";
import { saveNumbersToLocalStorage, getNumbersFromLocalStorage, clearNumbersFromLocalStorage } from "./storageUtils";
import { fetchNumbersFromDatabase } from "./databaseUtils";
import { NumbersChannelManager } from "./channelManager";

/**
 * This service manages WebSocket connections for real-time number updates
 */
export class PlayerNumbersService {
  private static instance: PlayerNumbersService;
  private callbacks: Map<string, Set<NumberUpdateCallback>> = new Map();
  private lastBroadcastIds: Map<string, string> = new Map();
  private lastCalledNumbers: Map<string, number[]> = new Map();
  private channelManager: NumbersChannelManager;
  private instanceId: string;

  private constructor() {
    this.instanceId = `NumSvc-${Math.random().toString(36).substring(2, 7)}`;
    this.channelManager = new NumbersChannelManager();
    logWithTimestamp(`[${this.instanceId}] Service initialized`, 'info');
  }

  static getInstance(): PlayerNumbersService {
    if (!this.instance) {
      this.instance = new PlayerNumbersService();
    }
    return this.instance;
  }

  /**
   * Subscribe to number updates for a specific session
   */
  public subscribe(
    sessionId: string, 
    callback: NumberUpdateCallback,
    options: SessionSubscriptionOptions = {}
  ): () => void {
    logWithTimestamp(`[${this.instanceId}] Subscribing to session ${sessionId}`, 'info');
    
    if (!sessionId) {
      logWithTimestamp(`[${this.instanceId}] Cannot subscribe: empty session ID`, 'error');
      return () => {};
    }
    
    // Initialize callback set for this session
    if (!this.callbacks.has(sessionId)) {
      this.callbacks.set(sessionId, new Set());
      this.initializeSessionConnection(sessionId, options);
    }

    // Store the callback
    this.callbacks.get(sessionId)?.add(callback);

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

  /**
   * Get current called numbers for a session
   */
  public getCalledNumbers(sessionId: string): number[] {
    return [...(this.lastCalledNumbers.get(sessionId) || [])];
  }

  /**
   * Get last called number for a session
   */
  public getLastCalledNumber(sessionId: string): number | null {
    const numbers = this.lastCalledNumbers.get(sessionId);
    return numbers && numbers.length > 0 ? numbers[numbers.length - 1] : null;
  }

  /**
   * Force a reconnection for a specific session
   */
  public reconnect(sessionId: string, options: SessionSubscriptionOptions = {}): void {
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
        this.initializeSessionConnection(sessionId, options);
      }
    }, 300);
  }

  /**
   * Initialize connection and channels for a session
   */
  private initializeSessionConnection(sessionId: string, options: SessionSubscriptionOptions = {}): void {
    try {
      logWithTimestamp(`[${this.instanceId}] Initializing connection for session ${sessionId}`, 'info');

      // Initialize with empty arrays if not already set
      if (!this.lastCalledNumbers.has(sessionId)) {
        this.lastCalledNumbers.set(sessionId, []);
      }

      // Set up channels
      this.channelManager.setupChannels(
        sessionId,
        // Number called handler
        (payload: NumberBroadcastPayload) => this.handleNumberCalled(sessionId, payload),
        // Game reset handler  
        (payload: NumberBroadcastPayload) => this.handleGameReset(sessionId, payload)
      );

      // Check local storage for existing data if enabled
      if (options.enableLocalStorage !== false) {
        const storedData = getNumbersFromLocalStorage(sessionId);
        if (storedData && storedData.calledNumbers.length > 0) {
          const currentNumbers = this.lastCalledNumbers.get(sessionId) || [];
          
          if (storedData.calledNumbers.length > currentNumbers.length) {
            this.lastCalledNumbers.set(sessionId, [...storedData.calledNumbers]);
            if (storedData.broadcastId) {
              this.lastBroadcastIds.set(sessionId, storedData.broadcastId);
            }
            
            // Notify all callbacks
            this.notifyCallbacks(
              sessionId, 
              storedData.lastCalledNumber!, 
              storedData.calledNumbers
            );
          }
        }
      }

      // Also fetch latest state from database as a backup if enabled
      if (options.enableDatabaseFallback !== false) {
        this.fetchStateFromDatabase(sessionId);
      }
    } catch (error) {
      logWithTimestamp(`[${this.instanceId}] Error initializing connection: ${error}`, 'error');
    }
  }

  /**
   * Handle number called event
   */
  private handleNumberCalled(sessionId: string, payload: NumberBroadcastPayload): void {
    try {
      const { number, timestamp, broadcastId, calledNumbers } = payload;
      
      logWithTimestamp(`[${this.instanceId}] Received number update: ${number}, sessionId: ${sessionId}`, 'info');
      
      // Skip if we've already processed this broadcast
      if (broadcastId && this.lastBroadcastIds.get(sessionId) === broadcastId) {
        logWithTimestamp(`[${this.instanceId}] Skipping duplicate broadcast: ${broadcastId}`, 'debug');
        return;
      }
      
      // Update our stored numbers
      let updatedNumbers: number[];
      
      if (calledNumbers && calledNumbers.length > 0) {
        // If we received full list of called numbers, use that
        updatedNumbers = [...calledNumbers];
      } else if (number !== undefined) {
        // Otherwise add the new number to our existing list
        const currentNumbers = this.lastCalledNumbers.get(sessionId) || [];
        if (!currentNumbers.includes(number)) {
          updatedNumbers = [...currentNumbers, number];
        } else {
          // Skip if we already have this number
          return;
        }
      } else {
        // No valid data to process
        return;
      }
      
      // Update our stored state
      this.lastCalledNumbers.set(sessionId, updatedNumbers);
      
      // Store broadcast ID to prevent duplicates
      if (broadcastId) {
        this.lastBroadcastIds.set(sessionId, broadcastId);
      }
      
      // Get last called number
      const lastCalledNumber = payload.lastCalledNumber !== undefined
        ? payload.lastCalledNumber
        : (updatedNumbers.length > 0 ? updatedNumbers[updatedNumbers.length - 1] : null);
      
      // Store in local storage for backup
      saveNumbersToLocalStorage(sessionId, updatedNumbers, lastCalledNumber, broadcastId);
      
      // Notify all callbacks
      this.notifyCallbacks(sessionId, lastCalledNumber!, updatedNumbers);
    } catch (error) {
      logWithTimestamp(`[${this.instanceId}] Error handling number update: ${error}`, 'error');
    }
  }

  /**
   * Handle game reset event
   */
  private handleGameReset(sessionId: string, payload: NumberBroadcastPayload): void {
    try {
      const { timestamp, broadcastId } = payload;
      
      // Skip if we've already processed this broadcast
      if (broadcastId && this.lastBroadcastIds.get(sessionId) === broadcastId) {
        logWithTimestamp(`[${this.instanceId}] Skipping duplicate reset broadcast: ${broadcastId}`, 'debug');
        return;
      }
      
      logWithTimestamp(`[${this.instanceId}] Received game reset event for session ${sessionId}`, 'info');
      
      // Reset stored numbers
      this.lastCalledNumbers.set(sessionId, []);
      
      // Store broadcast ID
      if (broadcastId) {
        this.lastBroadcastIds.set(sessionId, broadcastId);
      }
      
      // Clear localStorage
      clearNumbersFromLocalStorage(sessionId);
      
      // Notify callbacks with null to signal reset
      this.callbacks.get(sessionId)?.forEach(callback => {
        try {
          callback(0, []);
        } catch (error) {
          logWithTimestamp(`[${this.instanceId}] Error in reset callback: ${error}`, 'error');
        }
      });
    } catch (error) {
      logWithTimestamp(`[${this.instanceId}] Error handling reset event: ${error}`, 'error');
    }
  }

  /**
   * Remove a session and clean up
   */
  private removeSession(sessionId: string, removeCallbacks = true): void {
    logWithTimestamp(`[${this.instanceId}] Removing session ${sessionId}`, 'info');
    
    // Clean up channels
    this.channelManager.removeChannels(sessionId);

    // Clean up data if needed
    if (removeCallbacks) {
      this.callbacks.delete(sessionId);
    }
  }

  /**
   * Notify all callbacks for a session
   */
  private notifyCallbacks(sessionId: string, lastCalledNumber: number | null, allNumbers: number[]): void {
    this.callbacks.get(sessionId)?.forEach(callback => {
      try {
        callback(lastCalledNumber!, [...allNumbers]);
      } catch (error) {
        logWithTimestamp(`[${this.instanceId}] Error in callback: ${error}`, 'error');
      }
    });
  }

  /**
   * Fetch current state from database as a backup
   */
  private async fetchStateFromDatabase(sessionId: string): Promise<number[]> {
    const dbNumbers = await fetchNumbersFromDatabase(sessionId);
    
    if (dbNumbers.length > 0) {
      // Check if this is newer than what we have
      const currentNumbers = this.lastCalledNumbers.get(sessionId) || [];
      
      if (dbNumbers.length > currentNumbers.length) {
        const lastNumber = dbNumbers.length > 0 ? dbNumbers[dbNumbers.length - 1] : null;
        
        // Update local state
        this.lastCalledNumbers.set(sessionId, [...dbNumbers]);
        
        // Notify callbacks
        this.notifyCallbacks(sessionId, lastNumber, dbNumbers);
        
        // Update local storage
        saveNumbersToLocalStorage(sessionId, dbNumbers, lastNumber);
      }
      
      return dbNumbers;
    }
    
    return [];
  }
}

// Export singleton getter
export const getPlayerNumbersService = () => PlayerNumbersService.getInstance();
