
import { logWithTimestamp } from '@/utils/logUtils';
import { connectionManager } from '@/utils/connectionManager';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';

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
  
  // Connect using both the legacy and new systems for compatibility
  connectionManager.connect(sessionId);
  getSingleSourceConnection().connect(sessionId);
  
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
    
    // Use SingleSourceTrueConnections to call the number
    return await getSingleSourceConnection().callNumber(number, sessionId);
  } catch (error) {
    logWithTimestamp(`Error broadcasting number: ${error}`, 'error');
    return false;
  }
}
