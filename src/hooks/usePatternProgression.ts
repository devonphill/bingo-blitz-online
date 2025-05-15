
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logWithTimestamp } from '@/utils/logUtils';

// Utility function to check if a pattern is the final pattern
const isFinalPattern = (
  currentPattern: string | null,
  patterns: Array<{id: string}>,
): boolean => {
  if (!currentPattern || !patterns || !patterns.length) return false;
  // The last pattern in the array is considered the final pattern
  return currentPattern === patterns[patterns.length - 1]?.id;
};

/**
 * Hook for managing win pattern progression in a bingo game session
 */
export function usePatternProgression(sessionId: string | null) {
  const [patterns, setPatterns] = useState<any[]>([]);
  const [currentPattern, setCurrentPattern] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch all available patterns for the current game
  const getActivePatterns = useCallback(async (gameNumber?: number) => {
    if (!sessionId) return [];
    
    setIsLoading(true);
    
    try {
      // First get the session's game config
      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .select('games_config')
        .eq('id', sessionId)
        .single();
      
      if (sessionError || !session?.games_config) {
        throw new Error(`Failed to load game configuration: ${sessionError?.message}`);
      }
      
      // Parse the game config
      const gamesConfig = session.games_config;
      
      // Find the current game's patterns
      const currentGameNumber = gameNumber || 1;
      const currentGame = Array.isArray(gamesConfig) 
        ? gamesConfig.find((g: any) => g.gameNumber === currentGameNumber) 
        : null;
      
      if (!currentGame) {
        logWithTimestamp(`No configuration found for game ${currentGameNumber}`, 'warn');
        setPatterns([]);
        return [];
      }
      
      const gamePatterns = currentGame.patterns || [];
      setPatterns(gamePatterns);
      
      return gamePatterns;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logWithTimestamp(`Error fetching active patterns: ${errorMessage}`, 'error');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Find the next win pattern in the sequence
  const findNextWinPattern = useCallback(async (
    currentPattern: string | null,
    gameNumber?: number
  ) => {
    // Get all patterns for the current game
    const allPatterns = await getActivePatterns(gameNumber);
    
    if (!allPatterns || allPatterns.length === 0) {
      return null;
    }
    
    // If no current pattern, return the first one
    if (!currentPattern) {
      return allPatterns[0];
    }
    
    // Find the current pattern index
    const currentIndex = allPatterns.findIndex((p: any) => p.id === currentPattern);
    
    // If not found or already at the last pattern, return null
    if (currentIndex === -1 || currentIndex === allPatterns.length - 1) {
      return null;
    }
    
    // Return the next pattern
    return allPatterns[currentIndex + 1];
  }, [getActivePatterns]);

  // Check if the current pattern is the final one for the game
  const isLastPattern = useCallback(async (
    currentPattern: string | null,
    gameNumber?: number
  ) => {
    if (!currentPattern) return false;
    
    const allPatterns = await getActivePatterns(gameNumber);
    
    if (!allPatterns || allPatterns.length === 0) {
      return true; // No patterns, consider it last
    }
    
    return isFinalPattern(currentPattern, allPatterns);
  }, [getActivePatterns]);

  // Progress to the next win pattern
  const progressToNextPattern = useCallback(async (
    nextPattern: any,
    sessionId: string
  ) => {
    if (!nextPattern || !nextPattern.id) {
      logWithTimestamp('Cannot progress: Invalid next pattern', 'error');
      return false;
    }
    
    try {
      logWithTimestamp(`Progressing to next pattern: ${nextPattern.id}`, 'info');
      
      // Update the current win pattern in the sessions_progress table
      const { error } = await supabase
        .from('sessions_progress')
        .update({ 
          current_win_pattern: nextPattern.id,
          current_prize: nextPattern.prize || null,
          current_prize_description: nextPattern.description || null,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      
      // Update local state
      setCurrentPattern(nextPattern.id);
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logWithTimestamp(`Error progressing to next pattern: ${errorMessage}`, 'error');
      
      toast({
        title: "Pattern Progress Error",
        description: errorMessage,
        variant: "destructive"
      });
      
      return false;
    }
  }, [toast]);

  // Progress to the next game in the session
  const progressToNextGame = useCallback(async (
    currentGameNumber: number
  ) => {
    if (!sessionId) return false;
    
    try {
      logWithTimestamp(`Progressing to next game from game ${currentGameNumber}`, 'info');
      
      // Get the max game number from session
      const { data: progressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('max_game_number')
        .eq('session_id', sessionId)
        .single();
      
      if (progressError) {
        throw new Error(`Could not fetch session progress: ${progressError.message}`);
      }
      
      const maxGameNumber = progressData?.max_game_number || 1;
      
      // Check if we're already at the last game
      if (currentGameNumber >= maxGameNumber) {
        logWithTimestamp('Already at the last game in the session', 'info');
        return false;
      }
      
      // Increment the current game number
      const nextGameNumber = currentGameNumber + 1;
      
      // Update the session progress
      const { error: updateError } = await supabase
        .from('sessions_progress')
        .update({ 
          current_game_number: nextGameNumber,
          called_numbers: [], // Reset called numbers for the new game
          current_win_pattern: null, // Will be set when game starts
          current_prize: null,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);
      
      if (updateError) {
        throw new Error(`Failed to update game progress: ${updateError.message}`);
      }
      
      // Reset local pattern state for the new game
      setPatterns([]);
      setCurrentPattern(null);
      
      // Show notification about successful progression
      toast({
        title: "Game Progressed",
        description: `Advanced to game ${nextGameNumber}`,
        duration: 3000,
      });
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logWithTimestamp(`Error progressing to next game: ${errorMessage}`, 'error');
      
      toast({
        title: "Game Progress Error",
        description: errorMessage,
        variant: "destructive"
      });
      
      return false;
    }
  }, [sessionId, toast]);
  
  // Initial load of patterns when sessionId changes
  useEffect(() => {
    if (sessionId) {
      getActivePatterns();
    }
  }, [sessionId, getActivePatterns]);
  
  return {
    patterns,
    currentPattern,
    isLoading,
    getActivePatterns,
    findNextWinPattern,
    isLastPattern,
    progressToNextPattern,
    progressToNextGame
  };
}
