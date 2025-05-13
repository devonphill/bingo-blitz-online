
import { supabase } from "@/integrations/supabase/client";
import { logWithTimestamp } from "@/utils/logUtils";

/**
 * Fetch existing called numbers from database
 */
export async function fetchExistingNumbers(
  sessionId: string | null | undefined
): Promise<number[]> {
  if (!sessionId) return [];
  
  try {
    logWithTimestamp(`Fetching existing called numbers for session ${sessionId}`, 'info');
    
    const { data, error } = await supabase
      .from('sessions_progress')
      .select('called_numbers')
      .eq('session_id', sessionId)
      .single();
      
    if (error) {
      logWithTimestamp(`Error fetching called numbers: ${error.message}`, 'error');
      return [];
    }
    
    const numbers = data?.called_numbers || [];
    logWithTimestamp(`Loaded ${numbers.length} existing called numbers from database`, 'info');
    
    return numbers;
  } catch (err) {
    logWithTimestamp(`Exception fetching called numbers: ${err}`, 'error');
    return [];
  }
}
