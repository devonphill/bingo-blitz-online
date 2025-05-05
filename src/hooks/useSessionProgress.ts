
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logWithTimestamp } from '@/utils/logUtils';

export interface SessionProgress {
  id: string;
  session_id: string;
  current_game_number: number;
  max_game_number: number;
  current_game_type: string | null;
  current_win_pattern: string | null;
  called_numbers: number[];
  game_status: string | null;
  current_prize: string | null;
  current_prize_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionProgressUpdate {
  current_game_number?: number;
  current_win_pattern?: string;
  current_game_type?: string;
  called_numbers?: number[];
  game_status?: string;
  current_prize?: string;
  current_prize_description?: string;
}

/**
 * Hook to manage session progress data with real-time updates
 * @param sessionId The ID of the game session to track
 * @returns Object containing progress data, loading state, error state, and update function
 */
export function useSessionProgress(sessionId: string | undefined) {
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Added for better debugging
  const hookId = `useSessionProgress-${Math.random().toString(36).substring(2, 8)}`;

  useEffect(() => {
    // Abort controller to cancel fetch if component unmounts
    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout>;
    let channel: any = null;
    
    // If no sessionId is provided, just set loading to false and return
    if (!sessionId) {
      setLoading(false);
      logWithTimestamp(`[${hookId}] No sessionId provided to useSessionProgress`, 'info'); // Changed from 'warn' to 'info'
      return;
    }

    async function fetchSessionProgress() {
      // Clear any previous errors
      setError(null);
      setLoading(true);
      
      try {
        logWithTimestamp(`[${hookId}] Fetching session progress for: ${sessionId}`, 'info');
        
        const { data, error } = await supabase
          .from('sessions_progress')
          .select('*')
          .eq('session_id', sessionId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No data found, this might be expected in some cases
            logWithTimestamp(`[${hookId}] No session progress found for session ${sessionId}, will create one if needed`, 'info');
          } else {
            throw new Error(`Error fetching session progress: ${error.message}`);
          }
        }

        if (data) {
          logWithTimestamp(`[${hookId}] Loaded session progress successfully`, 'info');
          setProgress({
            id: data.id,
            session_id: data.session_id,
            current_game_number: data.current_game_number,
            max_game_number: data.max_game_number,
            current_game_type: data.current_game_type,
            current_win_pattern: data.current_win_pattern,
            called_numbers: data.called_numbers || [],
            game_status: data.game_status,
            current_prize: data.current_prize,
            current_prize_description: data.current_prize_description,
            created_at: data.created_at,
            updated_at: data.updated_at
          });
        } else {
          // Check if we need to create a new sessions_progress entry
          logWithTimestamp(`[${hookId}] No session progress found, checking if we need to create one`, 'info');
          
          // Get session information first
          const { data: sessionData } = await supabase
            .from('game_sessions')
            .select('number_of_games, game_type')
            .eq('id', sessionId)
            .single();
            
          if (sessionData) {
            logWithTimestamp(`[${hookId}] Creating new session progress for session ${sessionId}`, 'info');
            // Create a new session progress entry
            const { data: newProgress, error: createError } = await supabase
              .from('sessions_progress')
              .insert({
                session_id: sessionId,
                current_game_number: 1,
                max_game_number: sessionData.number_of_games || 1,
                current_game_type: sessionData.game_type,
                called_numbers: [],
                game_status: 'pending'
              })
              .select('*')
              .single();
              
            if (createError) {
              throw new Error(`Failed to create session progress: ${createError.message}`);
            }
            
            if (newProgress) {
              logWithTimestamp(`[${hookId}] New session progress created successfully`, 'info');
              setProgress({
                id: newProgress.id,
                session_id: newProgress.session_id,
                current_game_number: newProgress.current_game_number,
                max_game_number: newProgress.max_game_number,
                current_game_type: newProgress.current_game_type,
                current_win_pattern: newProgress.current_win_pattern,
                called_numbers: newProgress.called_numbers || [],
                game_status: newProgress.game_status,
                current_prize: newProgress.current_prize,
                current_prize_description: newProgress.current_prize_description,
                created_at: newProgress.created_at,
                updated_at: newProgress.updated_at
              });
            }
          }
        }
      } catch (err) {
        const errorMessage = (err as Error).message;
        logWithTimestamp(`[${hookId}] Error in useSessionProgress: ${errorMessage}`, 'error');
        setError(errorMessage);
        
        // Retry once after 2 seconds if there was an error
        if (!abortController.signal.aborted) {
          timeoutId = setTimeout(() => {
            logWithTimestamp(`[${hookId}] Retrying session progress fetch...`, 'info');
            fetchSessionProgress();
          }, 2000);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchSessionProgress();
    
    // Set up real-time subscription for session progress updates
    // Only set up if sessionId is valid
    if (sessionId) {
      channel = supabase
        .channel(`session_progress_${sessionId}`)
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'sessions_progress',
            filter: `session_id=eq.${sessionId}`
          }, 
          (payload) => {
            if (payload.new) {
              logWithTimestamp(`[${hookId}] Received real-time update for session progress`, 'debug');
              setProgress(prev => {
                // Only update if there are actual changes
                const newData = payload.new as any;
                if (JSON.stringify(prev) === JSON.stringify(newData)) {
                  return prev;
                }
                return {
                  id: newData.id,
                  session_id: newData.session_id,
                  current_game_number: newData.current_game_number,
                  max_game_number: newData.max_game_number,
                  current_game_type: newData.current_game_type,
                  current_win_pattern: newData.current_win_pattern,
                  called_numbers: newData.called_numbers || [],
                  game_status: newData.game_status,
                  current_prize: newData.current_prize,
                  current_prize_description: newData.current_prize_description,
                  created_at: newData.created_at,
                  updated_at: newData.updated_at
                };
              });
            }
          }
        )
        .subscribe();
    }
    
    // Clean up function
    return () => {
      abortController.abort();
      if (timeoutId) clearTimeout(timeoutId);
      if (channel) supabase.removeChannel(channel);
    };
  }, [sessionId, hookId]);

  const updateProgress = useCallback(async (updates: SessionProgressUpdate): Promise<boolean> => {
    if (!sessionId || !progress?.id) {
      logWithTimestamp(`[${hookId}] Cannot update session progress - missing sessionId or progress data`, 'error');
      return false;
    }
    
    try {
      logWithTimestamp(`[${hookId}] Updating session progress with: ${JSON.stringify(updates)}`, 'info');
      
      const { error } = await supabase
        .from('sessions_progress')
        .update(updates)
        .eq('session_id', sessionId);
        
      if (error) {
        logWithTimestamp(`[${hookId}] Error updating session progress: ${error.message}`, 'error');
        return false;
      }
      
      logWithTimestamp(`[${hookId}] Session progress updated successfully`, 'info');
      return true;
    } catch (err) {
      logWithTimestamp(`[${hookId}] Exception updating session progress: ${(err as Error).message}`, 'error');
      return false;
    }
  }, [sessionId, progress, hookId]);

  return { 
    progress, 
    loading, 
    error,
    updateProgress
  };
}

