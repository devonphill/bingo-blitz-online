
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Fetch called numbers from database
 */
export async function fetchCalledNumbers(sessionId: string): Promise<number[] | null> {
  try {
    const { data, error } = await supabase
      .from('sessions_progress')
      .select('called_numbers')
      .eq('session_id', sessionId)
      .single();
      
    if (error) {
      logWithTimestamp(`Error fetching called numbers from database: ${error.message}`, 'error');
      return null;
    }
    
    if (data && Array.isArray(data.called_numbers)) {
      logWithTimestamp(`Fetched ${data.called_numbers.length} called numbers from database for session ${sessionId}`, 'info');
      return data.called_numbers;
    }
    
    return [];
  } catch (error) {
    logWithTimestamp(`Exception fetching called numbers: ${error}`, 'error');
    return null;
  }
}
