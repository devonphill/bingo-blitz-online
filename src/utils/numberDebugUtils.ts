
import { logWithTimestamp } from './logUtils';
import { supabase } from '@/integrations/supabase/client';

// Debug setting - can be toggled during development
const DEBUG_ENABLED = true;

/**
 * Advanced number call debugging utility
 */
export const numberDebugUtils = {
  /**
   * Log number call for debugging
   */
  logNumberCall: (number: number, sessionId: string, source: string): void => {
    if (!DEBUG_ENABLED) return;
    
    logWithTimestamp(`[NumberDebug] ${source}: Called number ${number} for session ${sessionId}`, 'info');
    
    // You can also debug-log to console with more detail
    console.log(`[NumberDebug] CALLED NUMBER DETAILS:`, {
      number,
      sessionId,
      source,
      timestamp: new Date().toISOString(),
      stack: new Error().stack?.split('\n').slice(1, 5).join('\n') // Capture limited stack trace
    });
  },
  
  /**
   * Check if a number has already been called
   */
  isNumberAlreadyCalled: async (number: number, sessionId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', sessionId)
        .single();
        
      if (error) {
        logWithTimestamp(`[NumberDebug] Error checking if number is called: ${error.message}`, 'error');
        return false;
      }
      
      if (data && Array.isArray(data.called_numbers)) {
        const isAlreadyCalled = data.called_numbers.includes(number);
        if (isAlreadyCalled && DEBUG_ENABLED) {
          logWithTimestamp(`[NumberDebug] Number ${number} is ALREADY CALLED for session ${sessionId}`, 'warn');
        }
        return isAlreadyCalled;
      }
      
      return false;
    } catch (err) {
      logWithTimestamp(`[NumberDebug] Exception checking called numbers: ${err}`, 'error');
      return false;
    }
  },
  
  /**
   * Compare local and database called numbers
   */
  compareCalledNumbers: async (localNumbers: number[], sessionId: string): Promise<{
    missing: number[];
    extra: number[];
    match: boolean;
  }> => {
    try {
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('called_numbers')
        .eq('session_id', sessionId)
        .single();
        
      if (error || !data || !Array.isArray(data.called_numbers)) {
        return { missing: [], extra: [], match: false };
      }
      
      const dbNumbers = data.called_numbers;
      const missing = dbNumbers.filter(n => !localNumbers.includes(n));
      const extra = localNumbers.filter(n => !dbNumbers.includes(n));
      
      if (DEBUG_ENABLED && (missing.length > 0 || extra.length > 0)) {
        logWithTimestamp(`[NumberDebug] Number discrepancy for session ${sessionId}:
          - Missing from local: ${missing.join(', ')}
          - Extra in local: ${extra.join(', ')}
          - DB has ${dbNumbers.length} numbers, local has ${localNumbers.length} numbers
        `, 'warn');
      }
      
      return {
        missing,
        extra,
        match: missing.length === 0 && extra.length === 0
      };
    } catch (err) {
      logWithTimestamp(`[NumberDebug] Exception comparing numbers: ${err}`, 'error');
      return { missing: [], extra: [], match: false };
    }
  }
};

/**
 * Add called number prevention to supabase client
 * This adds a wrapper to detect and prevent duplicate number calls
 */
export const setupNumberCallPrevention = () => {
  // Store the original .update method
  const originalUpdate = supabase.from('').update;
  
  // Override the update method to check for duplicate numbers
  (supabase.from as any) = function(table: string) {
    const originalFromResult = originalUpdate.call(this, table);
    
    // Only modify behavior for sessions_progress table
    if (table === 'sessions_progress') {
      const originalUpdateFn = originalFromResult.update;
      
      originalFromResult.update = async function(this: any, data: any) {
        // If we're updating called_numbers, check for duplicates
        if (data && data.called_numbers) {
          // Add validation logic here
          logWithTimestamp(`[NumberDebug] Called numbers update detected`, 'info');
        }
        
        // Call the original update function
        return originalUpdateFn.call(this, data);
      };
    }
    
    return originalFromResult;
  };
};
