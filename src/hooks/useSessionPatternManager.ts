
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { validateChannelType, ensureString } from '@/utils/typeUtils';
import type { Json } from '@/types/json';

/**
 * Hook for managing session win patterns and prize information
 */
export function useSessionPatternManager(sessionId: string | null) {
  const [isUpdating, setIsUpdating] = useState(false);

  // Initialize a session with the first pattern from its config
  const initializeSessionPattern = useCallback(async () => {
    if (!sessionId) return false;
    
    setIsUpdating(true);
    try {
      // First, fetch the session's game configs
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select('games_config, current_game')
        .eq('id', sessionId)
        .single();
        
      if (sessionError) {
        console.error('Error fetching session data:', sessionError);
        return false;
      }
      
      if (!sessionData || !sessionData.games_config) {
        logWithTimestamp('No game configs found for this session', 'warn');
        return false;
      }
      
      // Parse the game configs
      const configs = Array.isArray(sessionData.games_config) 
        ? sessionData.games_config 
        : JSON.parse(sessionData.games_config);
      
      // Find the config for the current game
      const currentGame = sessionData.current_game || 1;
      const currentConfig = configs.find((config: any) => 
        config.gameNumber === currentGame || 
        config.game_number === currentGame
      );
      
      if (!currentConfig || !currentConfig.patterns) {
        logWithTimestamp('No patterns found for current game', 'warn');
        return false;
      }
      
      // Find the first active pattern
      const activePatterns = Object.entries(currentConfig.patterns)
        .filter(([_, value]: [string, any]) => value.active === true)
        .map(([key, value]: [string, any]) => ({
          id: key,
          ...value
        }));
      
      if (activePatterns.length === 0) {
        logWithTimestamp('No active patterns found for this game', 'warn');
        return false;
      }
      
      // Use the first active pattern
      const firstPattern = activePatterns[0];
      logWithTimestamp(`Initializing session with pattern: ${firstPattern.id}`, 'info');
      
      // Check if sessions_progress exists for this session
      const { data: existingProgress } = await supabase
        .from('sessions_progress')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();
      
      if (existingProgress) {
        // Update the progress with the first pattern
        const { error: updateError } = await supabase
          .from('sessions_progress')
          .update({
            current_win_pattern: ensureString(firstPattern.id as Json),
            current_prize: ensureString(firstPattern.prizeAmount as Json),
            current_prize_description: ensureString(firstPattern.description as Json)
          })
          .eq('session_id', sessionId);
          
        if (updateError) {
          console.error('Error updating session progress:', updateError);
          return false;
        }
      } else {
        // Create a new progress record if it doesn't exist
        const { error: insertError } = await supabase
          .from('sessions_progress')
          .insert({
            session_id: sessionId,
            current_game_number: currentGame,
            max_game_number: configs.length,
            current_game_type: currentConfig.gameType,
            current_win_pattern: ensureString(firstPattern.id as Json),
            current_prize: ensureString(firstPattern.prizeAmount as Json),
            current_prize_description: ensureString(firstPattern.description as Json)
          });
          
        if (insertError) {
          console.error('Error inserting session progress:', insertError);
          return false;
        }
      }
      
      logWithTimestamp(`Successfully initialized session pattern to ${firstPattern.id}`, 'info');
      
      // Broadcast pattern change
      try {
        const broadcastChannel = supabase.channel('pattern-updates');
        await broadcastChannel.send({
          type: validateChannelType('broadcast'),
          event: 'pattern-initialized',
          payload: {
            sessionId,
            winPattern: firstPattern.id,
            prize: firstPattern.prizeAmount,
            prizeDescription: firstPattern.description
          }
        });
      } catch (err) {
        console.error('Error broadcasting pattern update:', err);
      }
      
      return true;
    } catch (error) {
      console.error('Error initializing session pattern:', error);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [sessionId]);
  
  // Function to update prize info for an existing pattern
  const updatePatternPrizeInfo = useCallback(async (patternId: string) => {
    if (!sessionId || !patternId) return false;
    
    setIsUpdating(true);
    try {
      // First, fetch the session's game configs
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select('games_config, current_game')
        .eq('id', sessionId)
        .single();
        
      if (sessionError) {
        console.error('Error fetching session data:', sessionError);
        return false;
      }
      
      if (!sessionData || !sessionData.games_config) {
        logWithTimestamp('No game configs found for this session', 'warn');
        return false;
      }
      
      // Parse the game configs
      const configs = Array.isArray(sessionData.games_config) 
        ? sessionData.games_config 
        : JSON.parse(sessionData.games_config);
      
      // Find the config for the current game
      const currentGame = sessionData.current_game || 1;
      const currentConfig = configs.find((config: any) => 
        config.gameNumber === currentGame || 
        config.game_number === currentGame
      );
      
      if (!currentConfig || !currentConfig.patterns) {
        logWithTimestamp('No patterns found for current game', 'warn');
        return false;
      }
      
      // Find the specified pattern
      const pattern = currentConfig.patterns[patternId];
      if (!pattern) {
        logWithTimestamp(`Pattern ${patternId} not found in current game config`, 'warn');
        return false;
      }
      
      // Update the session progress with the pattern's prize info
      const { error: updateError } = await supabase
        .from('sessions_progress')
        .update({
          current_prize: ensureString(pattern.prizeAmount as Json || '10.00'),
          current_prize_description: ensureString(pattern.description as Json || `${patternId} Prize`)
        })
        .eq('session_id', sessionId);
        
      if (updateError) {
        console.error('Error updating prize info:', updateError);
        return false;
      }
      
      logWithTimestamp(`Successfully updated prize info for pattern ${patternId}`, 'info');
      return true;
    } catch (error) {
      console.error('Error updating pattern prize info:', error);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [sessionId]);

  return {
    initializeSessionPattern,
    updatePatternPrizeInfo,
    isUpdating
  };
}
