
import { logWithTimestamp } from "@/utils/logUtils";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches current state from database as a backup
 */
export async function fetchNumbersFromDatabase(sessionId: string): Promise<number[]> {
  try {
    logWithTimestamp(`Fetching state from database for session ${sessionId}`, 'info');
    
    const { data, error } = await supabase
      .from('sessions_progress')
      .select('called_numbers, updated_at')
      .eq('session_id', sessionId)
      .single();
      
    if (error) {
      throw error;
    }
    
    if (data && data.called_numbers && Array.isArray(data.called_numbers)) {
      const dbNumbers = data.called_numbers;
      const lastNumber = dbNumbers.length > 0 ? dbNumbers[dbNumbers.length - 1] : null;
      
      if (dbNumbers.length > 0) {
        logWithTimestamp(`Loaded ${dbNumbers.length} numbers from DB, last: ${lastNumber}`, 'info');
        return dbNumbers;
      }
    }
    
    return [];
  } catch (error) {
    logWithTimestamp(`Error fetching from DB: ${error}`, 'error');
    return [];
  }
}
