
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Fetch existing called numbers for a session from the database
 */
export async function fetchExistingNumbers(sessionId: string): Promise<number[]> {
  try {
    // Query sessions_progress for called numbers
    const { data, error } = await supabase
      .from('sessions_progress')
      .select('called_numbers')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch called numbers: ${error.message}`);
    }

    if (!data || !data.called_numbers) {
      return [];
    }

    const calledNumbers = data.called_numbers as number[];
    logWithTimestamp(`Loaded ${calledNumbers.length} existing called numbers`, 'info');
    
    return calledNumbers;
  } catch (error) {
    logWithTimestamp(`Error fetching existing numbers: ${error}`, 'error');
    return [];
  }
}

/**
 * Check if a session has a specific winning pattern active
 */
export async function isWinPatternActive(sessionId: string, pattern: string): Promise<boolean> {
  try {
    // Query sessions_progress for current win pattern
    const { data, error } = await supabase
      .from('sessions_progress')
      .select('current_win_pattern')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch win pattern: ${error.message}`);
    }

    if (!data || !data.current_win_pattern) {
      return false;
    }

    // Normalize pattern for comparison
    const normalizedCurrentPattern = data.current_win_pattern.toLowerCase();
    const normalizedCheckPattern = pattern.toLowerCase();
    
    return normalizedCurrentPattern === normalizedCheckPattern;
  } catch (error) {
    logWithTimestamp(`Error checking win pattern: ${error}`, 'error');
    return false;
  }
}
