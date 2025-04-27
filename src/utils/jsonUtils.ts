
import { Json } from '@/types/json';

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
