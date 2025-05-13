
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { webSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';

// Type definitions for listeners
type NumberCalledCallback = (number: number | null, allNumbers: number[]) => void;

export class NumberCallingService {
  private static instance: NumberCallingService;
  private listeners: Map<string, NumberCalledCallback[]> = new Map();
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  // Get singleton instance
  public static getInstance(): NumberCallingService {
    if (!NumberCallingService.instance) {
      NumberCallingService.instance = new NumberCallingService();
    }
    return NumberCallingService.instance;
  }
  
  /**
   * Subscribe to number updates for a specific session
   */
  public subscribe(sessionId: string, callback: NumberCalledCallback): () => void {
    if (!sessionId) {
      logWithTimestamp(`Cannot subscribe without session ID`, 'error');
      return () => {};
    }
    
    // Initialize listener array if needed
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, []);
    }
    
    // Add the callback to the listeners
    const sessionListeners = this.listeners.get(sessionId)!;
    sessionListeners.push(callback);
    
    logWithTimestamp(`Added number listener for session ${sessionId}`, 'info');
    
    // Return unsubscribe function
    return () => {
      const sessionListeners = this.listeners.get(sessionId);
      if (sessionListeners) {
        const index = sessionListeners.indexOf(callback);
        if (index !== -1) {
          sessionListeners.splice(index, 1);
          logWithTimestamp(`Removed number listener for session ${sessionId}`, 'info');
        }
      }
    };
  }
  
  /**
   * Notify all listeners for a session about a number update
   */
  public notifyListeners(sessionId: string, newNumber: number | null): void {
    if (!sessionId) return;
    
    const sessionListeners = this.listeners.get(sessionId);
    if (!sessionListeners || sessionListeners.length === 0) return;
    
    this.getCalledNumbers(sessionId)
      .then(calledNumbers => {
        sessionListeners.forEach(listener => {
          try {
            listener(newNumber, calledNumbers);
          } catch (error) {
            logWithTimestamp(`Error in number listener: ${error}`, 'error');
          }
        });
      })
      .catch(error => {
        logWithTimestamp(`Error getting called numbers for notification: ${error}`, 'error');
      });
  }
  
  /**
   * Reset called numbers for a session
   */
  public async resetNumbers(sessionId: string): Promise<boolean> {
    if (!sessionId) {
      logWithTimestamp(`Cannot reset numbers without session ID`, 'error');
      return false;
    }
    
    try {
      logWithTimestamp(`Resetting called numbers for session ${sessionId}`, 'info');
      
      // Update the database with empty numbers array
      const { error } = await supabase
        .from('sessions_progress')
        .update({
          called_numbers: [],
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);
      
      if (error) {
        logWithTimestamp(`Error resetting called numbers: ${error.message}`, 'error');
        throw error;
      }
      
      // Notify listeners about the reset
      this.notifyListeners(sessionId, null);
      
      logWithTimestamp(`Successfully reset called numbers for session ${sessionId}`, 'info');
      return true;
    } catch (error) {
      logWithTimestamp(`Error resetting numbers: ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Update called numbers for a session
   */
  public async updateCalledNumbers(sessionId: string, numbers: number[]): Promise<boolean> {
    if (!sessionId) {
      logWithTimestamp(`Cannot update called numbers without session ID`, 'error');
      return false;
    }
    
    try {
      logWithTimestamp(`Updating called numbers for session ${sessionId}`, 'info');
      
      // Update the database with the new numbers
      const { error } = await supabase
        .from('sessions_progress')
        .update({
          called_numbers: numbers,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);
      
      if (error) {
        logWithTimestamp(`Error updating called numbers: ${error.message}`, 'error');
        throw error;
      }
      
      // If there are numbers and we updated successfully, notify listeners with the last number
      if (numbers.length > 0) {
        const lastNumber = numbers[numbers.length - 1];
        this.notifyListeners(sessionId, lastNumber);
      } else {
        this.notifyListeners(sessionId, null);
      }
      
      logWithTimestamp(`Successfully updated called numbers for session ${sessionId}`, 'info');
      return true;
    } catch (error) {
      logWithTimestamp(`Error updating called numbers: ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Call a number for a specific session
   */
  public async callNumber(number: number, sessionId: string): Promise<boolean> {
    if (!sessionId) {
      logWithTimestamp(`Cannot call number without session ID`, 'error');
      return false;
    }
    
    try {
      logWithTimestamp(`Calling number ${number} for session ${sessionId}`, 'info');
      
      // 1. Update the session_progress table with the new called number
      const { data: sessionProgress, error: fetchError } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', sessionId)
        .single();
      
      if (fetchError) {
        logWithTimestamp(`Error fetching session progress: ${fetchError.message}`, 'error');
        throw fetchError;
      }
      
      // Get existing called numbers or initialize empty array
      const calledNumbers = sessionProgress?.called_numbers || [];
      
      // Check if number already called to avoid duplicates
      if (calledNumbers.includes(number)) {
        logWithTimestamp(`Number ${number} already called for session ${sessionId}`, 'warn');
        return true;
      }
      
      // Add the new number to the array
      const updatedCalledNumbers = [...calledNumbers, number];
      
      // Update the database with the new number
      const { error: updateError } = await supabase
        .from('sessions_progress')
        .update({
          called_numbers: updatedCalledNumbers,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);
      
      if (updateError) {
        logWithTimestamp(`Error updating called numbers: ${updateError.message}`, 'error');
        throw updateError;
      }
      
      // 2. Broadcast the new number via WebSocket
      const success = await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.NUMBER_CALLED,
        {
          number,
          sessionId,
          timestamp: Date.now()
        }
      );
      
      if (!success) {
        logWithTimestamp(`Failed to broadcast number ${number} via WebSocket`, 'error');
      }
      
      // 3. Notify listeners about the new number
      this.notifyListeners(sessionId, number);
      
      logWithTimestamp(`Successfully called number ${number} for session ${sessionId}`, 'info');
      return true;
    } catch (error) {
      logWithTimestamp(`Error calling number: ${error}`, 'error');
      return false;
    }
  }
  
  /**
   * Get all called numbers for a session
   */
  public async getCalledNumbers(sessionId: string): Promise<number[]> {
    if (!sessionId) {
      logWithTimestamp(`Cannot get called numbers without session ID`, 'error');
      return [];
    }
    
    try {
      logWithTimestamp(`Getting called numbers for session ${sessionId}`, 'info');
      
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', sessionId)
        .single();
      
      if (error) {
        logWithTimestamp(`Error getting called numbers: ${error.message}`, 'error');
        throw error;
      }
      
      const calledNumbers = data?.called_numbers || [];
      logWithTimestamp(`Retrieved ${calledNumbers.length} called numbers for session ${sessionId}`, 'info');
      
      return calledNumbers;
    } catch (error) {
      logWithTimestamp(`Error retrieving called numbers: ${error}`, 'error');
      return [];
    }
  }
  
  /**
   * Get the last called number for a session
   */
  public async getLastCalledNumber(sessionId: string): Promise<number | null> {
    try {
      const calledNumbers = await this.getCalledNumbers(sessionId);
      
      if (calledNumbers.length === 0) {
        return null;
      }
      
      return calledNumbers[calledNumbers.length - 1];
    } catch (error) {
      logWithTimestamp(`Error getting last called number: ${error}`, 'error');
      return null;
    }
  }
}

// Export singleton instance
export const numberCallingService = NumberCallingService.getInstance();

// Export function to get the service instance for compatibility
export const getNumberCallingService = (): NumberCallingService => {
  return NumberCallingService.getInstance();
};
