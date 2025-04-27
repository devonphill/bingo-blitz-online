import { Json } from '@/types/json';

/**
 * Safely converts any value to JSON-compatible format for database storage
 */
export function toJsonSafe<T>(value: T): Json {
  // Handle undefined
  if (value === undefined) return null;
  
  // Handle null
  if (value === null) return null;
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => toJsonSafe(item));
  }
  
  // Handle objects
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, Json> = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = toJsonSafe((value as any)[key]);
      }
    }
    return result;
  }
  
  // Handle primitives
  if (
    typeof value === 'string' || 
    typeof value === 'number' || 
    typeof value === 'boolean'
  ) {
    return value;
  }
  
  // Default to string representation
  return String(value);
}

/**
 * Deep merges objects for JSON data
 */
export function deepMergeJson(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };
  
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      // If both values are objects, merge them
      if (
        typeof source[key] === 'object' && 
        source[key] !== null &&
        typeof result[key] === 'object' && 
        result[key] !== null
      ) {
        result[key] = deepMergeJson(result[key], source[key]);
      } else {
        // Otherwise, just replace the value
        result[key] = source[key];
      }
    }
  }
  
  return result;
}

/**
 * Creates a stringifiable version of a value that can be safely stored in database
 */
export function prepareForDatabase<T>(value: T): string {
  try {
    return JSON.stringify(toJsonSafe(value));
  } catch (err) {
    console.error('Error preparing value for database:', err);
    return JSON.stringify(null);
  }
}

/**
 * Parses JSON data from the database safely
 */
export function parseFromDatabase<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  
  try {
    return JSON.parse(value) as T;
  } catch (err) {
    console.error('Error parsing value from database:', err);
    return null;
  }
}
