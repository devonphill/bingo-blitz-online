
import { useState, useEffect, useRef } from 'react';
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
  const lastUpdateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    const fetchProgress = async () => {
      try {
        console.log(`Fetching session progress for session ${sessionId}`);
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
          // Create a JSON string representation to compare with previous data
          const dataString = JSON.stringify(data);
          if (dataString !== lastUpdateRef.current) {
            lastUpdateRef.current = dataString;
            setProgress(data);
            console.log(`Updated session progress: Game ${data.current_game_number}/${data.max_game_number}, Pattern: ${data.current_win_pattern}`);
          }
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
          // Create a JSON string representation to compare with previous data
          const dataString = JSON.stringify(payload.new);
          if (dataString !== lastUpdateRef.current) {
            lastUpdateRef.current = dataString;
            setProgress(payload.new as ProgressType);
            console.log(`Real-time update: Game ${(payload.new as ProgressType).current_game_number}/${(payload.new as ProgressType).max_game_number}, Pattern: ${(payload.new as ProgressType).current_win_pattern}`);
          }
        }
      })
      .subscribe();

    // Also listen to game progression broadcasts for redundancy
    const progressChannel = supabase
      .channel('game-progression-channel')
      .on('broadcast', { event: 'game-progression' }, (payload) => {
        console.log("Progress hook received game progression broadcast:", payload);
        
        if (payload.payload && payload.payload.sessionId === sessionId) {
          // When receiving a game progression event, fetch the latest progress to ensure synchronization
          console.log(`Received game progression broadcast for session ${sessionId}, refreshing progress`);
          fetchProgress();
          
          // Also update local state immediately if we have pattern information
          if (payload.payload.nextPattern && progress) {
            console.log(`Immediate pattern update from broadcast: ${payload.payload.nextPattern}`);
            setProgress({
              ...progress,
              current_win_pattern: payload.payload.nextPattern,
            });
          }
          
          // If game number changed, update that as well
          if (payload.payload.newGame && progress && payload.payload.newGame !== progress.current_game_number) {
            console.log(`Immediate game number update from broadcast: ${payload.payload.newGame}`);
            setProgress({
              ...progress,
              current_game_number: payload.payload.newGame,
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(progressChannel);
    };
  }, [sessionId, progress]);

  return {
    progress,
    isLoading,
    error
  };
};
