
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';
import { CHANNEL_NAMES, EVENT_TYPES } from '@/constants/websocketConstants';

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
    
    // Listen for number called events
    return singleSource.listenForEvent(
      CHANNEL_NAMES.GAME_UPDATES,
      EVENT_TYPES.NUMBER_CALLED,
      (data: any) => {
        if (data?.sessionId === sessionId) {
          listener(data.number, data.calledNumbers || []);
        }
      }
    );
  },
  
  /**
   * Notify listeners of number updates
   * @param sessionId Session ID
   * @param number Number called
   * @param calledNumbers All called numbers
   */
  notifyListeners: async (sessionId: string, number: number | null, calledNumbers: number[]) => {
    const singleSource = getSingleSourceConnection();
    
    // Broadcast number called event
    await singleSource.broadcast(
      CHANNEL_NAMES.GAME_UPDATES,
      EVENT_TYPES.NUMBER_CALLED,
      {
        sessionId,
        number, 
        calledNumbers
      }
    );
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
      
      // Use broadcast method
      await singleSource.broadcast(
        CHANNEL_NAMES.GAME_UPDATES,
        EVENT_TYPES.GAME_RESET,
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
        await numberCallingService.notifyListeners(sessionId, lastNumber, numbers);
      }
      
      return true;
    } catch (error) {
      logWithTimestamp(`Error updating called numbers: ${error}`, 'error');
      return false;
    }
  }
};

export const setupNumberCallingService = (sessionId: string) => {
  const singleSource = getSingleSourceConnection();
  
  // Set up listeners for number updates and game reset
  const listenForNumberUpdate = (callback: (payload: any) => void) => {
    return singleSource.listenForEvent(
      CHANNEL_NAMES.GAME_UPDATES,
      EVENT_TYPES.NUMBER_CALLED,
      callback
    );
  };
  
  // Listen for game reset events
  const listenForGameReset = (callback: (payload: any) => void) => {
    return singleSource.listenForEvent(
      CHANNEL_NAMES.GAME_UPDATES,
      EVENT_TYPES.GAME_RESET,
      callback
    );
  };
  
  return {
    listenForNumberUpdate,
    listenForGameReset
  };
};
