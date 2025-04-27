
import { GameConfig, LegacyGameConfig, WinPatternConfig } from "@/types";
import { Json } from "@/types/json";

/**
 * Safely converts any game config format to the current GameConfig format
 * Handles both the new format and legacy formats
 */
export function normalizeGameConfig(config: any): GameConfig {
  // If it's already in the correct format
  if (config && 'patterns' in config && typeof config.patterns === 'object') {
    const patterns: Record<string, WinPatternConfig> = {};
    
    // Ensure all pattern entries are properly formatted
    Object.entries(config.patterns).forEach(([patternId, patternConfig]: [string, any]) => {
      patterns[patternId] = {
        active: Boolean(patternConfig?.active),
        isNonCash: Boolean(patternConfig?.isNonCash),
        prizeAmount: String(patternConfig?.prizeAmount || '10.00'),
        description: String(patternConfig?.description || `${patternId} Prize`)
      };
    });
    
    return {
      gameNumber: Number(config.gameNumber),
      gameType: config.gameType,
      patterns
    };
  }
  
  // Convert legacy format
  if (config && 'selectedPatterns' in config && Array.isArray(config.selectedPatterns)) {
    const patterns: Record<string, WinPatternConfig> = {};
    
    // Add all active patterns
    if (Array.isArray(config.selectedPatterns)) {
      config.selectedPatterns.forEach((patternId: string) => {
        const prizeInfo = config.prizes?.[patternId];
        
        patterns[patternId] = {
          active: true,
          isNonCash: Boolean(prizeInfo?.isNonCash),
          prizeAmount: String(prizeInfo?.amount || '10.00'),
          description: String(prizeInfo?.description || `${patternId} Prize`)
        };
      });
    }
    
    // Add any inactive patterns that have prize info
    if (config.prizes && typeof config.prizes === 'object') {
      Object.entries(config.prizes).forEach(([patternId, prizeInfo]: [string, any]) => {
        if (!patterns[patternId]) {
          patterns[patternId] = {
            active: false,
            isNonCash: Boolean(prizeInfo?.isNonCash),
            prizeAmount: String(prizeInfo?.amount || '10.00'),
            description: String(prizeInfo?.description || `${patternId} Prize`)
          };
        }
      });
    }
    
    return {
      gameNumber: Number(config.gameNumber),
      gameType: config.gameType,
      patterns
    };
  }
  
  // If we couldn't parse it, return a default config
  return {
    gameNumber: 1,
    gameType: 'mainstage',
    patterns: {
      'oneLine': {
        active: true,
        isNonCash: false,
        prizeAmount: '10.00',
        description: 'One Line Prize'
      }
    }
  };
}

/**
 * Safely parses game configs from JSON data
 */
export function parseGameConfigs(json: Json | undefined | null): GameConfig[] {
  // Handle null or undefined
  if (!json) return [];
  
  // Handle array of configs
  if (Array.isArray(json)) {
    return json.map(item => normalizeGameConfig(item));
  }
  
  // Handle single config
  if (typeof json === 'object' && json !== null) {
    return [normalizeGameConfig(json)];
  }
  
  // Default empty array
  return [];
}

/**
 * Gets active patterns from a game config
 */
export function getActivePatterns(config: GameConfig): string[] {
  if (!config || !config.patterns) return [];
  
  return Object.entries(config.patterns)
    .filter(([_, patternConfig]) => patternConfig.active)
    .map(([patternId]) => patternId);
}

/**
 * Gets prizes in the PrizeDetails format from a game config
 */
export function getPrizeDetails(config: GameConfig): Record<string, { amount?: string; description?: string; isNonCash?: boolean }> {
  if (!config || !config.patterns) return {};
  
  const prizes: Record<string, { amount?: string; description?: string; isNonCash?: boolean }> = {};
  
  Object.entries(config.patterns).forEach(([patternId, patternConfig]) => {
    prizes[patternId] = {
      amount: patternConfig.prizeAmount,
      description: patternConfig.description,
      isNonCash: patternConfig.isNonCash
    };
  });
  
  return prizes;
}
