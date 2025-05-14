
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export function useSessionProgress(sessionId: string | null | undefined) {
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add a unique identifier for this hook instance for better logging
  const hookId = useState(() => Math.random().toString(36).substring(2, 8))[0];
  
  const fetchSessionProgress = useCallback(async () => {
    if (!sessionId) {
      logWithTimestamp(`[useSessionProgress-${hookId}] No sessionId provided to useSessionProgress`, 'info');
      setLoading(false);
      return;
    }
    
    logWithTimestamp(`[useSessionProgress-${hookId}] Fetching session progress for: ${sessionId}`, 'info');
    
    try {
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('*')
        .eq('session_id', sessionId)
        .single();
      
      if (error) {
        throw new Error(`Failed to load session progress: ${error.message}`);
      }
      
      if (data) {
        logWithTimestamp(`[useSessionProgress-${hookId}] Loaded session progress successfully`, 'info');
        
        // Log the current win pattern and game status
        if (data.current_win_pattern) {
          logWithTimestamp(`[useSessionProgress-${hookId}] Current win pattern from database: ${data.current_win_pattern}`, 'info');
        }
        
        if (data.current_win_pattern) {
          logWithTimestamp(`[useSessionProgress-${hookId}] Current win pattern: ${data.current_win_pattern}`, 'info');
        }
        
        if (data.game_status) {
          logWithTimestamp(`[useSessionProgress-${hookId}] Game status: ${data.game_status}`, 'info');
        }
        
        setProgress(data);
      } else {
        logWithTimestamp(`[useSessionProgress-${hookId}] No session progress found for session ID: ${sessionId}`, 'warn');
      }
      
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load session progress';
      logWithTimestamp(`[useSessionProgress-${hookId}] Error loading session progress: ${errorMessage}`, 'error');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [sessionId, hookId]);
  
  // Initial fetch
  useEffect(() => {
    fetchSessionProgress();
  }, [fetchSessionProgress]);
  
  // Set up realtime subscription
  useEffect(() => {
    if (!sessionId) return;
    
    logWithTimestamp(`[useSessionProgress-${hookId}] Setting up session progress subscription for session ${sessionId}`, 'info');
    
    const subscription = supabase
      .channel(`session-progress-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions_progress', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          logWithTimestamp(`[useSessionProgress-${hookId}] Received session progress update from subscription`, 'info');
          
          // Refresh our data when there's a change
          fetchSessionProgress();
        }
      )
      .subscribe();
    
    // Log an additional setup message for better debugging
    logWithTimestamp(`[useSessionProgress-${hookId}] Setting up session progress for session ${sessionId}`, 'info');
    
    return () => {
      supabase.removeChannel(subscription);
      logWithTimestamp(`[useSessionProgress-${hookId}] Cleaned up session progress subscription for session ${sessionId}`, 'info');
    };
  }, [sessionId, fetchSessionProgress, hookId]);
  
  return {
    progress,
    loading,
    error,
    refreshSessionProgress: fetchSessionProgress
  };
}
