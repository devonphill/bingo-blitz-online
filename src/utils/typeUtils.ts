
/**
 * Type utility functions to safely handle type conversions and validations
 */

import { logWithTimestamp } from './logUtils';
import type { Json } from '@/types/json';

/**
 * Ensures a value is a string, handling various JSON types
 * @param value Any value that needs to be safely converted to string
 * @returns The value as a string
 */
export function ensureString(value: Json): string {
  if (value === undefined || value === null) return '';
  
  // Handle different types of values that might come from JSON
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  
  // Handle objects or arrays by stringifying them
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      logWithTimestamp(`Failed to stringify object: ${e}`, 'warn');
      return '';
    }
  }
  
  // Default fallback
  return String(value);
}

/**
 * Validate that a channel send type is one of the allowed types
 * @param type The type to validate
 * @returns A valid channel type
 */
export function validateChannelType(type: string): 'broadcast' | 'presence' | 'postgres_changes' {
  const validTypes: ('broadcast' | 'presence' | 'postgres_changes')[] = ['broadcast', 'presence', 'postgres_changes'];
  
  if (validTypes.includes(type as any)) {
    return type as 'broadcast' | 'presence' | 'postgres_changes';
  }
  
  logWithTimestamp(`Invalid channel type "${type}" provided, defaulting to "broadcast"`, 'warn');
  return 'broadcast';
}
