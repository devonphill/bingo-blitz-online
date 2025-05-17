
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';
import { CHANNEL_NAMES, EVENT_TYPES } from '@/constants/websocketConstants';
import { numberCallingService as classBasedService } from './NumberCallingService';

/**
 * Unified service for handling number calling and listening operations
 * This combines functionality from both implementations to provide a single interface
 */
export const numberCallingService = {
  /**
   * Set the active session ID
   */
  setSessionId: classBasedService.setSessionId.bind(classBasedService),

  /**
   * Get all called numbers
   */
  getCalledNumbers: classBasedService.getCalledNumbers.bind(classBasedService),

  /**
   * Check if a number has been called
   */
  isNumberCalled: classBasedService.isNumberCalled.bind(classBasedService),

  /**
   * Get the count of called numbers
   */
  getCalledNumberCount: classBasedService.getCalledNumberCount.bind(classBasedService),

  /**
   * Call a new bingo number and broadcast it
   */
  callNumber: classBasedService.callNumber.bind(classBasedService),

  /**
   * Reset all called numbers for a session
   */
  resetCalledNumbers: classBasedService.resetCalledNumbers.bind(classBasedService),

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

    // Set the session ID in the class-based service as well
    classBasedService.setSessionId(sessionId);

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

      // Set the session ID in the class-based service
      classBasedService.setSessionId(sessionId);

      // Broadcast last number if available
      if (numbers.length > 0) {
        const lastNumber = numbers[numbers.length - 1];
        // Use the WebSocketService through the class-based service
        await classBasedService.callNumber(lastNumber);
      }

      return true;
    } catch (error) {
      logWithTimestamp(`Error updating called numbers: ${error}`, 'error');
      return false;
    }
  }
};

/**
 * Set up listeners for number updates and game reset
 * @param sessionId Session ID
 */
export const setupNumberCallingService = (sessionId: string) => {
  const singleSource = getSingleSourceConnection();

  // Set the session ID in the class-based service
  classBasedService.setSessionId(sessionId);

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
