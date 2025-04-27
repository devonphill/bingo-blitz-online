
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useBingoSync() {
  useEffect(() => {
    // Set up real-time listener for game updates
    const channel = supabase.channel('player-game-updates')
      .on('broadcast', { event: 'game-updates' }, (payload) => {
        console.log('Received game update broadcast:', payload);
        
        // Force refresh when receiving state updates
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      })
      .subscribe();
    
    // Set up visibility change handler to refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, refreshing game state');
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      // Clean up
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
