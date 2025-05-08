
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import React from 'react'; // Add React import at the top

const STORAGE_KEY_PREFIX = 'bingo-numbers-session-';
const SYNC_INTERVAL = 60000; // 60 seconds between DB syncs (changed from 5 seconds)

type CalledNumbersState = {
  sessionId: string;
  calledNumbers: number[];
  lastCalledNumber: number | null;
  timestamp: string;
  synced: boolean;
};

export class NumberCallingService {
  private sessionId: string;
  private localState: CalledNumbersState;
  private syncInterval: number | null = null;
  private subscribers: ((numbers: number[], lastCalled: number | null) => void)[] = [];
  private broadcastChannels: { [key: string]: any } = {};
  
  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.localState = this.loadLocalState();
    
    // Setup broadcast channel listener for real-time updates
    this.setupBroadcastListener();
  }

  /**
   * Get called numbers from local storage
   */
  public getCalledNumbers(): number[] {
    return [...this.localState.calledNumbers];
  }
  
  /**
   * Get last called number from local storage
   */
  public getLastCalledNumber(): number | null {
    return this.localState.lastCalledNumber;
  }
  
  /**
   * Call a new number as the caller
   */
  public async callNumber(number: number): Promise<boolean> {
    // Update local state
    this.localState.calledNumbers.push(number);
    this.localState.lastCalledNumber = number;
    this.localState.timestamp = new Date().toISOString();
    this.localState.synced = false;
    
    // Save to local storage
    this.saveLocalState();
    
    // Notify subscribers
    this.notifySubscribers();
    
    // Broadcast to other clients with more reliable mechanism
    try {
      await this.broadcastNumber(number);
      logWithTimestamp(`Successfully broadcast number ${number}`, 'info');
    } catch (err) {
      logWithTimestamp(`Error in broadcasting number: ${err}`, 'error');
      // Even if broadcast fails, we continue since storage is updated
    }
    
    // Schedule sync if not already syncing
    if (this.syncInterval === null) {
      this.startPeriodicSync();
    }
    
    return true;
  }
  
  /**
   * Reset all called numbers (for game end/new game)
   */
  public async resetNumbers(): Promise<boolean> {
    // Update local state
    this.localState.calledNumbers = [];
    this.localState.lastCalledNumber = null;
    this.localState.timestamp = new Date().toISOString();
    this.localState.synced = false;
    
    // Save to local storage
    this.saveLocalState();
    
    // Notify subscribers
    this.notifySubscribers();
    
    // Broadcast reset to other clients
    try {
      await this.broadcastReset();
      logWithTimestamp("Successfully broadcast game reset", 'info');
    } catch (err) {
      logWithTimestamp(`Error in broadcasting reset: ${err}`, 'error');
    }
    
    // Force sync to database immediately
    await this.syncToDatabase();
    
    return true;
  }
  
  /**
   * Subscribe to number updates
   */
  public subscribe(callback: (numbers: number[], lastCalled: number | null) => void): () => void {
    this.subscribers.push(callback);
    
    // Immediately notify with current state
    callback(this.localState.calledNumbers, this.localState.lastCalledNumber);
    
    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Start the service and sync with database
   */
  public async start(): Promise<void> {
    // First try to fetch latest state from database
    await this.fetchDatabaseState();
    
    // Start periodic sync
    this.startPeriodicSync();
  }
  
  /**
   * Stop the service
   */
  public stop(): void {
    if (this.syncInterval !== null) {
      window.clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Final sync to make sure we don't lose data
    this.syncToDatabase().catch(err => {
      logWithTimestamp(`Error in final sync: ${err}`, 'error');
    });
    
    // Clean up broadcast channels
    Object.values(this.broadcastChannels).forEach(channel => {
      try {
        if (channel && channel.unsubscribe) {
          channel.unsubscribe();
        }
      } catch (err) {
        logWithTimestamp(`Error unsubscribing from channel: ${err}`, 'error');
      }
    });
    
    this.subscribers = [];
  }
  
  // Private methods
  
  private notifySubscribers(): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(this.localState.calledNumbers, this.localState.lastCalledNumber);
      } catch (err) {
        logWithTimestamp(`Error notifying subscriber: ${err}`, 'error');
      }
    }
  }
  
  private loadLocalState(): CalledNumbersState {
    const storageKey = `${STORAGE_KEY_PREFIX}${this.sessionId}`;
    const stored = localStorage.getItem(storageKey);
    
    if (!stored) {
      return {
        sessionId: this.sessionId,
        calledNumbers: [],
        lastCalledNumber: null,
        timestamp: new Date().toISOString(),
        synced: true
      };
    }
    
    try {
      return JSON.parse(stored) as CalledNumbersState;
    } catch (err) {
      logWithTimestamp(`Error parsing stored number state: ${err}`, 'error');
      return {
        sessionId: this.sessionId,
        calledNumbers: [],
        lastCalledNumber: null,
        timestamp: new Date().toISOString(),
        synced: true
      };
    }
  }
  
  private saveLocalState(): void {
    const storageKey = `${STORAGE_KEY_PREFIX}${this.sessionId}`;
    localStorage.setItem(storageKey, JSON.stringify(this.localState));
  }
  
  private startPeriodicSync(): void {
    // Clear any existing interval
    if (this.syncInterval !== null) {
      window.clearInterval(this.syncInterval);
    }
    
    // Set up new sync interval
    this.syncInterval = window.setInterval(() => {
      this.syncToDatabase().catch(err => {
        logWithTimestamp(`Error in periodic sync: ${err}`, 'error');
      });
    }, SYNC_INTERVAL);
  }
  
  private async syncToDatabase(): Promise<void> {
    // Skip if already synced
    if (this.localState.synced) {
      return;
    }
    
    try {
      logWithTimestamp(`Syncing called numbers to database for session ${this.sessionId}`, 'info');
      
      // Update sessions_progress table with current numbers
      const { error } = await supabase
        .from('sessions_progress')
        .update({ 
          called_numbers: this.localState.calledNumbers,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', this.sessionId);
        
      if (error) {
        throw error;
      }
      
      // Mark as synced
      this.localState.synced = true;
      this.saveLocalState();
      
      logWithTimestamp(`Successfully synced ${this.localState.calledNumbers.length} numbers to database`, 'info');
    } catch (err) {
      logWithTimestamp(`Error syncing to database: ${err}`, 'error');
      throw err;
    }
  }
  
  private async fetchDatabaseState(): Promise<void> {
    try {
      logWithTimestamp(`Fetching called numbers from database for session ${this.sessionId}`, 'info');
      
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers, updated_at')
        .eq('session_id', this.sessionId)
        .single();
        
      if (error) {
        throw error;
      }
      
      if (data) {
        const dbNumbers = data.called_numbers || [];
        const dbTimestamp = data.updated_at;
        
        // Only update if database state is newer than local state
        const localTimestamp = new Date(this.localState.timestamp).getTime();
        const dbTime = new Date(dbTimestamp).getTime();
        
        if (dbTime > localTimestamp) {
          logWithTimestamp(`Database state is newer, updating local state with ${dbNumbers.length} numbers`, 'info');
          
          this.localState.calledNumbers = dbNumbers;
          this.localState.lastCalledNumber = dbNumbers.length > 0 ? dbNumbers[dbNumbers.length - 1] : null;
          this.localState.timestamp = dbTimestamp;
          this.localState.synced = true;
          
          this.saveLocalState();
          this.notifySubscribers();
        } else {
          logWithTimestamp('Local state is newer than database state, keeping local state', 'info');
          // Sync local state to database if it's newer
          if (!this.localState.synced) {
            await this.syncToDatabase();
          }
        }
      }
    } catch (err) {
      logWithTimestamp(`Error fetching database state: ${err}`, 'error');
      throw err;
    }
  }
  
  private async broadcastNumber(number: number): Promise<void> {
    try {
      logWithTimestamp(`Broadcasting number ${number} via realtime channels`, 'info');
      
      // Create a channel name that's unique to this session
      const channelName = `number-broadcast-${this.sessionId}`;
      
      // Create or get existing channel
      if (!this.broadcastChannels[channelName]) {
        this.broadcastChannels[channelName] = supabase.channel(channelName);
        this.broadcastChannels[channelName].subscribe();
      }
      
      // Use the channel to send a broadcast
      const result = await this.broadcastChannels[channelName].send({
        type: 'broadcast',
        event: 'number-called',
        payload: {
          sessionId: this.sessionId,
          lastCalledNumber: number,
          calledNumbers: this.localState.calledNumbers,
          timestamp: this.localState.timestamp
        }
      });
      
      if (result.error) {
        throw result.error;
      }
      
      logWithTimestamp("Number broadcast sent successfully", 'info');
    } catch (err) {
      logWithTimestamp(`Error broadcasting number: ${err}`, 'error');
      throw err; // Re-throw the error for better error handling
    }
  }
  
  private async broadcastReset(): Promise<void> {
    try {
      logWithTimestamp(`Broadcasting game reset via realtime channels`, 'info');
      
      // Create a channel name that's unique to this session
      const channelName = `game-reset-broadcast-${this.sessionId}`;
      
      // Create or get existing channel
      if (!this.broadcastChannels[channelName]) {
        this.broadcastChannels[channelName] = supabase.channel(channelName);
        this.broadcastChannels[channelName].subscribe();
      }
      
      // Use the channel to send a broadcast
      const result = await this.broadcastChannels[channelName].send({
        type: 'broadcast',
        event: 'game-reset',
        payload: {
          sessionId: this.sessionId,
          lastCalledNumber: null,
          calledNumbers: [],
          timestamp: this.localState.timestamp
        }
      });
      
      if (result.error) {
        throw result.error;
      }
      
      logWithTimestamp("Game reset broadcast sent successfully", 'info');
    } catch (err) {
      logWithTimestamp(`Error broadcasting reset: ${err}`, 'error');
      throw err;
    }
  }
  
  private setupBroadcastListener(): void {
    // Create a unique channel name for this session
    const numberChannelName = `number-broadcast-${this.sessionId}`;
    const resetChannelName = `game-reset-broadcast-${this.sessionId}`;
    
    // Listen for number broadcasts from other clients
    this.broadcastChannels[numberChannelName] = supabase.channel(numberChannelName)
      .on('broadcast', { event: 'number-called' }, (payload) => {
        // Check if this broadcast is for our session
        if (payload.payload && payload.payload.sessionId === this.sessionId) {
          const { lastCalledNumber, calledNumbers, timestamp } = payload.payload;
          
          // Check if the broadcast is newer than our local state
          const broadcastTime = new Date(timestamp).getTime();
          const localTime = new Date(this.localState.timestamp).getTime();
          
          if (broadcastTime > localTime) {
            logWithTimestamp(`Received newer broadcast with ${calledNumbers.length} numbers`, 'info');
            
            // Update local state with the broadcast
            this.localState.calledNumbers = calledNumbers;
            this.localState.lastCalledNumber = lastCalledNumber;
            this.localState.timestamp = timestamp;
            this.localState.synced = true; // Consider it synced since it came from server
            
            this.saveLocalState();
            this.notifySubscribers();
          }
        }
      })
      .subscribe();
    
    // Listen for game reset broadcasts
    this.broadcastChannels[resetChannelName] = supabase.channel(resetChannelName)
      .on('broadcast', { event: 'game-reset' }, (payload) => {
        // Check if this broadcast is for our session
        if (payload.payload && payload.payload.sessionId === this.sessionId) {
          const { timestamp } = payload.payload;
          
          // Check if the broadcast is newer than our local state
          const broadcastTime = new Date(timestamp).getTime();
          const localTime = new Date(this.localState.timestamp).getTime();
          
          if (broadcastTime > localTime) {
            logWithTimestamp(`Received game reset broadcast`, 'info');
            
            // Update local state with empty numbers
            this.localState.calledNumbers = [];
            this.localState.lastCalledNumber = null;
            this.localState.timestamp = timestamp;
            this.localState.synced = true; // Consider it synced since it came from server
            
            this.saveLocalState();
            this.notifySubscribers();
          }
        }
      })
      .subscribe();
  }
}

// Singleton instance map to ensure one service per session
const serviceInstances = new Map<string, NumberCallingService>();

/**
 * Get or create a NumberCallingService for a specific session
 */
export function getNumberCallingService(sessionId: string): NumberCallingService {
  if (!serviceInstances.has(sessionId)) {
    const service = new NumberCallingService(sessionId);
    serviceInstances.set(sessionId, service);
    
    // Start the service
    service.start().catch(err => {
      logWithTimestamp(`Error starting NumberCallingService: ${err}`, 'error');
    });
  }
  
  return serviceInstances.get(sessionId)!;
}

/**
 * Hook to use the NumberCallingService
 */
export function useNumberCalling(sessionId: string | undefined) {
  const [calledNumbers, setCalledNumbers] = React.useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = React.useState<number | null>(null);
  
  React.useEffect(() => {
    if (!sessionId) return;
    
    // Get service and subscribe to updates
    const service = getNumberCallingService(sessionId);
    
    // Initial state
    setCalledNumbers(service.getCalledNumbers());
    setLastCalledNumber(service.getLastCalledNumber());
    
    // Subscribe to updates
    const unsubscribe = service.subscribe((numbers, last) => {
      setCalledNumbers(numbers);
      setLastCalledNumber(last);
    });
    
    // Cleanup
    return () => {
      unsubscribe();
    };
  }, [sessionId]);
  
  // Function to call a new number (for callers only)
  const callNumber = React.useCallback((number: number) => {
    if (!sessionId) return Promise.resolve(false);
    const service = getNumberCallingService(sessionId);
    return service.callNumber(number);
  }, [sessionId]);
  
  // Function to reset numbers (for callers only)
  const resetNumbers = React.useCallback(() => {
    if (!sessionId) return Promise.resolve(false);
    const service = getNumberCallingService(sessionId);
    return service.resetNumbers();
  }, [sessionId]);
  
  return {
    calledNumbers,
    lastCalledNumber,
    callNumber,
    resetNumbers
  };
}
