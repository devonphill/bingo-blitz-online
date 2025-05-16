
// Import the logWithTimestamp rather than the non-existent onSessionProgressUpdate
import { logWithTimestamp } from '@/utils/logUtils';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { CHANNEL_NAMES, EVENT_TYPES } from '@/constants/websocketConstants';

export const setupChannelListeners = (sessionId: string, onError: (error: any) => void) => {
  if (!sessionId) {
    logWithTimestamp("Cannot setup channel listeners without session ID", "warn");
    return () => {};
  }
  
  try {
    const singleSource = getSingleSourceConnection();
    
    // Set up connection to the session
    singleSource.connect(sessionId);
    
    // Log successful setup
    logWithTimestamp(`Channel listeners set up for session ${sessionId}`, "info");
    
    // Return cleanup function
    return () => {
      // No explicit disconnect needed as SingleSourceTrueConnections
      // manages connection reference counting internally
      logWithTimestamp(`Cleaning up channel listeners for session ${sessionId}`, "info");
    };
  } catch (error) {
    onError(error);
    return () => {};
  }
};

// Add specific listener functions to support other components
export const addGameStateUpdateListener = (
  sessionId: string,
  callback: (state: any) => void
) => {
  if (!sessionId) {
    logWithTimestamp("Cannot add game state listener without session ID", "warn");
    return () => {};
  }
  
  const singleSource = getSingleSourceConnection();
  return singleSource.listenForEvent(
    CHANNEL_NAMES.GAME_UPDATES,
    EVENT_TYPES.GAME_STATE_UPDATE,
    (data: any) => {
      if (data?.sessionId === sessionId) {
        callback(data);
      }
    }
  );
};

export const addConnectionStatusListener = (
  callback: (connected: boolean) => void
) => {
  const singleSource = getSingleSourceConnection();
  return singleSource.addConnectionListener(callback);
};

export const addNumberCalledListener = (
  sessionId: string,
  callback: (number: number, calledNumbers: number[]) => void
) => {
  if (!sessionId) {
    logWithTimestamp("Cannot add number called listener without session ID", "warn");
    return () => {};
  }
  
  const singleSource = getSingleSourceConnection();
  return singleSource.listenForEvent(
    CHANNEL_NAMES.GAME_UPDATES,
    EVENT_TYPES.NUMBER_CALLED,
    (data: any) => {
      if (data?.sessionId === sessionId) {
        callback(data.number, data.calledNumbers || []);
      }
    }
  );
};
