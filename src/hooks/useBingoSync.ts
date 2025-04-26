
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

export function useBingoSync() {
  const { toast } = useToast();

  useEffect(() => {
    const channel = supabase
      .channel('game-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions'
        },
        (payload) => {
          if (payload.new && payload.new.current_game_state) {
            // Trigger a refresh of the game state
            window.location.reload();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
