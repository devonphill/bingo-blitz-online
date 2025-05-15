
/**
 * Utility functions for handling claim data type conversions and normalization
 */

/**
 * Normalizes a claim ID to string format
 * This is needed because we work with UUIDs as strings in the UI
 */
export function normalizeClaimId(id: string | number): string {
  return String(id);
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
 * Claims now use UUID strings, not numbers
 */
export function parseClaimIdForDb(id: string | number): string {
  return String(id);
}
