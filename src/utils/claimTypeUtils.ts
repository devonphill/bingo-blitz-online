
/**
 * Utility functions for handling claim data type conversions and normalization
 */

/**
 * Normalizes a claim ID to string format
 * This is needed because the database stores IDs as numbers but we work with them as strings in UI
 */
export function normalizeClaimId(id: string | number): string {
  return typeof id === 'number' ? String(id) : id;
}

/**
 * Checks if two claim IDs are equal regardless of type (string vs number)
 */
export function claimIdsEqual(id1: string | number | undefined, id2: string | number | undefined): boolean {
  if (id1 === undefined || id2 === undefined) return false;
  return String(id1) === String(id2);
}

/**
 * Safely parses a claim ID to the appropriate type for database operations
 */
export function parseClaimIdForDb(id: string | number): number | string {
  // If the ID is a pure number in string form, convert to number for DB
  if (typeof id === 'string' && /^\d+$/.test(id)) {
    return parseInt(id, 10);
  }
  return id;
}
