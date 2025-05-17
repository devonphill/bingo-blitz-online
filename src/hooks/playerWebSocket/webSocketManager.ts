
import { logWithTimestamp } from "@/utils/logUtils";
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { EVENT_TYPES, CHANNEL_NAMES } from '@/constants/websocketConstants';

/**
 * Registers listeners for WebSocket number updates using SingleSourceTrueConnections
 */
export function setupNumberUpdateListeners(
  sessionId: string | null | undefined,
  onNumberUpdate: (number: number, numbers: number[]) => void,
  onGameReset: () => void,
  instanceId: string
) {
  if (!sessionId) {
    logWithTimestamp(`[${instanceId}] Cannot setup listeners: No session ID`, 'warn');
    return () => {};
  }

  logWithTimestamp(`[${instanceId}] Setting up number update listeners for session ${sessionId}`, 'info');
  
  // Use SingleSourceTrueConnections to set up listeners
  const singleSource = getSingleSourceConnection();
  
  // Check if WebSocket service is initialized
  if (!singleSource.isServiceInitialized()) {
    logWithTimestamp(`[${instanceId}] WebSocket service not initialized, deferring setup`, 'warn');
    return () => {};
  }
  
  // Set up connection to session if needed
  if (singleSource.getActiveSessionId() !== sessionId) {
    singleSource.connect(sessionId);
  }

  // Use the direct constants instead of trying to access them through the constructor
  if (!EVENT_TYPES || !EVENT_TYPES.NUMBER_CALLED || !EVENT_TYPES.GAME_RESET) {
    logWithTimestamp(`[${instanceId}] Missing required event types, skipping listener setup`, 'error');
    return () => {};
  }
  
  // Set up number called listener - using string literals for the channel name to avoid type errors
  const numberCleanup = singleSource.listenForEvent(
    'GAME_UPDATES_BASE',
    EVENT_TYPES.NUMBER_CALLED,
    (data: any) => {
      // Check if the data is for our session
      if (data?.sessionId === sessionId) {
        logWithTimestamp(`[${instanceId}] Received number update for session ${sessionId}: ${data.number}`, 'info');
        onNumberUpdate(data.number, data.calledNumbers || []);
      }
    },
    sessionId
  );
  
  // Set up game reset listener - using string literals for the channel name to avoid type errors
  const resetCleanup = singleSource.listenForEvent(
    'GAME_UPDATES_BASE',
    EVENT_TYPES.GAME_RESET,
    (data: any) => {
      // Check if the data is for our session
      if (data?.sessionId === sessionId) {
        logWithTimestamp(`[${instanceId}] Received game reset for session ${sessionId}`, 'info');
        onGameReset();
      }
    },
    sessionId
  );
  
  // Return combined cleanup function
  return () => {
    logWithTimestamp(`[${instanceId}] Cleaning up number update listeners`, 'info');
    numberCleanup();
    resetCleanup();
  };
}
