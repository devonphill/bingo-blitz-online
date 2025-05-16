
import { logWithTimestamp } from '@/utils/logUtils';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { CHANNEL_NAMES, EVENT_TYPES } from '@/constants/websocketConstants';

// Call a number for a specific session
export const callNumberForSession = async (
  number: number,
  sessionId: string,
  calledNumbers: number[] = []
): Promise<boolean> => {
  if (!number || !sessionId) {
    logWithTimestamp(`Cannot call number: Missing number (${number}) or sessionId (${sessionId})`, 'error');
    return false;
  }

  try {
    const connection = getSingleSourceConnection();
    if (!connection) {
      logWithTimestamp('Cannot call number: WebSocket service not available', 'error');
      return false;
    }
    
    // Update connection last ping time
    connection.updateLastPing();
    
    // Broadcast the number
    logWithTimestamp(`Calling number ${number} for session ${sessionId}`, 'info');
    const result = await connection.broadcastNumberCalled(
      sessionId, 
      number,
      calledNumbers
    );
    
    return result;
  } catch (error) {
    logWithTimestamp(`Error calling number: ${error}`, 'error');
    return false;
  }
};

// Reset a game for a specific session
export const resetGameForSession = async (
  sessionId: string
): Promise<boolean> => {
  if (!sessionId) {
    logWithTimestamp('Cannot reset game: No session ID provided', 'error');
    return false;
  }

  try {
    const connection = getSingleSourceConnection();
    if (!connection) {
      logWithTimestamp('Cannot reset game: WebSocket service not available', 'error'); 
      return false;
    }
    
    // Update connection last ping time
    connection.updateLastPing();
    
    // Broadcast the reset event
    logWithTimestamp(`Resetting game for session ${sessionId}`, 'info');
    const result = await connection.broadcast(
      CHANNEL_NAMES.GAME_UPDATES,
      EVENT_TYPES.GAME_RESET,
      { 
        sessionId,
        timestamp: new Date().toISOString() 
      }
    );
    
    return result;
  } catch (error) {
    logWithTimestamp(`Error resetting game: ${error}`, 'error');
    return false;
  }
};

// Function to broadcast any generic event
export const broadcastEvent = async (
  channelName: string,
  eventType: string,
  data: any
): Promise<boolean> => {
  try {
    const connection = getSingleSourceConnection();
    if (!connection) {
      logWithTimestamp('Cannot broadcast event: WebSocket service not available', 'error');
      return false;
    }
    
    // Update connection last ping time
    connection.updateLastPing();
    
    // Broadcast the event
    logWithTimestamp(`Broadcasting event ${eventType} on channel ${channelName}`, 'info');
    const result = await connection.broadcast(channelName, eventType, data);
    
    return result;
  } catch (error) {
    logWithTimestamp(`Error broadcasting event: ${error}`, 'error');
    return false;
  }
};
