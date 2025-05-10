import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { validateChannelType } from '@/utils/typeUtils';
import { isFinalPattern } from '@/services/ClaimUtils';

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
   * Check if the current pattern is the final one
   */
  const isLastPattern = useCallback(async (
    currentWinPattern: string | null,
    gameNumber: number | undefined
  ): Promise<boolean> => {
    if (!sessionId || !gameNumber || !currentWinPattern) return false;
    
    try {
      const { data: gameSessionData, error: fetchError } = await supabase
        .from('game_sessions')
        .select('games_config')
        .eq('id', sessionId)
        .single();
        
      if (fetchError || !gameSessionData?.games_config) {
        return false;
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
        return false;
      }
      
      // Get active pattern IDs
      const activePatternIds = Object.entries(currentConfig.patterns)
        .filter(([_, pattern]: [string, any]) => pattern.active === true)
        .map(([id]: [string, any]) => id);
      
      // Check if current pattern is the last one
      return isFinalPattern(currentWinPattern, activePatternIds);
    } catch (error) {
      console.error("Error checking if pattern is last:", error);
      return false;
    }
  }, [sessionId]);

  /**
   * Get active patterns for a game
   */
  const getActivePatterns = useCallback(async (
    gameNumber: number | undefined
  ): Promise<string[]> => {
    if (!sessionId || !gameNumber) return [];
    
    try {
      const { data: gameSessionData, error: fetchError } = await supabase
        .from('game_sessions')
        .select('games_config')
        .eq('id', sessionId)
        .single();
        
      if (fetchError || !gameSessionData?.games_config) {
        return [];
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
        return [];
      }
      
      // Get active pattern IDs
      return Object.entries(currentConfig.patterns)
        .filter(([_, pattern]: [string, any]) => pattern.active === true)
        .map(([id]: [string, any]) => id);
    } catch (error) {
      console.error("Error getting active patterns:", error);
      return [];
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

  /**
   * Progress to the next game when this game is complete
   */
  const progressToNextGame = useCallback(async (
    currentGameNumber: number
  ) => {
    if (!sessionId) return false;
    
    try {
      const nextGameNumber = currentGameNumber + 1;
      logWithTimestamp(`Progressing to next game: ${nextGameNumber}`, 'info');
      
      // Get session info to check max games
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select('number_of_games, games_config')
        .eq('id', sessionId)
        .single();
        
      if (sessionError || !sessionData) {
        console.error("Error fetching session data:", sessionError);
        return false;
      }
      
      // If this was the final game, mark as completed
      if (nextGameNumber > sessionData.number_of_games) {
        logWithTimestamp(`This was the final game. Marking session as completed.`, 'info');
        
        // Update session status to completed
        await supabase
          .from('game_sessions')
          .update({ status: 'completed' })
          .eq('id', sessionId);
          
        // Update session progress as well
        await supabase
          .from('sessions_progress')
          .update({ 
            game_status: 'completed'
          })
          .eq('session_id', sessionId);
          
        // Broadcast completion
        const broadcastChannel = supabase.channel('game-updates');
        await broadcastChannel.send({
          type: validateChannelType('broadcast'),
          event: 'session-completed',
          payload: { sessionId }
        });
        
        return true;
      }
      
      // Otherwise, advance to next game
      // Update the current game in the session
      await supabase
        .from('game_sessions')
        .update({ current_game: nextGameNumber })
        .eq('id', sessionId);
        
      // Parse game configs if needed
      const configs = typeof sessionData.games_config === 'string'
        ? JSON.parse(sessionData.games_config)
        : sessionData.games_config;
        
      // Find config for next game
      const nextGameConfig = configs.find((config: any) => 
        config.gameNumber === nextGameNumber || config.game_number === nextGameNumber
      );
      
      // Get first active pattern for next game
      let firstActivePattern = null;
      if (nextGameConfig && nextGameConfig.patterns) {
        const activePatternEntry = Object.entries(nextGameConfig.patterns)
          .find(([_, pattern]: [string, any]) => pattern.active === true);
          
        if (activePatternEntry) {
          firstActivePattern = {
            id: activePatternEntry[0],
            ...activePatternEntry[1]
          };
        }
      }
      
      // Reset session progress for new game
      await supabase
        .from('sessions_progress')
        .update({
          current_game_number: nextGameNumber,
          called_numbers: [], // Reset called numbers
          current_win_pattern: firstActivePattern ? firstActivePattern.id : 'oneLine',
          current_prize: firstActivePattern ? String(firstActivePattern.prizeAmount || '10.00') : '10.00',
          current_prize_description: firstActivePattern 
            ? String(firstActivePattern.description || `${firstActivePattern.id} Prize`)
            : 'First Line Prize',
          game_status: 'active'
        })
        .eq('session_id', sessionId);
        
      // Broadcast game progression
      const broadcastChannel = supabase.channel('game-updates');
      await broadcastChannel.send({
        type: validateChannelType('broadcast'),
        event: 'game-advanced',
        payload: {
          sessionId,
          gameNumber: nextGameNumber,
          winPattern: firstActivePattern ? firstActivePattern.id : 'oneLine'
        }
      });
      
      logWithTimestamp(`Successfully progressed to game ${nextGameNumber}`, 'info');
      return true;
    } catch (err) {
      console.error("Error progressing to next game:", err);
      return false;
    }
  }, [sessionId]);

  return {
    findNextWinPattern,
    progressToNextPattern,
    isLastPattern,
    getActivePatterns,
    progressToNextGame
  };
}
