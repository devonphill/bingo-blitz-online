
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Update player presence in the database
 * 
 * @param presenceData Player presence data containing player_id and player_code
 * @returns Whether the operation was successful
 */
export async function updatePlayerPresence(presenceData: any): Promise<boolean> {
  try {
    // FIX: Use the 'players' table instead of 'player_presence'
    // Since 'updated_at' doesn't exist, use joined_at which is a timestamp field
    const { error } = await supabase
      .from('players')
      .update({
        joined_at: new Date().toISOString() // Use joined_at instead of updated_at
      })
      .eq('id', presenceData.player_id)
      .eq('player_code', presenceData.player_code);
      
    return !error;
  } catch (err) {
    logWithTimestamp(`Error updating player presence: ${(err as Error).message}`, 'error');
    return false;
  }
}
