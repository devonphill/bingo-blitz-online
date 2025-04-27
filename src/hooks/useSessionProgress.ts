
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SessionProgress } from '@/types';

export function useSessionProgress(sessionId: string | undefined) {
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!sessionId) return;
    
    setLoading(true);
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
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);
  
  const updateProgress = useCallback(async (updates: Partial<SessionProgress>) => {
    if (!sessionId || !progress) return false;
    
    try {
      const { error } = await supabase
        .from('sessions_progress')
        .update(updates)
        .eq('session_id', sessionId);
        
      if (error) {
        console.error("Error updating session progress:", error);
        return false;
      }
      
      setProgress(prev => prev ? { ...prev, ...updates } : null);
      return true;
    } catch (err: any) {
      console.error("Exception updating session progress:", err);
      return false;
    }
  }, [sessionId, progress]);
  
  // Setup realtime subscription
  useEffect(() => {
    if (!sessionId) return;
    
    // Fetch initial progress
    fetchProgress();
    
    // Subscribe to changes
    const channel = supabase
      .channel('sessions_progress_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions_progress', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          console.log('Session progress changed:', payload);
          fetchProgress();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchProgress]);
  
  return {
    progress,
    loading,
    error,
    fetchProgress,
    updateProgress
  };
}
