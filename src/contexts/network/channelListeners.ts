
import { logWithTimestamp } from '@/utils/logUtils';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { GameStateUpdatePayload } from './types';

/**
 * Add listener for game state updates
 * @param sessionId Session ID to listen for
 * @param callback Function to call with game state
 * @returns Function to remove the listener
 */
export function addGameStateUpdateListener(
  sessionId: string | null | undefined,
  callback: (gameState: GameStateUpdatePayload) => void
): () => void {
  if (!sessionId) {
    logWithTimestamp('Cannot add game state update listener: No session ID', 'warn');
    return () => {};
  }
  
  const singleSource = getSingleSourceConnection();
  return singleSource.onSessionProgressUpdate((gameState) => {
    if (gameState.sessionId === sessionId) {
      callback(gameState);
    }
  });
}

/**
 * Add listener for connection status changes
 * @param getConnectionStatus Function to get current connection status
 * @param callback Function to call with connection status
 * @returns Function to remove the listener
 */
export function addConnectionStatusListener(
  getConnectionStatus: () => boolean,
  callback: (isConnected: boolean) => void
): () => void {
  const singleSource = getSingleSourceConnection();
  return singleSource.addConnectionListener((isConnected) => {
    callback(isConnected);
  });
}

/**
 * Add listener for number called events
 * @param sessionId Session ID to listen for
 * @param callback Function to call when number is called
 * @returns Function to remove the listener
 */
export function addNumberCalledListener(
  sessionId: string | null | undefined,
  callback: (number: number | null, calledNumbers: number[]) => void
): () => void {
  if (!sessionId) {
    logWithTimestamp('Cannot add number called listener: No session ID', 'warn');
    return () => {};
  }
  
  const singleSource = getSingleSourceConnection();
  return singleSource.onNumberCalled((number, calledNumbers) => {
    callback(number, calledNumbers);
  });
}
