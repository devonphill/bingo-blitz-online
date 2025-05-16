// Import the logWithTimestamp rather than the non-existent onSessionProgressUpdate
import { logWithTimestamp } from '@/utils/logUtils';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';

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
