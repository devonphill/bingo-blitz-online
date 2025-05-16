
import { logWithTimestamp } from '@/utils/logUtils';
import { supabase } from '@/integrations/supabase/client';

/**
 * Update player presence in the database
 * @param sessionId Game session ID
 * @param playerData Player data to update
 * @returns Promise resolving to success state
 */
export const updatePlayerPresence = async (
  sessionId: string,
  playerData: any
): Promise<boolean> => {
  if (!sessionId || !playerData) {
    logWithTimestamp('Cannot update player presence: Missing sessionId or playerData', 'error');
    return false;
  }
  
  try {
    // Update the last_seen timestamp for the player
    const { error } = await supabase
      .from('players')
      .update({
        last_seen: new Date().toISOString(),
        ...playerData
      })
      .eq('id', playerData.id);
      
    if (error) {
      logWithTimestamp(`Error updating player presence: ${error.message}`, 'error');
      return false;
    }
    
    logWithTimestamp(`Updated presence for player ${playerData.id} in session ${sessionId}`, 'info');
    return true;
  } catch (error) {
    logWithTimestamp(`Exception updating player presence: ${error}`, 'error');
    return false;
  }
};

// Alias for backward compatibility
export const updatePlayerPresenceInDb = updatePlayerPresence;
