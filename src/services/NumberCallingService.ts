
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import React from 'react';

const STORAGE_KEY_PREFIX = 'bingo-numbers-session-';
const SYNC_INTERVAL = 60000; // 60 seconds between DB syncs (changed from 5 seconds)

type CalledNumbersState = {
  sessionId: string;
  calledNumbers: number[];
  lastCalledNumber: number | null;
  timestamp: string;
  synced: boolean;
  saveToDatabase: boolean; // Field for toggle
  broadcastSuccess?: boolean; // New field to track broadcast success
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
    
    logWithTimestamp(`[NumberCallingService] Initialized for session ${sessionId} with ${this.localState.calledNumbers.length} numbers`, 'info');
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
   * Get save to database setting
   */
  public getSaveToDatabase(): boolean {
    return this.localState.saveToDatabase !== false; // Default to true if not set
  }
  
  /**
   * Set save to database setting
   */
  public setSaveToDatabase(value: boolean): void {
    if (this.localState.saveToDatabase !== value) {
      this.localState.saveToDatabase = value;
      this.saveLocalState();
      logWithTimestamp(`[NumberCallingService] Save to database setting changed to: ${value}`, 'info');
    }
  }
  
  /**
   * Call a new number as the caller
   */
  public async callNumber(number: number): Promise<boolean> {
    logWithTimestamp(`[NumberCallingService] Calling number ${number} for session ${this.sessionId}`, 'info');
    
    // Update local state
    this.localState.calledNumbers.push(number);
    this.localState.lastCalledNumber = number;
    this.localState.timestamp = new Date().toISOString();
    this.localState.synced = false;
    this.localState.broadcastSuccess = false; // Reset broadcast status
    
    // Save to local storage
    this.saveLocalState();
    
    // Notify subscribers
    this.notifySubscribers();
    
    // Broadcast to other clients with more reliable mechanism
    try {
      await this.broadcastNumber(number);
      this.localState.broadcastSuccess = true;
      this.saveLocalState();
      logWithTimestamp(`[NumberCallingService] Successfully broadcast number ${number} for session ${this.sessionId}`, 'info');
    } catch (err) {
      logWithTimestamp(`[NumberCallingService] Error in broadcasting number: ${err}`, 'error');
      
      // Try alternate broadcast method as backup
      try {
        await this.backupBroadcastNumber(number);
        this.localState.broadcastSuccess = true;
        this.saveLocalState();
        logWithTimestamp(`[NumberCallingService] Successfully used backup broadcast for number ${number}`, 'info');
      } catch (backupErr) {
        logWithTimestamp(`[NumberCallingService] Backup broadcast also failed: ${backupErr}`, 'error');
      }
    }
    
    // If saveToDatabase is enabled, sync immediately instead of waiting
    if (this.getSaveToDatabase()) {
      try {
        await this.syncToDatabase();
        logWithTimestamp(`[NumberCallingService] Number ${number} saved to database for session ${this.sessionId}`, 'info');
      } catch (err) {
        logWithTimestamp(`[NumberCallingService] Error saving number to database: ${err}`, 'error');
      }
    } else if (this.syncInterval === null) {
      // Only schedule periodic sync if not already syncing and saveToDatabase is false
      this.startPeriodicSync();
    }
    
    return true;
  }
  
  /**
   * Reset all called numbers (for game end/new game)
   */
  public async resetNumbers(): Promise<boolean> {
    logWithTimestamp(`[NumberCallingService] Resetting all numbers for session ${this.sessionId}`, 'info');
    
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
      logWithTimestamp(`[NumberCallingService] Successfully broadcast game reset for session ${this.sessionId}`, 'info');
    } catch (err) {
      logWithTimestamp(`[NumberCallingService] Error in broadcasting reset: ${err}`, 'error');
      
      // Try alternate broadcast method as backup
      try {
        await this.backupBroadcastReset();
        logWithTimestamp(`[NumberCallingService] Successfully used backup broadcast for reset`, 'info');
      } catch (backupErr) {
        logWithTimestamp(`[NumberCallingService] Backup broadcast for reset also failed: ${backupErr}`, 'error');
      }
    }
    
    // Force sync to database immediately if saveToDatabase is enabled
    if (this.getSaveToDatabase()) {
      await this.syncToDatabase();
    }
    
    return true;
  }
  
  /**
   * Subscribe to number updates
   */
  public subscribe(callback: (numbers: number[], lastCalled: number | null) => void): () => void {
    logWithTimestamp(`[NumberCallingService] New subscriber added for session ${this.sessionId}`, 'debug');
    this.subscribers.push(callback);
    
    // Immediately notify with current state
    callback(this.localState.calledNumbers, this.localState.lastCalledNumber);
    
    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
      logWithTimestamp(`[NumberCallingService] Subscriber removed for session ${this.sessionId}`, 'debug');
    };
  }
  
  /**
   * Start the service and sync with database
   */
  public async start(): Promise<void> {
    logWithTimestamp(`[NumberCallingService] Starting service for session ${this.sessionId}`, 'info');
    
    // First try to fetch latest state from database
    await this.fetchDatabaseState();
    
    // Start periodic sync if saveToDatabase is enabled
    if (this.getSaveToDatabase()) {
      this.startPeriodicSync();
    }
  }
  
  /**
   * Stop the service
   */
  public stop(): void {
    logWithTimestamp(`[NumberCallingService] Stopping service for session ${this.sessionId}`, 'info');
    
    if (this.syncInterval !== null) {
      window.clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Final sync to make sure we don't lose data if saveToDatabase is enabled
    if (this.getSaveToDatabase()) {
      this.syncToDatabase().catch(err => {
        logWithTimestamp(`[NumberCallingService] Error in final sync: ${err}`, 'error');
      });
    }
    
    // Clean up broadcast channels
    Object.values(this.broadcastChannels).forEach(channel => {
      try {
        if (channel && channel.unsubscribe) {
          channel.unsubscribe();
        }
      } catch (err) {
        logWithTimestamp(`[NumberCallingService] Error unsubscribing from channel: ${err}`, 'error');
      }
    });
    
    this.subscribers = [];
  }
  
  // Private methods
  
  private notifySubscribers(): void {
    logWithTimestamp(`[NumberCallingService] Notifying ${this.subscribers.length} subscribers about updates`, 'debug');
    
    for (const subscriber of this.subscribers) {
      try {
        subscriber(this.localState.calledNumbers, this.localState.lastCalledNumber);
      } catch (err) {
        logWithTimestamp(`[NumberCallingService] Error notifying subscriber: ${err}`, 'error');
      }
    }
  }
  
  private loadLocalState(): CalledNumbersState {
    const storageKey = `${STORAGE_KEY_PREFIX}${this.sessionId}`;
    const stored = localStorage.getItem(storageKey);
    
    if (!stored) {
      logWithTimestamp(`[NumberCallingService] No stored state found for session ${this.sessionId}, creating new`, 'debug');
      return {
        sessionId: this.sessionId,
        calledNumbers: [],
        lastCalledNumber: null,
        timestamp: new Date().toISOString(),
        synced: true,
        saveToDatabase: true // Default to true for backward compatibility
      };
    }
    
    try {
      const parsed = JSON.parse(stored) as CalledNumbersState;
      // Ensure the saveToDatabase field exists (backward compatibility)
      if (parsed.saveToDatabase === undefined) {
        parsed.saveToDatabase = true;
      }
      
      logWithTimestamp(`[NumberCallingService] Loaded stored state for session ${this.sessionId}: ${parsed.calledNumbers.length} numbers, last: ${parsed.lastCalledNumber}`, 'debug');
      return parsed;
    } catch (err) {
      logWithTimestamp(`[NumberCallingService] Error parsing stored number state: ${err}`, 'error');
      return {
        sessionId: this.sessionId,
        calledNumbers: [],
        lastCalledNumber: null,
        timestamp: new Date().toISOString(),
        synced: true,
        saveToDatabase: true
      };
    }
  }
  
  private saveLocalState(): void {
    const storageKey = `${STORAGE_KEY_PREFIX}${this.sessionId}`;
    localStorage.setItem(storageKey, JSON.stringify(this.localState));
    
    // Dispatch a storage event to notify other tabs/windows
    try {
      const storageEvent = new StorageEvent('storage', {
        key: storageKey,
        newValue: JSON.stringify(this.localState),
        url: window.location.href
      });
      
      window.dispatchEvent(storageEvent);
      logWithTimestamp(`[NumberCallingService] Dispatched storage event for session ${this.sessionId}`, 'debug');
    } catch (err) {
      // Some browsers might not support creating StorageEvent
      logWithTimestamp(`[NumberCallingService] Could not dispatch storage event: ${err}`, 'debug');
    }
  }
  
  private startPeriodicSync(): void {
    // Clear any existing interval
    if (this.syncInterval !== null) {
      window.clearInterval(this.syncInterval);
    }
    
    // Only set up sync interval if saveToDatabase is true
    if (!this.getSaveToDatabase()) {
      this.syncInterval = null;
      return;
    }
    
    // Set up new sync interval
    this.syncInterval = window.setInterval(() => {
      if (this.getSaveToDatabase()) {
        this.syncToDatabase().catch(err => {
          logWithTimestamp(`[NumberCallingService] Error in periodic sync: ${err}`, 'error');
        });
      }
    }, SYNC_INTERVAL);
    
    logWithTimestamp(`[NumberCallingService] Started periodic sync every ${SYNC_INTERVAL/1000} seconds`, 'debug');
  }
  
  private async syncToDatabase(): Promise<void> {
    // Skip if already synced or saveToDatabase is disabled
    if (this.localState.synced || !this.getSaveToDatabase()) {
      return;
    }
    
    try {
      logWithTimestamp(`[NumberCallingService] Syncing ${this.localState.calledNumbers.length} called numbers to database for session ${this.sessionId}`, 'info');
      
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
      
      logWithTimestamp(`[NumberCallingService] Successfully synced ${this.localState.calledNumbers.length} numbers to database`, 'info');
    } catch (err) {
      logWithTimestamp(`[NumberCallingService] Error syncing to database: ${err}`, 'error');
      throw err;
    }
  }
  
  private async fetchDatabaseState(): Promise<void> {
    try {
      logWithTimestamp(`[NumberCallingService] Fetching called numbers from database for session ${this.sessionId}`, 'info');
      
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
          logWithTimestamp(`[NumberCallingService] Database state is newer, updating local state with ${dbNumbers.length} numbers`, 'info');
          
          this.localState.calledNumbers = dbNumbers;
          this.localState.lastCalledNumber = dbNumbers.length > 0 ? dbNumbers[dbNumbers.length - 1] : null;
          this.localState.timestamp = dbTimestamp;
          this.localState.synced = true;
          
          this.saveLocalState();
          this.notifySubscribers();
        } else {
          logWithTimestamp('[NumberCallingService] Local state is newer than database state, keeping local state', 'info');
          // Sync local state to database if it's newer and saveToDatabase is enabled
          if (!this.localState.synced && this.getSaveToDatabase()) {
            await this.syncToDatabase();
          }
        }
      }
    } catch (err) {
      logWithTimestamp(`[NumberCallingService] Error fetching database state: ${err}`, 'error');
      throw err;
    }
  }
  
  private async broadcastNumber(number: number): Promise<void> {
    try {
      logWithTimestamp(`[NumberCallingService] Broadcasting number ${number} via realtime channels for session ${this.sessionId}`, 'info');
      
      // Create a channel name that's unique to this session
      const channelName = `number-broadcast-${this.sessionId}`;
      
      // Create or get existing channel
      if (!this.broadcastChannels[channelName]) {
        this.broadcastChannels[channelName] = supabase.channel(channelName);
        this.broadcastChannels[channelName].subscribe(status => {
          logWithTimestamp(`[NumberCallingService] Channel ${channelName} status: ${status}`, 'debug');
        });
      }
      
      // Use the channel to send a broadcast
      const result = await this.broadcastChannels[channelName].send({
        type: 'broadcast',
        event: 'number-called',
        payload: {
          sessionId: this.sessionId,
          lastCalledNumber: number,
          calledNumbers: this.localState.calledNumbers,
          timestamp: this.localState.timestamp,
          broadcast_id: Date.now() // Add unique ID to track broadcast
        }
      });
      
      if (result.error) {
        throw result.error;
      }
      
      logWithTimestamp(`[NumberCallingService] Number broadcast sent successfully for session ${this.sessionId}`, 'info');
    } catch (err) {
      logWithTimestamp(`[NumberCallingService] Error broadcasting number: ${err}`, 'error');
      throw err; // Re-throw the error for better error handling
    }
  }
  
  // Added backup broadcast method using a different channel name
  private async backupBroadcastNumber(number: number): Promise<void> {
    try {
      logWithTimestamp(`[NumberCallingService] Using backup broadcast for number ${number}`, 'info');
      
      // Create a channel name that's unique to this session but different from primary
      const channelName = `number-broadcast-backup-${this.sessionId}`;
      
      // Create or get existing channel
      if (!this.broadcastChannels[channelName]) {
        this.broadcastChannels[channelName] = supabase.channel(channelName);
        this.broadcastChannels[channelName].subscribe(status => {
          logWithTimestamp(`[NumberCallingService] Backup channel ${channelName} status: ${status}`, 'debug');
        });
      }
      
      // Use the channel to send a broadcast
      const result = await this.broadcastChannels[channelName].send({
        type: 'broadcast',
        event: 'number-called-backup',
        payload: {
          sessionId: this.sessionId,
          lastCalledNumber: number,
          calledNumbers: this.localState.calledNumbers,
          timestamp: this.localState.timestamp,
          broadcast_id: Date.now(),
          is_backup: true
        }
      });
      
      if (result.error) {
        throw result.error;
      }
      
      logWithTimestamp(`[NumberCallingService] Backup number broadcast sent successfully`, 'info');
    } catch (err) {
      logWithTimestamp(`[NumberCallingService] Error in backup broadcasting: ${err}`, 'error');
      throw err;
    }
  }
  
  private async broadcastReset(): Promise<void> {
    try {
      logWithTimestamp(`[NumberCallingService] Broadcasting game reset via realtime channels for session ${this.sessionId}`, 'info');
      
      // Create a channel name that's unique to this session
      const channelName = `game-reset-broadcast-${this.sessionId}`;
      
      // Create or get existing channel
      if (!this.broadcastChannels[channelName]) {
        this.broadcastChannels[channelName] = supabase.channel(channelName);
        this.broadcastChannels[channelName].subscribe(status => {
          logWithTimestamp(`[NumberCallingService] Reset channel ${channelName} status: ${status}`, 'debug');
        });
      }
      
      // Use the channel to send a broadcast
      const result = await this.broadcastChannels[channelName].send({
        type: 'broadcast',
        event: 'game-reset',
        payload: {
          sessionId: this.sessionId,
          lastCalledNumber: null,
          calledNumbers: [],
          timestamp: this.localState.timestamp,
          broadcast_id: Date.now()
        }
      });
      
      if (result.error) {
        throw result.error;
      }
      
      logWithTimestamp(`[NumberCallingService] Game reset broadcast sent successfully for session ${this.sessionId}`, 'info');
    } catch (err) {
      logWithTimestamp(`[NumberCallingService] Error broadcasting reset: ${err}`, 'error');
      throw err;
    }
  }
  
  // Added backup broadcast reset method
  private async backupBroadcastReset(): Promise<void> {
    try {
      logWithTimestamp(`[NumberCallingService] Using backup broadcast for reset in session ${this.sessionId}`, 'info');
      
      // Create a channel name that's unique to this session
      const channelName = `game-reset-backup-${this.sessionId}`;
      
      // Create or get existing channel
      if (!this.broadcastChannels[channelName]) {
        this.broadcastChannels[channelName] = supabase.channel(channelName);
        this.broadcastChannels[channelName].subscribe(status => {
          logWithTimestamp(`[NumberCallingService] Backup reset channel ${channelName} status: ${status}`, 'debug');
        });
      }
      
      // Use the channel to send a broadcast
      const result = await this.broadcastChannels[channelName].send({
        type: 'broadcast',
        event: 'game-reset-backup',
        payload: {
          sessionId: this.sessionId,
          lastCalledNumber: null,
          calledNumbers: [],
          timestamp: this.localState.timestamp,
          broadcast_id: Date.now(),
          is_backup: true
        }
      });
      
      if (result.error) {
        throw result.error;
      }
      
      logWithTimestamp(`[NumberCallingService] Backup game reset broadcast sent successfully`, 'info');
    } catch (err) {
      logWithTimestamp(`[NumberCallingService] Error in backup reset broadcast: ${err}`, 'error');
      throw err;
    }
  }
  
  private setupBroadcastListener(): void {
    // Create unique channel names for this session
    const numberChannelName = `number-broadcast-${this.sessionId}`;
    const resetChannelName = `game-reset-broadcast-${this.sessionId}`;
    const backupNumberChannelName = `number-broadcast-backup-${this.sessionId}`;
    const backupResetChannelName = `game-reset-backup-${this.sessionId}`;
    
    logWithTimestamp(`[NumberCallingService] Setting up broadcast listeners for session ${this.sessionId}`, 'info');
    
    // Listen for number broadcasts from other clients
    this.broadcastChannels[numberChannelName] = supabase.channel(numberChannelName)
      .on('broadcast', { event: 'number-called' }, (payload) => {
        // Check if this broadcast is for our session
        if (payload.payload && payload.payload.sessionId === this.sessionId) {
          const { lastCalledNumber, calledNumbers, timestamp, broadcast_id } = payload.payload;
          
          logWithTimestamp(`[NumberCallingService] Received number broadcast: ${lastCalledNumber}, broadcast_id: ${broadcast_id}`, 'debug');
          
          // Check if the broadcast is newer than our local state
          const broadcastTime = new Date(timestamp).getTime();
          const localTime = new Date(this.localState.timestamp).getTime();
          
          if (broadcastTime > localTime) {
            logWithTimestamp(`[NumberCallingService] Received newer broadcast with ${calledNumbers.length} numbers for session ${this.sessionId}`, 'info');
            
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
      .subscribe(status => {
        logWithTimestamp(`[NumberCallingService] Number broadcast channel status: ${status}`, 'debug');
      });
    
    // Listen for backup broadcasts
    this.broadcastChannels[backupNumberChannelName] = supabase.channel(backupNumberChannelName)
      .on('broadcast', { event: 'number-called-backup' }, (payload) => {
        if (payload.payload && payload.payload.sessionId === this.sessionId) {
          const { lastCalledNumber, calledNumbers, timestamp, broadcast_id } = payload.payload;
          
          logWithTimestamp(`[NumberCallingService] Received backup number broadcast: ${lastCalledNumber}, broadcast_id: ${broadcast_id}`, 'debug');
          
          const broadcastTime = new Date(timestamp).getTime();
          const localTime = new Date(this.localState.timestamp).getTime();
          
          if (broadcastTime > localTime) {
            logWithTimestamp(`[NumberCallingService] Applying backup broadcast with ${calledNumbers.length} numbers`, 'info');
            
            this.localState.calledNumbers = calledNumbers;
            this.localState.lastCalledNumber = lastCalledNumber;
            this.localState.timestamp = timestamp;
            this.localState.synced = true;
            
            this.saveLocalState();
            this.notifySubscribers();
          }
        }
      })
      .subscribe(status => {
        logWithTimestamp(`[NumberCallingService] Backup number channel status: ${status}`, 'debug');
      });
    
    // Listen for game reset broadcasts
    this.broadcastChannels[resetChannelName] = supabase.channel(resetChannelName)
      .on('broadcast', { event: 'game-reset' }, (payload) => {
        // Check if this broadcast is for our session
        if (payload.payload && payload.payload.sessionId === this.sessionId) {
          const { timestamp, broadcast_id } = payload.payload;
          
          logWithTimestamp(`[NumberCallingService] Received game reset broadcast, id: ${broadcast_id}`, 'info');
          
          // Check if the broadcast is newer than our local state
          const broadcastTime = new Date(timestamp).getTime();
          const localTime = new Date(this.localState.timestamp).getTime();
          
          if (broadcastTime > localTime) {
            logWithTimestamp(`[NumberCallingService] Applying game reset broadcast for session ${this.sessionId}`, 'info');
            
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
      .subscribe(status => {
        logWithTimestamp(`[NumberCallingService] Reset broadcast channel status: ${status}`, 'debug');
      });
      
    // Listen for backup reset broadcasts
    this.broadcastChannels[backupResetChannelName] = supabase.channel(backupResetChannelName)
      .on('broadcast', { event: 'game-reset-backup' }, (payload) => {
        if (payload.payload && payload.payload.sessionId === this.sessionId) {
          const { timestamp, broadcast_id } = payload.payload;
          
          logWithTimestamp(`[NumberCallingService] Received backup reset broadcast, id: ${broadcast_id}`, 'info');
          
          const broadcastTime = new Date(timestamp).getTime();
          const localTime = new Date(this.localState.timestamp).getTime();
          
          if (broadcastTime > localTime) {
            logWithTimestamp(`[NumberCallingService] Applying backup reset broadcast for session ${this.sessionId}`, 'info');
            
            this.localState.calledNumbers = [];
            this.localState.lastCalledNumber = null;
            this.localState.timestamp = timestamp;
            this.localState.synced = true;
            
            this.saveLocalState();
            this.notifySubscribers();
          }
        }
      })
      .subscribe(status => {
        logWithTimestamp(`[NumberCallingService] Backup reset channel status: ${status}`, 'debug');
      });
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
  const [saveToDatabase, setSaveToDatabase] = React.useState<boolean>(true);
  
  React.useEffect(() => {
    if (!sessionId) return;
    
    // Get service and subscribe to updates
    const service = getNumberCallingService(sessionId);
    
    // Initial state
    setCalledNumbers(service.getCalledNumbers());
    setLastCalledNumber(service.getLastCalledNumber());
    setSaveToDatabase(service.getSaveToDatabase());
    
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
  
  // Function to toggle save to database setting
  const toggleSaveToDatabase = React.useCallback(() => {
    if (!sessionId) return;
    const service = getNumberCallingService(sessionId);
    const newValue = !service.getSaveToDatabase();
    service.setSaveToDatabase(newValue);
    setSaveToDatabase(newValue);
  }, [sessionId]);
  
  return {
    calledNumbers,
    lastCalledNumber,
    callNumber,
    resetNumbers,
    saveToDatabase,
    toggleSaveToDatabase
  };
}
