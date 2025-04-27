
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SessionProgress, GameType } from '@/types';

export function useSessionProgress(sessionId?: string) {
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function getProgress() {
      if (!sessionId) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('sessions_progress')
          .select('*')
          .eq('session_id', sessionId)
          .single();
          
        if (error) throw error;
        
        // Create a sessions_progress record if it doesn't exist
        const progressData: SessionProgress = {
          id: data?.id || '',
          session_id: data?.session_id || '',
          current_game_number: data?.current_game_number || 1,
          max_game_number: data?.max_game_number || 1,
          current_win_pattern: data?.current_win_pattern || null,
          current_game_type: (data?.current_game_type as GameType) || 'mainstage',
          created_at: data?.created_at || '',
          updated_at: data?.updated_at || '',
          called_numbers: data?.called_numbers || [],
          game_status: data?.game_status || 'pending'
        };
        
        setProgress(progressData);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching session progress:', err);
      } finally {
        setLoading(false);
      }
    }
    
    getProgress();

    // Set up real-time subscription for progress updates
    const channel = supabase
      .channel(`progress-updates-${sessionId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public',
          table: 'sessions_progress',
          filter: `session_id=eq.${sessionId}` 
        },
        payload => {
          console.log('Progress update received:', payload);
          
          if (!payload.new) return;
          
          // Safe property access with defaults for database fields that might not exist
          const newData = payload.new || {};
          
          const updatedProgress: SessionProgress = {
            id: newData.id || '',
            session_id: newData.session_id || '',
            current_game_number: newData.current_game_number || 1,
            max_game_number: newData.max_game_number || 1,
            current_win_pattern: newData.current_win_pattern || null,
            current_game_type: (newData.current_game_type as GameType) || 'mainstage',
            created_at: newData.created_at || '',
            updated_at: newData.updated_at || '',
            called_numbers: newData.called_numbers || [],
            game_status: newData.game_status || 'pending'
          };
          
          setProgress(updatedProgress);
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { progress, loading, error };
}
