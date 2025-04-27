
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SessionProgress } from '@/types';

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
        setProgress(data as unknown as SessionProgress);
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
          setProgress(payload.new as unknown as SessionProgress);
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { progress, loading, error };
}
