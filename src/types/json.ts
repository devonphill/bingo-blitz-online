
// Define JSON type for the database
import { GameConfig } from './index';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export function parseJson<T>(json: Json | undefined | null): T | null {
  if (!json) return null;
  
  try {
    if (typeof json === 'string') {
      return JSON.parse(json) as T;
    } else {
      return json as T;
    }
  } catch (err) {
    console.error('Error parsing JSON:', err);
    return null;
  }
}

export function prepareForDatabase(data: any): Json {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Safely convert Json to GameConfig[]
 * This handles different formats and ensures type safety
 */
export function parseGameConfigs(json: Json): GameConfig[] {
  if (!json || !Array.isArray(json)) {
    return [];
  }
  
  return json.map((item: any) => {
    // Ensure item is an object
    if (typeof item !== 'object' || item === null) {
      return {
        gameNumber: 1,
        gameType: 'mainstage',
        patterns: {},
        session_id: undefined
      };
    }
    
    // Create patterns object with proper type checking
    const patterns: Record<string, any> = {};
    
    if (item.patterns && typeof item.patterns === 'object') {
      Object.entries(item.patterns).forEach(([patternId, config]) => {
        const patternConfig = config as Record<string, any> || {};
        
        patterns[patternId] = {
          active: patternConfig.active === true,
          isNonCash: patternConfig.isNonCash === true,
          prizeAmount: patternConfig.prizeAmount || '0.00',
          description: patternConfig.description || ''
        };
      });
    }
    
    return {
      gameNumber: typeof item.gameNumber === 'number' ? item.gameNumber : 1,
      gameType: item.gameType || 'mainstage',
      patterns: patterns,
      session_id: item.session_id
    };
  });
}
