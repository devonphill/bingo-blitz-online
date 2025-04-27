
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SessionProgress } from '@/types';

export function useSessionProgress(sessionId: string | undefined) {
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchSessionProgress = useCallback(async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('*')
        .eq('session_id', sessionId)
        .single();
        
      if (error) {
        console.error("Error fetching session progress:", error);
        setError(error.message);
        return;
      }
      
      setProgress(data as SessionProgress);
    } catch (err) {
      console.error("Exception in fetchSessionProgress:", err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);
  
  useEffect(() => {
    fetchSessionProgress();
    
    if (!sessionId) return;
    
    // Subscribe to changes
    const channel = supabase
      .channel(`session-progress-${sessionId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'sessions_progress',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          setProgress(payload.new as SessionProgress);
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchSessionProgress]);
  
  return { progress, isLoading, error, fetchSessionProgress };
}
