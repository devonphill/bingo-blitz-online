import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateChannelType } from '@/utils/typeUtils';

export function useSessionPatternManager() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const updateGameConfig = useCallback(async (sessionId: string, gameConfigs: any[]) => {
    try {
      if (!sessionId) return false;
      
      // Convert gameConfigs to string for storage if needed
      const configData = Array.isArray(gameConfigs) ? gameConfigs : [];
      
      const { error } = await supabase
        .from('game_sessions')
        .update({ games_config: configData })
        .eq('id', sessionId);
        
      if (error) {
        console.error("Error updating game config:", error);
        return false;
      }
      
      // Broadcast update to any connected players
      const channel = supabase.channel('game-config-updates');
      await channel.send({
        type: validateChannelType('broadcast'),
        event: 'config-updated', 
        payload: { 
          sessionId: String(sessionId), // Fix: Convert to string explicitly
          timestamp: new Date().getTime() 
        }
      });
      
      return true;
    } catch (err) {
      console.error("Error in updateGameConfig:", err);
      return false;
    }
  }, []);
  
  const updateWinPattern = useCallback(async (
    sessionId: string,
    winPattern: string,
    prize?: string,
    description?: string
  ) => {
    if (!sessionId || !winPattern) return false;
    
    try {
      const { error } = await supabase
        .from('sessions_progress')
        .update({
          current_win_pattern: winPattern,
          current_prize: prize || '10.00',
          current_prize_description: description || `${winPattern} Prize`
        })
        .eq('session_id', sessionId);
        
      if (error) {
        console.error("Error updating win pattern:", error);
        return false;
      }
      
      // Broadcast the update
      const broadcastChannel = supabase.channel('pattern-updates');
      await broadcastChannel.send({
        type: validateChannelType('broadcast'),
        event: 'pattern-changed',
        payload: {
          sessionId: String(sessionId), // Fix: Convert to string explicitly
          winPattern,
          prize: prize || '10.00',
          prizeDescription: description || `${winPattern} Prize`
        }
      });
      
      return true;
    } catch (error) {
      console.error("Error updating win pattern:", error);
      return false;
    }
  }, []);

  return {
    isLoading,
    updateGameConfig,
    updateWinPattern
  };
}
