
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ProgressType = {
  current_game_number: number;
  max_game_number: number;
  current_win_pattern: string | null;
  current_game_type: string;
};

export const useSessionProgress = (sessionId: string | undefined) => {
  const [progress, setProgress] = useState<ProgressType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    const fetchProgress = async () => {
      try {
        const { data, error } = await supabase
          .from('sessions_progress')
          .select('*')
          .eq('session_id', sessionId)
          .single();

        if (error) {
          console.error('Error fetching session progress:', error);
          setError(error.message);
        } else if (data) {
          console.log('Fetched session progress:', data);
          setProgress(data);
        }
      } catch (err) {
        console.error('Exception fetching session progress:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgress();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`sessions-progress-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions_progress',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        console.log('Session progress changed:', payload);
        if (payload.new) {
          setProgress(payload.new as ProgressType);
        }
      })
      .subscribe();

    // Also listen to game progression broadcasts for redundancy
    const progressChannel = supabase
      .channel('game-progression-channel')
      .on('broadcast', { event: 'game-progression' }, (payload) => {
        console.log("Progress hook received game progression broadcast:", payload);
        
        if (payload.payload && payload.payload.sessionId === sessionId) {
          // Refresh data to get the latest state
          fetchProgress();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(progressChannel);
    };
  }, [sessionId]);

  return {
    progress,
    isLoading,
    error
  };
};
