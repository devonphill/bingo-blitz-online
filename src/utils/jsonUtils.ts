
import { Json } from '@/types/json';
import { GameConfig } from '@/types';

/**
 * Prepares data for storage in the database by converting it to a JSON-compatible format
 * @param data Any data structure to be stored in the database
 * @returns A JSON-compatible representation of the data
 */
export function prepareForDatabase(data: any): Json {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Safely parses a JSON string or object into the specified type
 * @param jsonData The JSON string or object to parse
 * @returns The parsed data as the specified type, or null if parsing fails
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
 * Prepares an object to be safely stored as JSON in the database
 * @param data Any data structure to be stored in the database
 * @returns A JSON-compatible representation of the data
 */
export function toJsonSafe<T>(data: T): Json {
  if (!data) return null;
  
  try {
    // Perform a deep copy via JSON to ensure all data is serializable
    return JSON.parse(JSON.stringify(data));
  } catch (err) {
    console.error('Error converting to safe JSON:', err);
    return null;
  }
}

/**
 * Specifically prepares GameConfig[] for database storage, ensuring only necessary data is included
 * @param configs Array of GameConfig objects
 * @returns A JSON-compatible representation of the GameConfig array
 */
export function gameConfigsToJson(configs: GameConfig[]): Json {
  if (!configs || !Array.isArray(configs) || configs.length === 0) {
    console.warn("gameConfigsToJson: Empty or invalid configs array provided");
    return [];
  }
  
  try {
    // Create a clean version with only the required fields to avoid circular references
    const simplifiedConfigs = configs.map(config => {
      if (!config) {
        console.warn("gameConfigsToJson: Invalid config item in array");
        return null;
      }
      
      const patterns: Record<string, any> = {};
      
      // Only copy pattern properties we need in the database
      if (config.patterns) {
        Object.entries(config.patterns).forEach(([patternId, patternConfig]) => {
          patterns[patternId] = {
            active: !!patternConfig.active,
            isNonCash: !!patternConfig.isNonCash,
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
 * @param jsonData JSON data from database
 * @returns Parsed GameConfig array or empty array if invalid
 */
export function jsonToGameConfigs(jsonData: Json): GameConfig[] {
  if (!jsonData) {
    console.log("jsonToGameConfigs: No data provided, returning empty array");
    return [];
  }
  
  try {
    // Parse string if needed
    const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    // If the data is empty or not an array, return an empty array
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.log('jsonToGameConfigs: Data is empty or not an array, returning empty array');
      return [];
    }
    
    // Convert each item to a proper GameConfig
    const result = parsed.map((item: any) => {
      if (!item || typeof item !== 'object') {
        return {
          gameNumber: 1,
          gameType: 'mainstage',
          patterns: {},
          session_id: undefined
        };
      }
      
      // Ensure patterns is an object
      const patterns: Record<string, any> = {};
      
      if (item.patterns && typeof item.patterns === 'object') {
        Object.entries(item.patterns).forEach(([patternId, config]: [string, any]) => {
          patterns[patternId] = {
            // IMPORTANT: Never default to true! Only set to true if explicitly set to true in the database
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
