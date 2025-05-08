import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import React from 'react';

const STORAGE_KEY_PREFIX = 'bingo-numbers-session-';
const SYNC_INTERVAL = 60000; // 60 seconds between DB syncs (changed from 5 seconds)
const LOCAL_STORAGE_SYNC_INTERVAL = 2000; // 2 seconds for local storage polling

type CalledNumbersState = {
  sessionId: string;
  calledNumbers: number[];
  lastCalledNumber: number | null;
  timestamp: string;
  synced: boolean;
  saveToDatabase: boolean; // Field for toggle
  broadcastSuccess?: boolean; // New field to track broadcast success
  broadcastId?: string; // Add unique ID for broadcast tracking
};

export class NumberCallingService {
  private sessionId: string;
  private localState: CalledNumbersState;
  private syncInterval: number | null = null;
  private localStorageSyncInterval: number | null = null;
  private subscribers: ((numbers: number[], lastCalled: number | null) => void)[] = [];
  private broadcastChannels: { [key: string]: any } = {};
  private broadcastReceived: { [key: string]: boolean } = {};
  
  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.localState = this.loadLocalState();
    
    // Setup broadcast channel listener for real-time updates
    this.setupBroadcastListener();
    
    // Start local storage sync interval for backup communication
    this.startLocalStorageSyncInterval();
    
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
      
      // If we're turning saving back on and there are unsynced changes, sync now
      if (value && !this.localState.synced) {
        this.syncToDatabase().catch(err => {
          logWithTimestamp(`[NumberCallingService] Error syncing after enabling save: ${err}`, 'error');
        });
      }
      
