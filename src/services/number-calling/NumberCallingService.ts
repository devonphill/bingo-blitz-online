
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { webSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';

export type NumberCalledListener = (number: number, allNumbers: number[]) => void;

export class NumberCallingService {
  private static instance: NumberCallingService;
  private listeners: Map<string, NumberCalledListener[]> = new Map();
  private sessionNumbers: Map<string, number[]> = new Map();
  private lastCalledNumber: Map<string, number | null> = new Map();
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  // Get singleton instance
  public static getInstance(): NumberCallingService {
    if (!NumberCallingService.instance) {
      NumberCallingService.instance = new NumberCallingService();
    }
    return NumberCallingService.instance;
  }
  
  // Call a new number for a session
  public async callNumber(number: number, sessionId: string): Promise<boolean> {
    try {
      logWithTimestamp(`NumberCallingService: Calling number ${number} for session ${sessionId}`, 'info');
      
      // Update our local state
      const numbers = this.sessionNumbers.get(sessionId) || [];
      
      // Don't add the number if it's already been called
      if (numbers.includes(number)) {
        logWithTimestamp(`NumberCallingService: Number ${number} already called`, 'warn');
        return false;
      }
      
      const updatedNumbers = [...numbers, number];
      this.sessionNumbers.set(sessionId, updatedNumbers);
      this.lastCalledNumber.set(sessionId, number);
      
      // Update the database
      await this.updateCalledNumbers(sessionId, updatedNumbers);
      
      // Broadcast the number to all clients
      await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.NUMBER_CALLED,
        { number, sessionId, timestamp: Date.now() },
        { retries: 3 }
      );
      
      // Notify listeners
      this.notifyListeners(sessionId, number, updatedNumbers);
      
      return true;
    } catch (error) {
      logWithTimestamp(`NumberCallingService: Error calling number: ${error}`, 'error');
      return false;
    }
  }
  
  // Reset all called numbers for a session
  public async resetNumbers(sessionId: string): Promise<boolean> {
    try {
      logWithTimestamp(`NumberCallingService: Resetting numbers for session ${sessionId}`, 'info');
      
      // Clear local state
      this.sessionNumbers.set(sessionId, []);
      this.lastCalledNumber.set(sessionId, null);
      
      // Update database
      await this.updateCalledNumbers(sessionId, []);
      
      // Broadcast reset
      await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.GAME_RESET,
        { sessionId, timestamp: Date.now() },
        { retries: 3 }
      );
      
      // Notify listeners with null to indicate reset
      this.listeners.get(sessionId)?.forEach(listener => {
        try {
          listener(null as any, []);
        } catch (error) {
          console.error('Error notifying listener:', error);
        }
      });
      
      return true;
    } catch (error) {
      logWithTimestamp(`NumberCallingService: Error resetting numbers: ${error}`, 'error');
      return false;
    }
  }
  
  // Update the called numbers in the database
  public async updateCalledNumbers(sessionId: string, numbers: number[]): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sessions_progress')
        .update({ called_numbers: numbers, updated_at: new Date().toISOString() })
        .eq('session_id', sessionId);
      
      if (error) {
        throw new Error(`Failed to update called numbers: ${error.message}`);
      }
      
      return true;
    } catch (error) {
      logWithTimestamp(`NumberCallingService: Error updating called numbers: ${error}`, 'error');
      return false;
    }
  }
  
  // Get all called numbers for a session
  public async getCalledNumbers(sessionId: string): Promise<number[]> {
    try {
      // Check local cache first
      const cachedNumbers = this.sessionNumbers.get(sessionId);
      if (cachedNumbers) {
        return cachedNumbers;
      }
      
      // If not in cache, fetch from database
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', sessionId)
        .single();
      
      if (error) {
        throw new Error(`Failed to fetch called numbers: ${error.message}`);
      }
      
      const numbers = data?.called_numbers || [];
      
      // Update local cache
      this.sessionNumbers.set(sessionId, numbers);
      
      return numbers;
    } catch (error) {
      logWithTimestamp(`NumberCallingService: Error getting called numbers: ${error}`, 'error');
      return [];
    }
  }
  
  // Get the last called number for a session
  public async getLastCalledNumber(sessionId: string): Promise<number | null> {
    try {
      // Check cache first
      const cachedLastNumber = this.lastCalledNumber.get(sessionId);
      if (cachedLastNumber !== undefined) {
        return cachedLastNumber;
      }
      
      // If not in cache, get all numbers and use the last one
      const numbers = await this.getCalledNumbers(sessionId);
      
      if (numbers.length === 0) {
        this.lastCalledNumber.set(sessionId, null);
        return null;
      }
      
      const lastNumber = numbers[numbers.length - 1];
      this.lastCalledNumber.set(sessionId, lastNumber);
      
      return lastNumber;
    } catch (error) {
      logWithTimestamp(`NumberCallingService: Error getting last called number: ${error}`, 'error');
      return null;
    }
  }
  
  // Subscribe to number updates for a session
  public subscribe(sessionId: string, listener: NumberCalledListener): () => void {
    // Initialize listener array if needed
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, []);
    }
    
    // Add the listener
    this.listeners.get(sessionId)!.push(listener);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(sessionId);
      if (!listeners) return;
      
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }
  
  // Notify all listeners for a session
  public notifyListeners(sessionId: string, number: number, allNumbers: number[]): void {
    const listeners = this.listeners.get(sessionId);
    if (!listeners) return;
    
    listeners.forEach(listener => {
      try {
        listener(number, allNumbers);
      } catch (error) {
        console.error('Error notifying listener:', error);
      }
    });
  }
}

// Export singleton instance
export const numberCallingService = NumberCallingService.getInstance();

// Export function to get the service instance for compatibility
export const getNumberCallingService = (): NumberCallingService => {
  return NumberCallingService.getInstance();
};

