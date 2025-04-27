
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SessionProgress } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useSessionProgress(sessionId?: string) {
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    const fetchProgress = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('sessions_progress')
          .select('*')
          .eq('session_id', sessionId)
          .single();

        if (fetchError) {
          console.error('Error fetching session progress:', fetchError);
          setError(fetchError.message);
          return;
        }

        setProgress(data);
      } catch (err) {
        console.error('Error in session progress hook:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`sessions-progress-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions_progress',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('Session progress update:', payload);
          if (payload.eventType === 'UPDATE' && payload.new) {
            setProgress(payload.new as SessionProgress);
          }
        }
      )
      .subscribe();

    fetchProgress();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { progress, isLoading, error };
}
