
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Hook for managing session pattern patterns
 */
export function useSessionPatternManager(sessionId: string | null) {
  const { toast } = useToast();

  /**
   * Initialize the session pattern if it doesn't already have one
   */
  const initializeSessionPattern = useCallback(async () => {
    if (!sessionId) {
      logWithTimestamp('Cannot initialize session pattern: No session ID', 'error');
      return false;
    }

    try {
      // First check if there's already a pattern set
      const { data: progressData } = await supabase
        .from('sessions_progress')
        .select('current_win_pattern, current_game_number')
        .eq('session_id', sessionId)
        .maybeSingle();

      // If there's already a pattern set, we don't need to do anything
      if (progressData?.current_win_pattern) {
        logWithTimestamp('Session already has a win pattern set', 'info');
        return true;
      }

      // Get the game number
      const gameNumber = progressData?.current_game_number || 1;

      // Get the game config for this session
      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('games_config')
        .eq('id', sessionId)
        .single();

      if (!sessionData || !sessionData.games_config) {
        logWithTimestamp('No game config found for session', 'warn');
        return false;
      }

      // Parse the games config if needed
      const gamesConfig = typeof sessionData.games_config === 'string' 
        ? JSON.parse(sessionData.games_config) 
        : sessionData.games_config;

      // Find the config for the current game
      const currentGameConfig = gamesConfig.find((config: any) => 
        config.gameNumber === gameNumber || config.game_number === gameNumber
      );

      if (!currentGameConfig || !currentGameConfig.patterns) {
        logWithTimestamp('No patterns found in game config', 'warn');
        return false;
      }

      // Get the first active pattern
      const patternEntries = Object.entries(currentGameConfig.patterns);
      const firstActivePattern = patternEntries.find(([_, pattern]: [string, any]) => pattern.active);

      if (!firstActivePattern) {
        logWithTimestamp('No active patterns found', 'warn');
        return false;
      }

      const [patternId, patternDetails] = firstActivePattern as [string, Record<string, any>];
      const { prizeAmount, description } = patternDetails;

      // Set the initial pattern
      const { error } = await supabase
        .from('sessions_progress')
        .update({
          current_win_pattern: patternId,
          current_prize: String(prizeAmount || '10.00'),
          current_prize_description: description ? String(description) : `${patternId} Prize`
        })
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error setting initial pattern:', error);
        return false;
      }

      logWithTimestamp(`Initialized win pattern to: ${patternId}`, 'info');
      return true;
    } catch (error) {
      console.error('Error initializing session pattern:', error);
      return false;
    }
  }, [sessionId]);

  /**
   * Update the win pattern for the session
   */
  const updateWinPattern = useCallback(async (patternId: string) => {
    if (!sessionId) {
      toast({
        title: 'Error',
        description: 'Cannot update pattern: No active session',
        variant: 'destructive',
      });
      return false;
    }

    try {
      // Update the pattern in the database
      const { error } = await supabase
        .from('sessions_progress')
        .update({ 
          current_win_pattern: patternId
        })
        .eq('session_id', sessionId);

      if (error) {
        toast({
          title: 'Error',
          description: `Failed to update win pattern: ${error.message}`,
          variant: 'destructive',
        });
        return false;
      }

      // Also update the prize information
      await updatePatternPrizeInfo(patternId);

      toast({
        title: 'Pattern Updated',
        description: `Win pattern has been updated to ${patternId}`,
      });

      return true;
    } catch (error) {
      console.error('Error updating win pattern:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
      return false;
    }
  }, [sessionId, toast]);

  /**
   * Update the prize information for the pattern
   */
  const updatePatternPrizeInfo = useCallback(async (patternId: string) => {
    if (!sessionId) return false;

    try {
      // Get the current game number
      const { data: progressData } = await supabase
        .from('sessions_progress')
        .select('current_game_number')
        .eq('session_id', sessionId)
        .single();

      const gameNumber = progressData?.current_game_number || 1;

      // Get the game config for this session
      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('games_config')
        .eq('id', sessionId)
        .single();

      if (!sessionData?.games_config) {
        return false;
      }

      // Parse the games config if needed
      const gamesConfig = typeof sessionData.games_config === 'string'
        ? JSON.parse(sessionData.games_config)
        : sessionData.games_config;

      // Find the config for the current game
      const currentGameConfig = gamesConfig.find((config: any) =>
        config.gameNumber === gameNumber || config.game_number === gameNumber
      );

      if (!currentGameConfig?.patterns?.[patternId]) {
        return false;
      }

      // Get the pattern details
      const patternDetails = currentGameConfig.patterns[patternId];
      
      // Safely type guard patternDetails
      const prizeAmount = patternDetails && typeof patternDetails === 'object' && 'prizeAmount' in patternDetails 
        ? patternDetails.prizeAmount 
        : '10.00';
        
      const description = patternDetails && typeof patternDetails === 'object' && 'description' in patternDetails
        ? patternDetails.description
        : `${patternId} Prize`;

      // Update the prize information
      const { error } = await supabase
        .from('sessions_progress')
        .update({
          current_prize: String(prizeAmount || '10.00'),
          current_prize_description: String(description || `${patternId} Prize`)
        })
        .eq('session_id', sessionId);

      if (error) {
        console.error('Error updating prize info:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating pattern prize info:', error);
      return false;
    }
  }, [sessionId]);

  return {
    initializeSessionPattern,
    updateWinPattern,
    updatePatternPrizeInfo
  };
}
