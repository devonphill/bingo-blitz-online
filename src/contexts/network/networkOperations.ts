
import { logWithTimestamp } from '@/utils/logUtils';
import { connectionManager } from '@/utils/connectionManager';
import { webSocketService, CHANNEL_NAMES, EVENT_TYPES } from '@/services/websocket';

/**
 * Connect to a session
 * 
 * @param sessionId Session ID to connect to
 * @param currentSessionId Current session ID
 * @returns Whether connection was initiated
 */
export function connectToSession(sessionId: string, currentSessionId: string | null): boolean {
  // Don't reconnect if already connected to this session
  if (currentSessionId === sessionId && connectionManager.isConnected()) {
    logWithTimestamp(`Already connected to session: ${sessionId}`, 'info');
    return false;
  }
  
  logWithTimestamp(`Connecting to session: ${sessionId}`, 'info');
  connectionManager.connect(sessionId);
  return true;
}

/**
 * Call a number for a session
 * 
 * @param number Number to call
 * @param sessionId Session ID (optional)
 * @returns Promise resolving to whether the call was successful
 */
export async function callNumber(number: number, sessionId?: string): Promise<boolean> {
  try {
    logWithTimestamp(`Broadcasting number ${number} for session ${sessionId}`, 'info');
    
    // Broadcast the number via WebSocket
    const success = await webSocketService.broadcastWithRetry(
      CHANNEL_NAMES.GAME_UPDATES,
      EVENT_TYPES.NUMBER_CALLED,
      {
        number,
        sessionId: sessionId,
        timestamp: Date.now()
      }
    );
    
    return success;
  } catch (error) {
    logWithTimestamp(`Error broadcasting number: ${error}`, 'error');
    return false;
  }
}
