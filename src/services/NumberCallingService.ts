import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { webSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';

// Type for number updates subscriber
type NumberSubscriber = (numbers: number[], lastNumber: number | null) => void;

/**
 * Service for managing called numbers with websocket integration
 */
class NumberCallingService {
  private sessionId: string;
  private calledNumbers: number[] = [];
  private lastCalledNumber: number | null = null;
  private subscribers: Set<NumberSubscriber> = new Set();
  private saveToDatabase: boolean = true;
  private initialized: boolean = false;
  private instanceId: string;
  
  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.instanceId = `numCall-${Math.random().toString(36).substring(2, 7)}`;
    this.initialize();
  }
  
  /**
   * Initialize the service, fetching initial state from the database
   */
  private async initialize() {
    if (this.initialized) return;
    
    logWithTimestamp(`[${this.instanceId}] Initializing number calling service for session ${this.sessionId}`, 'info');
    
    try {
      await this.fetchStateFromDatabase();
      this.initialized = true;
    } catch (error) {
      logWithTimestamp(`[${this.instanceId}] Error initializing service: ${error}`, 'error');
    }
  }
  
  /**
   * Call a new number
   */
  public async callNumber(number: number): Promise<boolean> {
    if (!this.sessionId) {
      logWithTimestamp(`[${this.instanceId}] Cannot call number: No session ID`, 'error');
      return false;
    }
    
    // First broadcast via WebSocket for immediate updates
    const broadcastSuccess = await webSocketService.broadcastWithRetry(
      CHANNEL_NAMES.GAME_UPDATES,
      EVENT_TYPES.NUMBER_CALLED,
      {
        number,
        sessionId: this.sessionId,
        timestamp: Date.now(),
      }
    );
    
    if (!broadcastSuccess) {
      logWithTimestamp(`[${this.instanceId}] Warning: Failed to broadcast number ${number} via WebSocket`, 'warn');
      // Continue anyway since we'll also update the database
    }
    
    // Check if already called
    if (this.calledNumbers.includes(number)) {
      logWithTimestamp(`[${this.instanceId}] Number ${number} already called`, 'warn');
      return true; // Already called, so technically success
    }
    
    // Update local state
    this.calledNumbers.push(number);
    this.lastCalledNumber = number;
    
    // Notify subscribers
    this.notifySubscribers();
    
    // Save to database if enabled
    if (this.saveToDatabase) {
      try {
        const { error } = await supabase
          .from('sessions_progress')
          .update({
            called_numbers: this.calledNumbers,
            updated_at: new Date().toISOString()
          })
          .eq('session_id', this.sessionId);
          
        if (error) {
          logWithTimestamp(`[${this.instanceId}] Error saving called numbers to database: ${error.message}`, 'error');
          return false;
        }
      } catch (error) {
        logWithTimestamp(`[${this.instanceId}] Exception saving called numbers: ${error}`, 'error');
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Reset called numbers
   */
  public async resetNumbers(): Promise<boolean> {
    if (!this.sessionId) {
      logWithTimestamp(`[${this.instanceId}] Cannot reset numbers: No session ID`, 'error');
      return false;
    }
    
    // First broadcast via WebSocket for immediate updates
    const broadcastSuccess = await webSocketService.broadcastWithRetry(
      CHANNEL_NAMES.GAME_UPDATES,
      EVENT_TYPES.GAME_RESET,
      {
        sessionId: this.sessionId,
        timestamp: Date.now(),
      }
    );
    
    if (!broadcastSuccess) {
      logWithTimestamp(`[${this.instanceId}] Warning: Failed to broadcast game reset via WebSocket`, 'warn');
    }
    
    // Reset local state
    this.calledNumbers = [];
    this.lastCalledNumber = null;
    
    // Notify subscribers
    this.notifySubscribers();
    
    // Update database
    if (this.saveToDatabase) {
      try {
        const { error } = await supabase
          .from('sessions_progress')
          .update({
            called_numbers: [],
            updated_at: new Date().toISOString()
          })
          .eq('session_id', this.sessionId);
          
        if (error) {
          logWithTimestamp(`[${this.instanceId}] Error resetting numbers in database: ${error.message}`, 'error');
          return false;
        }
      } catch (error) {
        logWithTimestamp(`[${this.instanceId}] Exception resetting numbers: ${error}`, 'error');
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Fetch current state from database
   */
  private async fetchStateFromDatabase(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', this.sessionId)
        .single();
        
      if (error) {
        logWithTimestamp(`[${this.instanceId}] Error fetching called numbers from database: ${error.message}`, 'error');
        return;
      }
      
      if (data && data.called_numbers) {
        this.calledNumbers = data.called_numbers;
        this.lastCalledNumber = this.calledNumbers.length > 0 ? this.calledNumbers[this.calledNumbers.length - 1] : null;
        logWithTimestamp(`[${this.instanceId}] Loaded ${this.calledNumbers.length} numbers from database`, 'info');
      } else {
        this.calledNumbers = [];
        this.lastCalledNumber = null;
      }
      
      // Notify subscribers
      this.notifySubscribers();
    } catch (error) {
      logWithTimestamp(`[${this.instanceId}] Exception fetching state: ${error}`, 'error');
    }
  }
  
  /**
   * Subscribe to number updates
   */
  public subscribe(callback: NumberSubscriber): () => void {
    this.subscribers.add(callback);
    
    // Call immediately with current state
    callback([...this.calledNumbers], this.lastCalledNumber);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }
  
  /**
   * Notify all subscribers of updates
   */
  private notifySubscribers(): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber([...this.calledNumbers], this.lastCalledNumber);
      } catch (error) {
        logWithTimestamp(`[${this.instanceId}] Error notifying subscriber: ${error}`, 'error');
      }
    }
  }
  
  /**
   * Get called numbers
   */
  public getCalledNumbers(): number[] {
    return [...this.calledNumbers];
  }
  
  /**
   * Get last called number
   */
  public getLastCalledNumber(): number | null {
    return this.lastCalledNumber;
  }
  
  /**
   * Get save to database setting
   */
  public getSaveToDatabase(): boolean {
    return this.saveToDatabase;
  }
  
  /**
   * Set save to database setting
   */
  public setSaveToDatabase(value: boolean): void {
    this.saveToDatabase = value;
  }
}

// Mapping of active service instances
const serviceInstances: Map<string, NumberCallingService> = new Map();

/**
 * Get or create a number calling service for a session
 */
export function getNumberCallingService(sessionId: string): NumberCallingService {
  if (!serviceInstances.has(sessionId)) {
    serviceInstances.set(sessionId, new NumberCallingService(sessionId));
  }
  
  return serviceInstances.get(sessionId)!;
}
