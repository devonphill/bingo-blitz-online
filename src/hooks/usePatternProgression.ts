
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { validateChannelType } from '@/utils/typeUtils';

/**
 * Hook for managing win pattern progression
 */
export function usePatternProgression(sessionId: string | null) {
  /**
   * Find the next win pattern after the current one
   */
  const findNextWinPattern = useCallback(async (
    currentWinPattern: string | null, 
    gameNumber: number | undefined
  ) => {
    if (!sessionId || !gameNumber) return null;
    
    try {
      logWithTimestamp(`Finding next win pattern after ${currentWinPattern} for game ${gameNumber}`, 'info');
      
      const { data: gameSessionData, error: fetchError } = await supabase
        .from('game_sessions')
        .select('games_config')
        .eq('id', sessionId)
        .single();
        
      if (fetchError) {
        console.error("Error fetching game config:", fetchError);
        return null;
      }
      
      if (!gameSessionData?.games_config) {
        logWithTimestamp(`No game configs found for session ${sessionId}`, 'warn');
        return null;
      }
      
      // Parse game configs if needed
      const configs = typeof gameSessionData.games_config === 'string'
        ? JSON.parse(gameSessionData.games_config)
        : gameSessionData.games_config;
        
      // Find config for current game
      const currentConfig = configs.find((config: any) => 
        config.gameNumber === gameNumber || config.game_number === gameNumber
      );
      
      if (!currentConfig || !currentConfig.patterns) {
        logWithTimestamp(`No pattern config found for game ${gameNumber}`, 'warn');
        return null;
      }
      
      // Get all active patterns
      const activePatterns = Object.entries(currentConfig.patterns)
        .filter(([_, pattern]: [string, any]) => pattern.active === true)
        .map(([id, pattern]: [string, any]) => ({
          id,
          ...pattern
        }));
      
      logWithTimestamp(`Found ${activePatterns.length} active patterns: ${activePatterns.map((p: any) => p.id).join(', ')}`, 'info');
      
      // If no currentWinPattern, return the first active pattern
      if (!currentWinPattern && activePatterns.length > 0) {
        return activePatterns[0];
      }
      
      // Find index of current pattern
      const currentIndex = activePatterns.findIndex((p: any) => p.id === currentWinPattern);
      if (currentIndex < 0 || currentIndex >= activePatterns.length - 1) {
        logWithTimestamp(`Current pattern is the last one or not found: ${currentWinPattern}`, 'info');
        return null; // No next pattern
      }
      
      // Return next pattern
      const nextPattern = activePatterns[currentIndex + 1];
      logWithTimestamp(`Found next pattern: ${nextPattern.id}`, 'info');
      return nextPattern;
    } catch (error) {
      console.error("Error finding next win pattern:", error);
      return null;
    }
  }, [sessionId]);

  /**
   * Update session progress with the next pattern
   */
  const progressToNextPattern = useCallback(async (
    nextPattern: any,
    sessionId: string
  ) => {
    if (!nextPattern || !sessionId) return false;
    
    try {
      logWithTimestamp(`Progressing to next pattern: ${nextPattern.id}, prize: ${nextPattern.prizeAmount}, description: ${nextPattern.description}`, 'info');
      
      // Update session progress with next pattern
      const { error: updateError } = await supabase
        .from('sessions_progress')
        .update({
          current_win_pattern: nextPattern.id,
          current_prize: String(nextPattern.prizeAmount || '10.00'),
          current_prize_description: String(nextPattern.description || `${nextPattern.id} Prize`)
        })
        .eq('session_id', sessionId);
        
      if (updateError) {
        console.error("Error updating win pattern:", updateError);
        logWithTimestamp(`Error updating to next pattern: ${updateError.message}`, 'error');
        return false;
      } 
      
      logWithTimestamp(`Successfully updated to next pattern: ${nextPattern.id}`, 'info');
      
      // Broadcast pattern change for realtime update
      try {
        const broadcastChannel = supabase.channel('pattern-updates');
        await broadcastChannel.send({
          type: validateChannelType('broadcast'),
          event: 'pattern-changed',
          payload: {
            sessionId: String(sessionId),
            winPattern: String(nextPattern.id),
            prize: String(nextPattern.prizeAmount || '10.00'),
            prizeDescription: String(nextPattern.description || `${nextPattern.id} Prize`)
          }
        });
        
        logWithTimestamp(`Pattern change broadcast sent for pattern: ${nextPattern.id}`, 'info');
        return true;
      } catch (err) {
        console.error("Error broadcasting pattern update:", err);
        return false;
      }
    } catch (err) {
      console.error("Error progressing to next pattern:", err);
      return false;
    }
  }, []);

  return {
    findNextWinPattern,
    progressToNextPattern
  };
}
