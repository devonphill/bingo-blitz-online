
import { Json } from '@/types/json';
import { GameConfig } from '@/types';

/**
 * Safely parses a JSON string or object
 */
export function parseJson<T>(jsonData: string | Json | null): T | null {
  if (jsonData === null || jsonData === undefined) {
    return null;
  }
  
  try {
    if (typeof jsonData === 'string') {
      return JSON.parse(jsonData) as T;
    }
    return jsonData as T;
  } catch (err) {
    console.error('Error parsing JSON:', err);
    return null;
  }
}

/**
 * Converts GameConfig[] array to a database-safe JSON format
 * CRITICAL: Ensures patterns are only active if explicitly set to true
 */
export function gameConfigsToJson(configs: GameConfig[]): Json {
  if (!configs || !Array.isArray(configs) || configs.length === 0) {
    console.warn("gameConfigsToJson: Empty or invalid configs array provided");
    return [];
  }
  
  try {
    const simplifiedConfigs = configs.map(config => {
      if (!config) return null;
      
      const patterns: Record<string, any> = {};
      
      if (config.patterns) {
        Object.entries(config.patterns).forEach(([patternId, patternConfig]) => {
          patterns[patternId] = {
            // Only set active to true if explicitly true in source
            active: patternConfig.active === true,
            isNonCash: patternConfig.isNonCash === true,
            prizeAmount: patternConfig.prizeAmount || '10.00',
            description: patternConfig.description || ''
          };
        });
      }
      
      return {
        gameNumber: config.gameNumber || 1,
        gameType: config.gameType || 'mainstage',
        patterns,
        session_id: config.session_id
      };
    }).filter(item => item !== null);
    
    return JSON.parse(JSON.stringify(simplifiedConfigs));
  } catch (err) {
    console.error("Error in gameConfigsToJson:", err);
    return [];
  }
}

/**
 * Convert JSON data from database to GameConfig[] array
 * CRITICAL: Ensures patterns are only active if explicitly true in DB
 */
export function jsonToGameConfigs(jsonData: Json): GameConfig[] {
  if (!jsonData) {
    console.log("jsonToGameConfigs: No data provided, returning empty array");
    return [];
  }
  
  try {
    const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.log('jsonToGameConfigs: Data is empty or not an array, returning empty array');
      return [];
    }
    
    const result = parsed.map((item: any) => {
      if (!item || typeof item !== 'object') {
        return {
          gameNumber: 1,
          gameType: 'mainstage',
          patterns: {},
          session_id: undefined
        };
      }
      
      const patterns: Record<string, any> = {};
      
      if (item.patterns && typeof item.patterns === 'object') {
        Object.entries(item.patterns).forEach(([patternId, config]: [string, any]) => {
          patterns[patternId] = {
            // CRITICAL: Only set active to true if explicitly true in DB
            active: config?.active === true,
            isNonCash: config?.isNonCash === true,
            prizeAmount: config?.prizeAmount || '10.00',
            description: config?.description || `${patternId} Prize`
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
    
    return result;
  } catch (err) {
    console.error('Error parsing game configs:', err);
    return [];
  }
}
