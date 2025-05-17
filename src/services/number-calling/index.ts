
import { getSingleSourceConnection } from '@/utils/NEWConnectionManager_SinglePointOfTruth';
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
      'GAME_UPDATES_BASE',
      EVENT_TYPES.NUMBER_CALLED,
      (data: any) => {
        if (data?.sessionId === sessionId) {
          listener(data.number, data.calledNumbers || []);
        }
      }
    );
  }
}

// These are incomplete function declarations to fix TypeScript errors
// The file seems to be cut off in the original
export const addNumberCalledListener = (sessionId: string, callback: (number: number, allCalled: number[]) => void) => {
  return getSingleSourceConnection().listenForEvent(
    'GAME_UPDATES_BASE',
    EVENT_TYPES.NUMBER_CALLED,
    (data: any) => {
      if (data?.sessionId === sessionId) {
        callback(data.number, data.calledNumbers || []);
      }
    }
  );
};

export const addGameResetListener = (sessionId: string, callback: () => void) => {
  return getSingleSourceConnection().listenForEvent(
    'GAME_UPDATES_BASE',
    EVENT_TYPES.GAME_RESET,
    (data: any) => {
      if (data?.sessionId === sessionId) {
        callback();
      }
    }
  );
};

export const addNumberCalledListenerWithSessionId = (sessionId: string, callback: (number: number, allCalled: number[], sessionId: string) => void) => {
  return getSingleSourceConnection().listenForEvent(
    'GAME_UPDATES_BASE',
    EVENT_TYPES.NUMBER_CALLED,
    (data: any) => {
      if (data?.sessionId === sessionId) {
        callback(data.number, data.calledNumbers || [], sessionId);
      }
    }
  );
};
