
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

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

export function useSessionProgress(sessionId: string | undefined) {
  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      console.log("No sessionId provided to useSessionProgress");
      setLoading(false);
      return;
    }

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
          if (error.code === 'PGRST116') {
            // No data found, this might be expected in some cases
            console.log(`No session progress found for session ${sessionId}`);
          } else {
            throw new Error(`Error fetching session progress: ${error.message}`);
          }
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
            current_prize: data.current_prize,
            current_prize_description: data.current_prize_description,
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
    
    // No need to set up a real-time subscription since we'll use the WebSocket server for real-time updates
    
  }, [sessionId]);

  const updateProgress = async (updates: SessionProgressUpdate): Promise<boolean> => {
    if (!sessionId || !progress) {
      console.error("Cannot update session progress - missing sessionId or progress data");
      return false;
    }
    
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
