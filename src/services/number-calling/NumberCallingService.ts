
import { logWithTimestamp } from '@/utils/logUtils';
import { getWebSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';
import { supabase } from '@/integrations/supabase/client';

/**
 * Service for managing bingo number calling and broadcasting
 */
class NumberCallingService {
  private sessionId: string | null = null;
  private calledNumbers: number[] = [];

  /**
   * Set the active session ID
   */
  public setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
    this.loadCalledNumbers();
  }

  /**
   * Load previously called numbers from the database
   */
  private async loadCalledNumbers(): Promise<void> {
    if (!this.sessionId) return;
    
    try {
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', this.sessionId)
        .single();
      
      if (error) {
        throw new Error(`Failed to load called numbers: ${error.message}`);
      }
      
      if (data && data.called_numbers) {
        this.calledNumbers = data.called_numbers;
        logWithTimestamp(`Loaded ${this.calledNumbers.length} previously called numbers`, 'info');
      }
    } catch (error) {
      logWithTimestamp(`Error loading called numbers: ${error}`, 'error');
    }
  }

  /**
   * Call a new bingo number and broadcast it
   */
  public async callNumber(number: number): Promise<boolean> {
    if (!this.sessionId) {
      logWithTimestamp('Cannot call number: No active session', 'error');
      return false;
    }
    
    try {
      // Ensure we're not calling a duplicate number
      if (this.calledNumbers.includes(number)) {
        logWithTimestamp(`Number ${number} already called. Skipping.`, 'warn');
        return true; // Return success but don't re-call the number
      }
      
      // Add to local array
      this.calledNumbers.push(number);
      
      // Update database
      const { error } = await supabase
        .from('sessions_progress')
        .update({ 
          called_numbers: this.calledNumbers,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', this.sessionId);
      
      if (error) {
        throw new Error(`Failed to save called number: ${error.message}`);
      }
      
      // Broadcast via WebSocket with retries
      const webSocketService = getWebSocketService();
      const broadcastSuccess = await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES, 
        EVENT_TYPES.NUMBER_CALLED, 
        {
          number,
          sessionId: this.sessionId,
          calledNumbers: this.calledNumbers, // Send all numbers to ensure sync
          timestamp: Date.now()
        },
        3 // Number of retries
      );
      
      if (!broadcastSuccess) {
        logWithTimestamp(`Warning: Failed to broadcast number ${number} via WebSocket`, 'warn');
      }
      
      return true;
    } catch (error) {
      logWithTimestamp(`Error calling number: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Reset all called numbers for a session
   */
  public async resetCalledNumbers(): Promise<boolean> {
    if (!this.sessionId) {
      logWithTimestamp('Cannot reset numbers: No active session', 'error');
      return false;
    }
    
    try {
      // Reset local array
      this.calledNumbers = [];
      
      // Update database
      const { error } = await supabase
        .from('sessions_progress')
        .update({ 
          called_numbers: [],
          updated_at: new Date().toISOString()
        })
        .eq('session_id', this.sessionId);
      
      if (error) {
        throw new Error(`Failed to reset called numbers: ${error.message}`);
      }
      
      // Broadcast reset via WebSocket
      const webSocketService = getWebSocketService();
      const broadcastSuccess = await webSocketService.broadcastWithRetry(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.GAME_RESET,
        {
          sessionId: this.sessionId,
          timestamp: Date.now()
        },
        3 // Number of retries
      );
      
      if (!broadcastSuccess) {
        logWithTimestamp(`Warning: Failed to broadcast game reset via WebSocket`, 'warn');
      }
      
      return true;
    } catch (error) {
      logWithTimestamp(`Error resetting numbers: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Get all called numbers
   */
  public getCalledNumbers(): number[] {
    return [...this.calledNumbers];
  }

  /**
   * Check if a number has been called
   */
  public isNumberCalled(number: number): boolean {
    return this.calledNumbers.includes(number);
  }

  /**
   * Get the count of called numbers
   */
  public getCalledNumberCount(): number {
    return this.calledNumbers.length;
  }
}

// Export a singleton instance
export const numberCallingService = new NumberCallingService();
