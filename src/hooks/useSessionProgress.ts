
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface SessionProgress {
  id: string;
  session_id: string;
  current_game_number: number;
  max_game_number: number;
  current_game_type: string;
  current_win_pattern: string | null;
  called_numbers: number[];
  game_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionProgressUpdate {
  current_game_number?: number;
  current_win_pattern?: string;
  current_game_type?: string;
  called_numbers?: number[];
  game_status?: string;
}

export function useSessionProgress(sessionId: string | undefined) {
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    let subscription: any;

    async function fetchSessionProgress() {
      setLoading(true);
      try {
        console.log(`Fetching session progress for: ${sessionId}`);
        
        const { data, error } = await supabase
          .from('sessions_progress')
          .select('*')
          .eq('session_id', sessionId)
          .single();

        if (error) {
          throw new Error(`Error fetching session progress: ${error.message}`);
        }

        if (data) {
          console.log("Loaded session progress:", data);
          setProgress({
            id: data.id,
            session_id: data.session_id,
            current_game_number: data.current_game_number,
            max_game_number: data.max_game_number,
            current_game_type: data.current_game_type,
            current_win_pattern: data.current_win_pattern,
            called_numbers: data.called_numbers || [],
            game_status: data.game_status,
            created_at: data.created_at,
            updated_at: data.updated_at
          });
        } else {
          console.log("No session progress found, should be created by trigger");
        }
      } catch (err) {
        console.error('Error in useSessionProgress:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchSessionProgress();

    // Set up a real-time subscription to updates
    subscription = supabase
      .channel('session-progress-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions_progress',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const newData = payload.new;
          console.log("Received real-time update for session progress:", newData);
          
          // Ensure the update is for our session
          if (newData.session_id === sessionId) {
            setProgress(prev => {
              if (!prev) {
                return {
                  id: newData.id,
                  session_id: newData.session_id,
                  current_game_number: newData.current_game_number,
                  max_game_number: newData.max_game_number,
                  current_game_type: newData.current_game_type,
                  current_win_pattern: newData.current_win_pattern,
                  called_numbers: newData.called_numbers || [],
                  game_status: newData.game_status,
                  created_at: newData.created_at,
                  updated_at: newData.updated_at
                };
              }
              
              return {
                ...prev,
                current_game_number: newData.current_game_number,
                current_game_type: newData.current_game_type,
                current_win_pattern: newData.current_win_pattern,
                called_numbers: newData.called_numbers || prev.called_numbers || [],
                game_status: newData.game_status,
                updated_at: newData.updated_at,
              };
            });
          }
        }
      )
      .subscribe((status) => {
        console.log("Session progress subscription status:", status);
      });

    return () => {
      console.log("Unsubscribing from session progress changes");
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [sessionId]);

  const updateProgress = async (updates: SessionProgressUpdate): Promise<boolean> => {
    if (!sessionId || !progress) return false;
    
    try {
      console.log("Updating session progress with:", updates);
      
      const { error } = await supabase
        .from('sessions_progress')
        .update(updates)
        .eq('session_id', sessionId);
        
      if (error) {
        console.error("Error updating session progress:", error);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error("Exception updating session progress:", err);
      return false;
    }
  };

  return { 
    progress, 
    loading, 
    error,
    updateProgress
  };
}
