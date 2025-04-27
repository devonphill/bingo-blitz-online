
import { GameConfig, LegacyGameConfig, isLegacyGameConfig, convertLegacyGameConfig, WinPatternConfig, GameType } from '@/types';
import { DEFAULT_PATTERN_ORDER } from '@/types';

/**
 * Normalizes a game config object, handling both new and legacy formats
 */
export function normalizeGameConfig(config: any): GameConfig {
  // Handle null or undefined
  if (!config) {
    return createDefaultGameConfig(1);
  }
  
  // If it's a legacy config, convert it
  if (isLegacyGameConfig(config)) {
    return convertLegacyGameConfig(config as LegacyGameConfig);
  }
  
  // It's already in the new format or partial
  const gameNumber = config.gameNumber || 1;
  const gameType = config.gameType || 'mainstage';
  
  // If patterns property doesn't exist, we need to build it
  if (!config.patterns) {
    const patterns: Record<string, WinPatternConfig> = {};
    
    // If config has selectedPatterns, use them to populate patterns
    if (config.selectedPatterns && Array.isArray(config.selectedPatterns)) {
      config.selectedPatterns.forEach(patternId => {
        const prize = config.prizes?.[patternId] || {};
        patterns[patternId] = {
          active: true,
          isNonCash: prize.isNonCash || false,
          prizeAmount: prize.amount || '10.00',
          description: prize.description || `${patternId} Prize`
        };
      });
    } else {
      // If no selectedPatterns, create default patterns based on game type
      const defaultPatterns = DEFAULT_PATTERN_ORDER[gameType as GameType] || ['oneLine', 'twoLines', 'fullHouse'];
      defaultPatterns.forEach(patternId => {
        patterns[patternId] = {
          active: patternId === 'oneLine', // Only activate first pattern by default
          isNonCash: false,
          prizeAmount: '10.00',
          description: `${patternId} Prize`
        };
      });
    }
    
    return {
      gameNumber,
      gameType: gameType as GameType,
      patterns: patterns,
      session_id: config.session_id
    };
  }
  
  // Return the config with proper typing
  return {
    gameNumber: gameNumber,
    gameType: gameType as GameType,
    patterns: config.patterns,
    session_id: config.session_id
  };
}

/**
 * Creates a default game configuration
 */
export function createDefaultGameConfig(gameNumber: number, gameType: GameType = 'mainstage'): GameConfig {
  const patterns: Record<string, WinPatternConfig> = {};
  
  const defaultPatterns = DEFAULT_PATTERN_ORDER[gameType] || ['oneLine', 'twoLines', 'fullHouse'];
  defaultPatterns.forEach(patternId => {
    patterns[patternId] = {
      active: patternId === 'oneLine', // Only activate first pattern by default
      isNonCash: false,
      prizeAmount: '10.00',
      description: `${patternId} Prize`
    };
  });
  
  return {
    gameNumber,
    gameType,
    patterns
  };
}
