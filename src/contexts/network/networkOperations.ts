import { logWithTimestamp } from '@/utils/logUtils';
import { getSingleSourceConnection } from '@/utils/SingleSourceTrueConnections';
import { CHANNEL_NAMES, EVENT_TYPES } from '@/constants/websocketConstants';
import { supabase } from '@/integrations/supabase/client';
import { 
  isNumberAlreadyCalled, 
  logNumberCall, 
  fetchCalledNumbersFromDb 
} from '@/utils/numberDebugUtils';

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
    // First check if the number has already been called
    const isAlreadyCalled = await isNumberAlreadyCalled(number, sessionId);
    if (isAlreadyCalled) {
      logWithTimestamp(`Number ${number} has already been called for session ${sessionId}`, 'warn');
      return false;
    }

    // Track the call for debugging
    logNumberCall(number, sessionId, 'callNumberForSession');
    
    const connection = getSingleSourceConnection();
    if (!connection) {
      logWithTimestamp('Cannot call number: WebSocket service not available', 'error');
      return false;
    }
    
    // Update connection last ping time
    connection.updateLastPing();
    
    // First update the database
    try {
      // Get current called numbers
      const { data, error: fetchError } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', sessionId)
        .single();
        
      if (fetchError) {
        throw new Error(`Database fetch error: ${fetchError.message}`);
      }
      
      // Create updatedCalledNumbers to ensure we don't add duplicates
      let updatedCalledNumbers: number[];
      if (data && Array.isArray(data.called_numbers)) {
        // Only add the number if it's not already in the array
        if (data.called_numbers.includes(number)) {
          logWithTimestamp(`Number ${number} already exists in database, will not add duplicate`, 'warn');
          updatedCalledNumbers = [...data.called_numbers];
        } else {
          updatedCalledNumbers = [...data.called_numbers, number];
        }
      } else {
        updatedCalledNumbers = [number];
      }
      
      // Update the database with the new array
      const { error } = await supabase
        .from('sessions_progress')
        .update({
          called_numbers: updatedCalledNumbers,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);

      if (error) {
        throw new Error(`Database update error: ${error.message}`);
      }
      
      // Use the updated array for the broadcast
      calledNumbers = updatedCalledNumbers;
    } catch (dbError) {
      logWithTimestamp(`Error updating database with called number: ${dbError}`, 'error');
      // We continue with the broadcast even if DB update fails
    }
    
    // Then broadcast the number
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
    
    // First update the database
    try {
      const { error } = await supabase
        .from('sessions_progress')
        .update({
          called_numbers: [],
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);

      if (error) {
        throw new Error(`Database error resetting called numbers: ${error.message}`);
      }
    } catch (dbError) {
      logWithTimestamp(`Error resetting called numbers in database: ${dbError}`, 'error');
      // Continue with broadcast even if DB update fails
    }
    
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

// Debug function to sync called numbers
export const syncCalledNumbers = async (
  sessionId: string
): Promise<boolean> => {
  if (!sessionId) {
    logWithTimestamp('Cannot sync numbers: No session ID provided', 'error');
    return false;
  }

  try {
    // Fetch current called numbers from database
    const { data, error } = await supabase
      .from('sessions_progress')
      .select('called_numbers')
      .eq('session_id', sessionId)
      .single();
      
    if (error) {
      throw new Error(`Database error fetching called numbers: ${error.message}`);
    }
    
    if (!data || !Array.isArray(data.called_numbers)) {
      logWithTimestamp('No called numbers found to sync', 'info');
      return false;
    }
    
    // Broadcast current called numbers to all clients
    const connection = getSingleSourceConnection();
    
    if (data.called_numbers.length > 0) {
      // If we have numbers, broadcast the last one with the full list
      const lastNumber = data.called_numbers[data.called_numbers.length - 1];
      await connection.broadcastNumberCalled(
        sessionId,
        lastNumber,
        data.called_numbers
      );
    }
    
    logWithTimestamp(`Synced ${data.called_numbers.length} called numbers for session ${sessionId}`, 'info');
    return true;
  } catch (error) {
    logWithTimestamp(`Error syncing called numbers: ${error}`, 'error');
    return false;
  }
};
