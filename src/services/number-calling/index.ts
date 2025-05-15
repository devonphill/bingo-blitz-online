
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';

/**
 * Service for handling number calling and listening operations
 */
export const numberCallingService = {
  /**
   * Subscribe to number updates for a session
   * @param sessionId Session ID to subscribe to
   * @param listener Function to call with number updates
   * @returns Function to unsubscribe
   */
  subscribe: (sessionId: string, listener: (number: number | null, calledNumbers: number[]) => void) => {
    if (!sessionId) {
      logWithTimestamp('Cannot subscribe: No session ID', 'warn');
      return () => {};
    }
    
    logWithTimestamp(`Subscribing to number updates for session ${sessionId}`, 'info');
    
    // Use SingleSourceTrueConnections for subscription
    const singleSource = getSingleSourceConnection();
    
    // Connect to session if not already connected
    singleSource.connect(sessionId);
    
    // Add listener for number called events
    return singleSource.onNumberCalled(listener);
  },
  
  /**
   * Notify listeners of number updates
   * @param sessionId Session ID
   * @param number Number called
   * @param calledNumbers All called numbers
   */
  notifyListeners: (sessionId: string, number: number | null, calledNumbers: number[]) => {
    const singleSource = getSingleSourceConnection();
    
    // Use SingleSourceTrueConnections to broadcast number called event
    singleSource.broadcastNumberCalled(sessionId, number as number, calledNumbers);
  },
  
  /**
   * Reset numbers for a session
   * @param sessionId Session ID
   * @returns Promise resolving to whether the reset was successful
   */
  resetNumbers: async (sessionId: string): Promise<boolean> => {
    try {
      logWithTimestamp(`Resetting numbers for session ${sessionId}`, 'info');
      
      // Update database
      const { error } = await supabase
        .from('sessions_progress')
        .update({ called_numbers: [] })
        .eq('session_id', sessionId);
      
      if (error) {
        logWithTimestamp(`Error resetting numbers in database: ${error.message}`, 'error');
        return false;
      }
      
      // Broadcast reset event
      const singleSource = getSingleSourceConnection();
      const webSocketService = singleSource.getWebSocketService();
      
      await webSocketService.broadcastWithRetry(
        'game-updates',
        'game-reset',
        { sessionId }
      );
      
      return true;
    } catch (error) {
      logWithTimestamp(`Error resetting numbers: ${error}`, 'error');
      return false;
    }
  },
  
  /**
   * Update called numbers for a session
   * @param sessionId Session ID
   * @param numbers Called numbers
   * @returns Promise resolving to whether the update was successful
   */
  updateCalledNumbers: async (sessionId: string, numbers: number[]): Promise<boolean> => {
    try {
      logWithTimestamp(`Updating called numbers for session ${sessionId}`, 'info');
      
      // Update database
      const { error } = await supabase
        .from('sessions_progress')
        .update({ called_numbers: numbers })
        .eq('session_id', sessionId);
      
      if (error) {
        logWithTimestamp(`Error updating called numbers in database: ${error.message}`, 'error');
        return false;
      }
      
      // Broadcast last number if available
      if (numbers.length > 0) {
        const lastNumber = numbers[numbers.length - 1];
        const singleSource = getSingleSourceConnection();
        await singleSource.broadcastNumberCalled(sessionId, lastNumber, numbers);
      }
      
      return true;
    } catch (error) {
      logWithTimestamp(`Error updating called numbers: ${error}`, 'error');
      return false;
    }
  }
};
