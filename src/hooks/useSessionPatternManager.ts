
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateChannelType } from '@/utils/typeUtils';
import { logWithTimestamp } from '@/utils/logUtils';

export function useSessionPatternManager(sessionId: string | null = null) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  /**
   * Updates the game configuration for a session
   */
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
  
  /**
   * Updates the current win pattern, prize and description
   */
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

  /**
   * Initializes the session pattern if it doesn't have one yet
   */
  const initializeSessionPattern = useCallback(async () => {
    if (!sessionId) return false;
    
    try {
      logWithTimestamp(`Initializing session pattern for session ${sessionId}`, 'info');
      
      // Check if the session already has a pattern
      const { data, error } = await supabase
        .from('sessions_progress')
        .select('current_win_pattern, current_game_number')
        .eq('session_id', sessionId)
        .single();
        
      if (error) {
        logWithTimestamp(`Error fetching session progress: ${error.message}`, 'error');
        return false;
      }
      
      // If already has a pattern, no need to initialize
      if (data && data.current_win_pattern) {
        logWithTimestamp(`Session already has pattern: ${data.current_win_pattern}`, 'info');
        return true;
      }
      
      // Fetch game config to get initial pattern
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select('games_config')
        .eq('id', sessionId)
        .single();
        
      if (sessionError || !sessionData) {
        logWithTimestamp(`Error fetching game config: ${sessionError?.message || 'No data'}`, 'error');
        return false;
      }
      
      // Parse the games config
      const gameConfigs = typeof sessionData.games_config === 'string'
        ? JSON.parse(sessionData.games_config)
        : sessionData.games_config;
      
      if (!Array.isArray(gameConfigs) || gameConfigs.length === 0) {
        logWithTimestamp(`No game configs found for session ${sessionId}`, 'warn');
        return false;
      }
      
      // Find the first game and its first active pattern
      const gameNumber = data?.current_game_number || 1;
      const gameConfig = gameConfigs.find((g: any) => 
        g.gameNumber === gameNumber || g.game_number === gameNumber
      );
      
      if (!gameConfig || !gameConfig.patterns) {
        logWithTimestamp(`No patterns found for game ${gameNumber}`, 'warn');
        return false;
      }
      
      // Find first active pattern
      const patterns = Object.entries(gameConfig.patterns);
      const firstActivePattern = patterns.find(([_, p]: [string, any]) => p.active === true);
      
      if (!firstActivePattern) {
        logWithTimestamp(`No active patterns found for game ${gameNumber}`, 'warn');
        return false;
      }
      
      const [patternId, pattern] = firstActivePattern;
      
      // Update the session with the first pattern
      return updateWinPattern(
        sessionId,
        patternId,
        pattern.prizeAmount,
        pattern.description
      );
    } catch (err) {
      logWithTimestamp(`Error initializing session pattern: ${(err as Error).message}`, 'error');
      return false;
    }
  }, [sessionId, updateWinPattern]);

  /**
   * Updates the prize information for a specific win pattern
   */
  const updatePatternPrizeInfo = useCallback(async (winPattern: string) => {
    if (!sessionId || !winPattern) return false;
    
    try {
      // Fetch game config to get pattern details
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select('games_config')
        .eq('id', sessionId)
        .single();
        
      if (sessionError || !sessionData) {
        logWithTimestamp(`Error fetching game config: ${sessionError?.message || 'No data'}`, 'error');
        return false;
      }
      
      // Get current game number
      const { data: progressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('current_game_number')
        .eq('session_id', sessionId)
        .single();
        
      if (progressError || !progressData) {
        logWithTimestamp(`Error fetching session progress: ${progressError?.message || 'No data'}`, 'error');
        return false;
      }
      
      // Parse the games config
      const gameConfigs = typeof sessionData.games_config === 'string'
        ? JSON.parse(sessionData.games_config)
        : sessionData.games_config;
      
      if (!Array.isArray(gameConfigs) || gameConfigs.length === 0) {
        logWithTimestamp(`No game configs found for session ${sessionId}`, 'warn');
        return false;
      }
      
      // Find the current game and the specified pattern
      const gameNumber = progressData.current_game_number;
      const gameConfig = gameConfigs.find((g: any) => 
        g.gameNumber === gameNumber || g.game_number === gameNumber
      );
      
      if (!gameConfig || !gameConfig.patterns || !gameConfig.patterns[winPattern]) {
        logWithTimestamp(`Pattern ${winPattern} not found for game ${gameNumber}`, 'warn');
        return false;
      }
      
      const patternInfo = gameConfig.patterns[winPattern];
      
      // Update the session with the pattern info
      return updateWinPattern(
        sessionId,
        winPattern,
        patternInfo.prizeAmount,
        patternInfo.description
      );
    } catch (err) {
      logWithTimestamp(`Error updating pattern prize: ${(err as Error).message}`, 'error');
      return false;
    }
  }, [sessionId, updateWinPattern]);

  return {
    isLoading,
    updateGameConfig,
    updateWinPattern,
    initializeSessionPattern,
    updatePatternPrizeInfo
  };
}
