
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
  return prepareForDatabase(configs);
}

/**
 * Convert JSON data from database to GameConfig[] array
 * @param jsonData JSON data from database
 * @returns Parsed GameConfig array or empty array if invalid
 */
export function jsonToGameConfigs(jsonData: Json): GameConfig[] {
  if (!jsonData) return [];
  
  try {
    const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    if (!Array.isArray(parsed)) {
      return [];
    }
    
    return parsed.map((item: any) => ({
      gameNumber: item.gameNumber || 1,
      gameType: item.gameType || 'mainstage',
      patterns: item.patterns || {},
      session_id: item.session_id
    }));
  } catch (err) {
    console.error('Error parsing game configs:', err);
    return [];
  }
}
