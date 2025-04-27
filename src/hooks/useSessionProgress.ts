
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SessionProgress } from '@/types';

export function useSessionProgress(sessionId?: string) {
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!sessionId) {
      setProgress(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('sessions_progress')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) throw error;

      setProgress(data ? {
        id: data.id,
        session_id: data.session_id,
        current_game_number: data.current_game_number,
        max_game_number: data.max_game_number,
        current_game_type: data.current_game_type,
        current_win_pattern: data.current_win_pattern,
        created_at: data.created_at,
        updated_at: data.updated_at,
        game_status: data.game_status || 'pending'
      } : null);
    } catch (err) {
      console.error("Error fetching session progress:", err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Set up subscription for real-time updates
  useEffect(() => {
    if (!sessionId) return;
    
    fetchProgress();
    
    const channel = supabase
      .channel(`progress-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions_progress',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log("Session progress update:", payload);
          if (payload.new) {
            setProgress({
              id: payload.new.id,
              session_id: payload.new.session_id,
              current_game_number: payload.new.current_game_number,
              max_game_number: payload.new.max_game_number,
              current_game_type: payload.new.current_game_type,
              current_win_pattern: payload.new.current_win_pattern,
              created_at: payload.new.created_at,
              updated_at: payload.new.updated_at,
              game_status: payload.new.game_status || 'pending'
            });
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchProgress]);

  return { progress, isLoading, error, fetchProgress };
}
