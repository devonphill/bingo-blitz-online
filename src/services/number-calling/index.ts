
import { logWithTimestamp } from '@/utils/logUtils';
import { 
  getSingleSourceConnection,
  CHANNEL_NAMES,
  EVENT_TYPES
} from '@/utils/SingleSourceTrueConnections';
import { NumberCallingOptions } from './types';

/**
 * Call a number in a bingo game session
 * 
 * @param number The number to call
 * @param sessionId The session ID
 * @param options Additional options
 * @returns Promise resolving to success status
 */
export async function callNumber(
  number: number,
  sessionId: string,
  options: NumberCallingOptions = {}
): Promise<boolean> {
  try {
    const singleSource = getSingleSourceConnection();
    
    const {
      broadcastToPlayers = true,
      storeInDatabase = true,
      notifyListeners = true
    } = options;
    
    // Validate inputs
    if (!sessionId) {
      logWithTimestamp('No session ID provided for number calling', 'error');
      return false;
    }
    
    if (isNaN(number) || number < 0) {
      logWithTimestamp(`Invalid number provided: ${number}`, 'error');
      return false;
    }
    
    logWithTimestamp(`Calling number ${number} for session ${sessionId}`, 'info');
    
    // Broadcast number via WebSockets
    let broadcastSuccess = true;
    if (broadcastToPlayers) {
      broadcastSuccess = await singleSource.callNumber(number, sessionId);
      
      if (!broadcastSuccess) {
        logWithTimestamp(`Failed to broadcast number ${number} to players`, 'error');
      } else {
        logWithTimestamp(`Successfully broadcast number ${number} to players`, 'info');
      }
    }
    
    // Execute database operations in parallel
    const promises = [];
    
    // Update the database with called number
    if (storeInDatabase) {
      // Database update logic here (left as placeholder)
      // This would typically update the session_progress table
    }
    
    // Wait for all operations to complete
    if (promises.length > 0) {
      await Promise.all(promises);
    }
    
    return broadcastSuccess;
  } catch (error) {
    logWithTimestamp(`Error calling number: ${error}`, 'error');
    return false;
  }
}

/**
 * Reset called numbers for a session
 * 
 * @param sessionId The session ID
 * @returns Promise resolving to success status
 */
export async function resetCalledNumbers(sessionId: string): Promise<boolean> {
  try {
    if (!sessionId) {
      logWithTimestamp('No session ID provided for resetting numbers', 'error');
      return false;
    }
    
    // Broadcast game reset via WebSockets
    const singleSource = getSingleSourceConnection();
    const webSocketService = singleSource.getWebSocketService();
    
    const success = await webSocketService.broadcastWithRetry(
      CHANNEL_NAMES.GAME_UPDATES,
      EVENT_TYPES.GAME_RESET,
      {
        sessionId,
        timestamp: Date.now()
      }
    );
    
    if (!success) {
      logWithTimestamp(`Failed to broadcast game reset for session ${sessionId}`, 'error');
      return false;
    }
    
    logWithTimestamp(`Successfully reset called numbers for session ${sessionId}`, 'info');
    return true;
  } catch (error) {
    logWithTimestamp(`Error resetting called numbers: ${error}`, 'error');
    return false;
  }
}
