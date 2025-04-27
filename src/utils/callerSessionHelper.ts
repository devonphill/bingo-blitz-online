
import { GameConfig, LegacyGameConfig, WinPatternConfig, GameType } from '@/types';

/**
 * Convert legacy session config format to new format with patterns property
 * This helps handle the transition from the old format with selectedPatterns and prizes to the new format with patterns
 */
export function convertFromLegacyConfig(config: any): GameConfig {
  if (!config) {
    return {
      gameNumber: 1,
      gameType: 'mainstage',
      patterns: {
        oneLine: {
          active: true,
          isNonCash: false,
          prizeAmount: '10.00',
          description: 'One Line Prize'
        }
      }
    };
  }

  // Check if this is already in the new format
  if (config.patterns && typeof config.patterns === 'object') {
    return config as GameConfig;
  }
  
  // Extract properties from the old format
  const { gameNumber = 1, gameType = 'mainstage', selectedPatterns = [], prizes = {} } = config;
  
  // Create patterns object for new format
  const patterns: Record<string, WinPatternConfig> = {};
  
  // Convert selectedPatterns array to patterns object with active flag
  if (Array.isArray(selectedPatterns)) {
    selectedPatterns.forEach(patternId => {
      const prize = prizes[patternId] || {};
      patterns[patternId] = {
        active: true,
        isNonCash: prize.isNonCash || false,
        prizeAmount: prize.amount || '10.00',
        description: prize.description || `${patternId} Prize`
      };
    });
  }
  
  return {
    gameNumber,
    gameType,
    patterns
  };
}

/**
 * Check if the current game state needs to be handled for upcoming bingo claim in CallerSession
 */
export function handleBingoClaims(currentSession: any, pendingClaims: any[]): boolean {
  if (!currentSession || !pendingClaims || pendingClaims.length === 0) {
    return false;
  }
  
  // Logic to determine if a claim needs to be handled
  return pendingClaims.length > 0;
}