      // Update sync interval based on new setting
      this.updateSyncInterval();
    }
  }
  
  /**
   * Call a new number as the caller
   */
  public async callNumber(number: number): Promise<boolean> {
    logWithTimestamp(`[NumberCallingService] Calling number ${number} for session ${this.sessionId}`, 'info');
    
    // Generate a unique broadcast ID for this call
    const broadcastId = `${this.sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Update local state
    const newCalledNumbers = [...this.localState.calledNumbers];
    if (!newCalledNumbers.includes(number)) {
      newCalledNumbers.push(number);
    }
    
    this.localState.calledNumbers = newCalledNumbers;
    this.localState.lastCalledNumber = number;
    this.localState.timestamp = new Date().toISOString();
    this.localState.synced = false;
    this.localState.broadcastSuccess = false; // Reset broadcast status
    this.localState.broadcastId = broadcastId;
    
    // Save to local storage immediately
    this.saveLocalState();
    
    // Notify subscribers
    this.notifySubscribers();
    
    // Broadcast to other clients with more reliable mechanism
    let broadcastSuccess = false;
    
    try {
      // Try primary broadcast
      await this.broadcastNumber(number, broadcastId);
      broadcastSuccess = true;
      logWithTimestamp(`[NumberCallingService] Successfully broadcast number ${number} for session ${this.sessionId} (ID: ${broadcastId})`, 'info');
    } catch (err) {
      logWithTimestamp(`[NumberCallingService] Error in primary broadcasting for number ${number}: ${err}`, 'error');
      
      // Try backup broadcast method
      try {
        await this.backupBroadcastNumber(number, broadcastId);
        broadcastSuccess = true;
        logWithTimestamp(`[NumberCallingService] Successfully used backup broadcast for number ${number} (ID: ${broadcastId})`, 'info');
      } catch (backupErr) {
        logWithTimestamp(`[NumberCallingService] Backup broadcast also failed for number ${number}: ${backupErr}`, 'error');
        
        // As last resort, make sure it's saved to local storage
        this.saveLocalState();
      }
    }
    
    // Update broadcast success status
    this.localState.broadcastSuccess = broadcastSuccess;
    this.saveLocalState();
    
    // Always synchronize to database if save is enabled, regardless of broadcast success
    if (this.getSaveToDatabase()) {
      try {
        await this.syncToDatabase();
        logWithTimestamp(`[NumberCallingService] Number ${number} saved to database for session ${this.sessionId}`, 'info');
      } catch (err) {
        logWithTimestamp(`[NumberCallingService] Error saving number ${number} to database: ${err}`, 'error');
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
    
    // Generate a unique broadcast ID for this reset
    const broadcastId = `reset-${this.sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Update local state
    this.localState.calledNumbers = [];
    this.localState.lastCalledNumber = null;
    this.localState.timestamp = new Date().toISOString();
    this.localState.synced = false;
    this.localState.broadcastId = broadcastId;
    
    // Save to local storage
    this.saveLocalState();
    
    // Notify subscribers
    this.notifySubscribers();
    
    // Broadcast reset to other clients
    let broadcastSuccess = false;
    
    try {
      await this.broadcastReset(broadcastId);
      broadcastSuccess = true;
      logWithTimestamp(`[NumberCallingService] Successfully broadcast game reset for session ${this.sessionId} (ID: ${broadcastId})`, 'info');
    } catch (err) {
      logWithTimestamp(`[NumberCallingService] Error in broadcasting reset: ${err}`, 'error');
      
      // Try alternate broadcast method as backup
      try {
        await this.backupBroadcastReset(broadcastId);
        broadcastSuccess = true;
        logWithTimestamp(`[NumberCallingService] Successfully used backup broadcast for reset (ID: ${broadcastId})`, 'info');
      } catch (backupErr) {
        logWithTimestamp(`[NumberCallingService] Backup broadcast for reset also failed: ${backupErr}`, 'error');
        
        // As last resort, make sure it's saved to local storage
        this.saveLocalState();
      }
    }
    
    // Update broadcast success status
    this.localState.broadcastSuccess = broadcastSuccess;
    this.saveLocalState();
    
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
    
    // Always start local storage sync for cross-tab communication
    this.startLocalStorageSyncInterval();
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
    
    if (this.localStorageSyncInterval !== null) {
      window.clearInterval(this.localStorageSyncInterval);
      this.localStorageSyncInterval = null;
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
    localStorage.setItem(storageKey, JSON.stringify({
      ...this.localState,
      timestamp: new Date().toISOString() // Ensure timestamp is always fresh
    }));
    
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
  
  private updateSyncInterval(): void {
    // Clear any existing interval
    if (this.syncInterval !== null) {
      window.clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Only set up sync interval if saveToDatabase is true
    if (this.getSaveToDatabase()) {
      this.startPeriodicSync();
    }
  }
  
  private startPeriodicSync(): void {
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
  
  private startLocalStorageSyncInterval(): void {
    // Start a shorter interval for local storage sync for cross-tab communication
    if (this.localStorageSyncInterval !== null) {
      window.clearInterval(this.localStorageSyncInterval);
    }
    
    this.localStorageSyncInterval = window.setInterval(() => {
      this.checkLocalStorage();
    }, LOCAL_STORAGE_SYNC_INTERVAL);
    
    logWithTimestamp(`[NumberCallingService] Started local storage sync every ${LOCAL_STORAGE_SYNC_INTERVAL/1000} seconds`, 'debug');
    
    // Also add event listener for storage events
    window.addEventListener('storage', this.handleStorageChange);
  }
  
  private checkLocalStorage = () => {
    const storageKey = `${STORAGE_KEY_PREFIX}${this.sessionId}`;
    const stored = localStorage.getItem(storageKey);
    
    if (!stored) return;
    
    try {
      const parsedState = JSON.parse(stored) as CalledNumbersState;
      const storedTime = new Date(parsedState.timestamp).getTime();
      const currentTime = new Date(this.localState.timestamp).getTime();
      
      // If stored state is newer or has different content
      if (storedTime > currentTime || 
          parsedState.calledNumbers.length !== this.localState.calledNumbers.length ||
          parsedState.lastCalledNumber !== this.localState.lastCalledNumber) {
        
        logWithTimestamp(`[NumberCallingService] Found newer state in localStorage: ${parsedState.calledNumbers.length} numbers, last: ${parsedState.lastCalledNumber}`, 'debug');
        
        this.localState = parsedState;
        this.notifySubscribers();
      }
    } catch (err) {
      logWithTimestamp(`[NumberCallingService] Error checking local storage: ${err}`, 'error');
    }
  };
  
  private handleStorageChange = (event: StorageEvent) => {
    const storageKey = `${STORAGE_KEY_PREFIX}${this.sessionId}`;
    
    if (event.key === storageKey && event.newValue) {
      try {
        const parsedState = JSON.parse(event.newValue) as CalledNumbersState;
        const storedTime = new Date(parsedState.timestamp).getTime();
        const currentTime = new Date(this.localState.timestamp).getTime();
        
        logWithTimestamp(`[NumberCallingService] Storage event detected for session ${this.sessionId}`, 'debug');
        
        // If stored state is newer or has different content
        if (storedTime > currentTime || 
            parsedState.calledNumbers.length !== this.localState.calledNumbers.length ||
            parsedState.lastCalledNumber !== this.localState.lastCalledNumber) {
          
          logWithTimestamp(`[NumberCallingService] Updating state from storage event: ${parsedState.calledNumbers.length} numbers, last: ${parsedState.lastCalledNumber}`, 'debug');
          
          this.localState = parsedState;
          this.notifySubscribers();
        }
      } catch (err) {
        logWithTimestamp(`[NumberCallingService] Error handling storage event: ${err}`, 'error');
      }
    }
  };
  
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
  
  private async broadcastNumber(number: number, broadcastId: string): Promise<void> {
    try {
      logWithTimestamp(`[NumberCallingService] Broadcasting number ${number} via realtime channels for session ${this.sessionId} (ID: ${broadcastId})`, 'info');
      
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
          broadcastId: broadcastId
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
  private async backupBroadcastNumber(number: number, broadcastId: string): Promise<void> {
    try {
      logWithTimestamp(`[NumberCallingService] Using backup broadcast for number ${number} (ID: ${broadcastId})`, 'info');
      
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
          broadcastId: broadcastId,
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
  
  private async broadcastReset(broadcastId: string): Promise<void> {
    try {
      logWithTimestamp(`[NumberCallingService] Broadcasting game reset via realtime channels for session ${this.sessionId} (ID: ${broadcastId})`, 'info');
      
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
          broadcastId: broadcastId
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
  private async backupBroadcastReset(broadcastId: string): Promise<void> {
    try {
      logWithTimestamp(`[NumberCallingService] Using backup broadcast for reset in session ${this.sessionId} (ID: ${broadcastId})`, 'info');
      
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
          broadcastId: broadcastId,
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
          const { lastCalledNumber, calledNumbers, timestamp, broadcastId } = payload.payload;
          
          // Skip if we've already processed this broadcast
          if (this.broadcastReceived[broadcastId]) {
            logWithTimestamp(`[NumberCallingService] Skipping already processed broadcast: ${broadcastId}`, 'debug');
            return;
          }
          
          logWithTimestamp(`[NumberCallingService] Received number broadcast: ${lastCalledNumber}, broadcast_id: ${broadcastId}`, 'debug');
          
          // Check if the broadcast is newer than our local state
          const broadcastTime = new Date(timestamp).getTime();
          const localTime = new Date(this.localState.timestamp).getTime();
          
          if (broadcastTime > localTime || calledNumbers.length > this.localState.calledNumbers.length) {
            logWithTimestamp(`[NumberCallingService] Received newer broadcast with ${calledNumbers.length} numbers for session ${this.sessionId}`, 'info');
            
            // Update local state with the broadcast
            this.localState.calledNumbers = calledNumbers;
            this.localState.lastCalledNumber = lastCalledNumber;
            this.localState.timestamp = timestamp;
            this.localState.synced = true; // Consider it synced since it came from server
            
            // Mark this broadcast as received
            this.broadcastReceived[broadcastId] = true;
            
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
          const { lastCalledNumber, calledNumbers, timestamp, broadcastId } = payload.payload;
          
          // Skip if we've already processed this broadcast
          if (this.broadcastReceived[broadcastId]) {
            logWithTimestamp(`[NumberCallingService] Skipping already processed backup broadcast: ${broadcastId}`, 'debug');
            return;
          }
          
          logWithTimestamp(`[NumberCallingService] Received backup number broadcast: ${lastCalledNumber}, broadcast_id: ${broadcastId}`, 'debug');
          
          const broadcastTime = new Date(timestamp).getTime();
          const localTime = new Date(this.localState.timestamp).getTime();
          
          if (broadcastTime > localTime || calledNumbers.length > this.localState.calledNumbers.length) {
            logWithTimestamp(`[NumberCallingService] Applying backup broadcast with ${calledNumbers.length} numbers`, 'info');
            
            this.localState.calledNumbers = calledNumbers;
            this.localState.lastCalledNumber = lastCalledNumber;
            this.localState.timestamp = timestamp;
            this.localState.synced = true;
            
            // Mark this broadcast as received
            this.broadcastReceived[broadcastId] = true;
            
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
          const { timestamp, broadcastId } = payload.payload;
          
          // Skip if we've already processed this broadcast
          if (this.broadcastReceived[broadcastId]) {
            logWithTimestamp(`[NumberCallingService] Skipping already processed reset broadcast: ${broadcastId}`, 'debug');
            return;
          }
          
          logWithTimestamp(`[NumberCallingService] Received game reset broadcast, id: ${broadcastId}`, 'info');
          
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
            
            // Mark this broadcast as received
            this.broadcastReceived[broadcastId] = true;
            
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
          const { timestamp, broadcastId } = payload.payload;
          
          // Skip if we've already processed this broadcast
          if (this.broadcastReceived[broadcastId]) {
            logWithTimestamp(`[NumberCallingService] Skipping already processed backup reset broadcast: ${broadcastId}`, 'debug');
            return;
          }
          
          logWithTimestamp(`[NumberCallingService] Received backup reset broadcast, id: ${broadcastId}`, 'info');
          
          const broadcastTime = new Date(timestamp).getTime();
          const localTime = new Date(this.localState.timestamp).getTime();
          
          if (broadcastTime > localTime) {
            logWithTimestamp(`[NumberCallingService] Applying backup reset broadcast for session ${this.sessionId}`, 'info');
            
            this.localState.calledNumbers = [];
            this.localState.lastCalledNumber = null;
            this.localState.timestamp = timestamp;
            this.localState.synced = true;
            
            // Mark this broadcast as received
            this.broadcastReceived[broadcastId] = true;
            
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
