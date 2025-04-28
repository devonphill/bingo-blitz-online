
import { Json } from '@/types/json';
import { GameConfig } from '@/types';

/**
 * Safely parses a JSON string or object with detailed error reporting
 */
export function parseJson<T>(jsonData: string | Json | null): T | null {
  if (jsonData === null || jsonData === undefined) {
    console.log('parseJson: Input data is null or undefined');
    return null;
  }
  
  try {
    if (typeof jsonData === 'string') {
      return JSON.parse(jsonData) as T;
    }
    return jsonData as T;
  } catch (err) {
    console.error('Error parsing JSON:', err, 'Raw input:', jsonData);
    return null;
  }
}

/**
 * Converts GameConfig[] array to a database-safe JSON format
 * Ensures patterns are ONLY active if explicitly set to true
 */
export function gameConfigsToJson(configs: GameConfig[]): Json {
  if (!configs || !Array.isArray(configs) || configs.length === 0) {
    console.warn("gameConfigsToJson: Empty or invalid configs array provided");
    return [];
  }
  
  try {
    console.log('Converting configs to JSON format:', configs);
    
    const simplifiedConfigs = configs.map(config => {
      if (!config) return null;
      
      const patterns: Record<string, any> = {};
      
      if (config.patterns) {
        Object.entries(config.patterns).forEach(([patternId, patternConfig]) => {
          // Only include pattern if it exists
          patterns[patternId] = {
            // Explicitly set active to false unless it's true
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
    
    // Validate before returning
    const jsonString = JSON.stringify(simplifiedConfigs);
    const parsed = JSON.parse(jsonString);
    console.log('Final JSON to save to database:', parsed);
    return parsed;
  } catch (err) {
    console.error("Error in gameConfigsToJson:", err);
    throw new Error(`Failed to convert game configs to JSON: ${(err as Error).message}`);
  }
}

/**
 * Convert JSON data from database to GameConfig[] array
 * Ensures patterns are ONLY active if explicitly true in DB
 */
export function jsonToGameConfigs(jsonData: Json): GameConfig[] {
  if (!jsonData) {
    console.log("jsonToGameConfigs: No data provided, returning empty array");
    return [];
  }
  
  try {
    // Debug the raw input from database
    console.log("jsonToGameConfigs raw input:", jsonData);
    
    const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.log('jsonToGameConfigs: Data is empty or not an array, returning empty array');
      return [];
    }
    
    const result = parsed.map((item: any) => {
      if (!item || typeof item !== 'object') {
        console.log('Invalid item in game configs JSON:', item);
        return {
          gameNumber: 1,
          gameType: 'mainstage',
          patterns: {},
          session_id: undefined
        };
      }
      
      // Debug each item being parsed
      console.log(`Processing game config for game ${item.gameNumber}:`, item);
      
      const patterns: Record<string, any> = {};
      
      if (item.patterns && typeof item.patterns === 'object') {
        Object.entries(item.patterns).forEach(([patternId, config]: [string, any]) => {
          // Debug each pattern
          console.log(`  Processing pattern ${patternId}:`, config);
          
          patterns[patternId] = {
            // CRITICAL: Only set active to true if explicitly true in DB
            active: config?.active === true,
            isNonCash: config?.isNonCash === true,
            prizeAmount: config?.prizeAmount || '10.00',
            description: config?.description || `${patternId} Prize`
          };
          
          // Verify the active status after processing
          console.log(`  Pattern ${patternId} active status:`, patterns[patternId].active);
        });
      } else {
        console.log('No patterns object found or invalid patterns object:', item.patterns);
      }
      
      return {
        gameNumber: typeof item.gameNumber === 'number' ? item.gameNumber : 1,
        gameType: item.gameType || 'mainstage',
        patterns: patterns,
        session_id: item.session_id
      };
    });
    
    console.log('Final game configs after parsing:', result);
    return result;
  } catch (err) {
    console.error('Error parsing game configs:', err);
    throw new Error(`Failed to parse game configs from database: ${(err as Error).message}`);
  }
}
