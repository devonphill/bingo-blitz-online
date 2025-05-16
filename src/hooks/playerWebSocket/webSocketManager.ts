
import { logWithTimestamp } from "@/utils/logUtils";
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';

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
  
  return singleSource.setupNumberUpdateListeners(
    sessionId,
    onNumberUpdate,
    onGameReset,
    instanceId
  );
}
