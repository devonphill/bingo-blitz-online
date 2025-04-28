
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
  return JSON.parse(JSON.stringify(data));
}

/**
 * Specifically prepares GameConfig[] for database storage by ensuring it's in a JSON-safe format
 * @param configs Array of GameConfig objects
 * @returns A JSON-compatible representation of the GameConfig array
 */
export function gameConfigsToJson(configs: GameConfig[]): Json {
  if (!configs || !Array.isArray(configs) || configs.length === 0) {
    console.warn("gameConfigsToJson: Empty or invalid configs array provided");
    return [];
  }
  
  try {
    console.log("Converting game configs to JSON:", configs);
    // Make a deep copy to ensure we don't modify the original object
    const safeCopy = configs.map(config => {
      if (!config) {
        console.warn("gameConfigsToJson: Invalid config item in array");
        return null;
      }
      
      const { gameNumber, gameType, patterns, session_id } = config;
      
      // Ensure patterns are properly formatted with order information
      const processedPatterns: Record<string, any> = {};
      let orderCounter = 1;
      
      if (!patterns) {
        console.warn("gameConfigsToJson: No patterns found in config");
        return { gameNumber, gameType, patterns: {}, session_id };
      }
      
      // First pass: add active patterns in order
      Object.entries(patterns).forEach(([patternId, patternConfig]) => {
        if (patternConfig && patternConfig.active) {
          processedPatterns[patternId] = {
            ...patternConfig,
            orderOfPlay: orderCounter++
          };
        }
      });
      
      // Second pass: add inactive patterns with null order
      Object.entries(patterns).forEach(([patternId, patternConfig]) => {
        if (patternConfig && !patternConfig.active) {
          processedPatterns[patternId] = {
            ...patternConfig,
            orderOfPlay: null
          };
        }
      });
      
      return {
        gameNumber,
        gameType,
        patterns: processedPatterns,
        session_id
      };
    }).filter(item => item !== null); // Filter out any null items
    
    console.log('Processed game configs for JSON storage:', safeCopy);
    return JSON.parse(JSON.stringify(safeCopy));
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
    const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    // If the data is empty or not an array, return an empty array
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.log('jsonToGameConfigs: Data is empty or not an array, returning empty array');
      return [];
    }
    
    // Type check and sanitize each game config
    return parsed.filter(item => item && typeof item === 'object').map((item: any) => {
      // Ensure patterns is an object
      const patterns = typeof item.patterns === 'object' && item.patterns !== null 
        ? item.patterns 
        : {};
      
      return {
        gameNumber: typeof item.gameNumber === 'number' ? item.gameNumber : 1,
        gameType: item.gameType || 'mainstage',
        patterns,
        session_id: item.session_id
      };
    });
  } catch (err) {
    console.error('Error parsing game configs:', err);
    return [];
  }
}
