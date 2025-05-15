
import { logWithTimestamp } from '@/utils/logUtils';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';

/**
 * Connect to a session
 * @param sessionId Session ID to connect to
 * @param currentSessionId Current session ID (optional)
 * @returns Whether connection was successful
 */
export function connectToSession(
  sessionId: string,
  currentSessionId: string | null = null
): boolean {
  if (!sessionId) {
    logWithTimestamp('Cannot connect: No session ID provided', 'error');
    return false;
  }
  
  // Skip if already connected to this session
  if (currentSessionId === sessionId) {
    logWithTimestamp(`Already connected to session ${sessionId}`, 'info');
    return true;
  }
  
  try {
    const singleSource = getSingleSourceConnection();
    singleSource.connect(sessionId);
    logWithTimestamp(`Connected to session: ${sessionId}`, 'info');
    return true;
  } catch (error) {
    logWithTimestamp(`Error connecting to session: ${error}`, 'error');
    return false;
  }
}

/**
 * Call a number
 * @param number Number to call
 * @param sessionId Session ID (optional)
 * @returns Promise resolving to whether call was successful
 */
export async function callNumber(
  number: number,
  sessionId?: string
): Promise<boolean> {
  try {
    const singleSource = getSingleSourceConnection();
    return await singleSource.callNumber(number, sessionId);
  } catch (error) {
    logWithTimestamp(`Error calling number: ${error}`, 'error');
    return false;
  }
}
