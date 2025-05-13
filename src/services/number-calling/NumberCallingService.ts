
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { webSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';

export class NumberCallingService {
  private static instance: NumberCallingService;
  
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
}

// Export singleton instance
export const numberCallingService = NumberCallingService.getInstance();

// Export function to get the service instance for compatibility
export const getNumberCallingService = (): NumberCallingService => {
  return NumberCallingService.getInstance();
};
