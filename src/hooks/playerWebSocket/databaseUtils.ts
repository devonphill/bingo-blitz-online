
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Fetch called numbers for a session from the database
 */
export async function fetchCalledNumbers(sessionId: string): Promise<number[]> {
  if (!sessionId) return [];
  
  try {
    logWithTimestamp(`Fetching called numbers for session ${sessionId}`, 'info');
    
    const { data, error } = await supabase
      .from('sessions_progress')
      .select('called_numbers')
      .eq('session_id', sessionId)
      .single();
    
    if (error) {
      logWithTimestamp(`Error fetching called numbers: ${error.message}`, 'error');
      return [];
    }
    
    if (!data || !data.called_numbers) {
      logWithTimestamp(`No called numbers found for session ${sessionId}`, 'info');
      return [];
    }
    
    logWithTimestamp(`Fetched ${data.called_numbers.length} called numbers for session ${sessionId}`, 'info');
    return data.called_numbers;
  } catch (error) {
    logWithTimestamp(`Exception fetching called numbers: ${error}`, 'error');
    return [];
  }
}

/**
 * Save called numbers to the database
 */
export async function saveCalledNumbersToDatabase(
  sessionId: string,
  calledNumbers: number[]
): Promise<boolean> {
  if (!sessionId) return false;
  
  try {
    const { error } = await supabase
      .from('sessions_progress')
      .update({
        called_numbers: calledNumbers,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId);
    
    if (error) {
      logWithTimestamp(`Error saving called numbers: ${error.message}`, 'error');
      return false;
    }
    
    return true;
  } catch (error) {
    logWithTimestamp(`Exception saving called numbers: ${error}`, 'error');
    return false;
  }
}
