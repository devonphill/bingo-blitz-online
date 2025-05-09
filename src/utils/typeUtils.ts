
/**
 * Type utility functions to safely handle type conversions and validations
 */

/**
 * Ensures a value is a string
 * @param value Any value that needs to be safely converted to string
 * @returns The value as a string
 */
export function ensureString(value: any): string {
  if (value === undefined || value === null) return '';
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

// Import logging utility
import { logWithTimestamp } from './logUtils';
