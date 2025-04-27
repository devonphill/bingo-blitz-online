
import { useState, useCallback } from 'react';
import { GameConfig, WinPatternConfig } from '@/types';
import { Json } from '@/types/json';

export function useGameProgression(gameConfigs: GameConfig[]) {
  const [currentPattern, setCurrentPattern] = useState<string | null>(null);
  const [currentGame, setCurrentGame] = useState<number>(1);

  // Get patterns for the current game
  const getPatternsForGame = useCallback((gameNumber: number): Record<string, WinPatternConfig> => {
    const config = gameConfigs.find(c => c.gameNumber === gameNumber);
    return config?.patterns || {};
  }, [gameConfigs]);

  // Get active patterns for the current game
  const getActivePatternsForGame = useCallback((gameNumber: number): string[] => {
    const patterns = getPatternsForGame(gameNumber);
    
    return Object.entries(patterns)
      .filter(([_, patternConfig]) => {
        // Safely check if the patternConfig exists and has an active property
        if (!patternConfig || typeof patternConfig !== 'object') return false;
        return patternConfig.active === true;
      })
      .map(([patternId, _]) => patternId);
  }, [getPatternsForGame]);

  // Get the default pattern for a game
  const getDefaultPatternForGame = useCallback((gameNumber: number): string | null => {
    const activePatterns = getActivePatternsForGame(gameNumber);
    return activePatterns.length > 0 ? activePatterns[0] : null;
  }, [getActivePatternsForGame]);

  // Progress to the next pattern
  const handleProgressToNextPattern = useCallback(() => {
    const activePatterns = getActivePatternsForGame(currentGame);
    const currentPatternIndex = currentPattern ? activePatterns.indexOf(currentPattern) : -1;

    if (currentPatternIndex === -1 || currentPatternIndex === activePatterns.length - 1) {
      // If no current pattern or already at the last pattern, do nothing
      return;
    }

    setCurrentPattern(activePatterns[currentPatternIndex + 1]);
  }, [currentGame, currentPattern, getActivePatternsForGame]);

  // Progress to the next game
  const handleProgressToNextGame = useCallback(() => {
    setCurrentGame(prevGame => prevGame + 1);
    setCurrentPattern(getDefaultPatternForGame(currentGame + 1)); // Set default pattern for the new game
  }, [currentGame, getDefaultPatternForGame]);

  return {
    currentPattern,
    currentGame,
    setCurrentPattern,
    setCurrentGame,
    getActivePatternsForGame,
    getDefaultPatternForGame,
    handleProgressToNextPattern,
    handleProgressToNextGame
  };
}
