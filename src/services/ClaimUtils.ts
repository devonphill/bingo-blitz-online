
import { ClaimData } from '@/types/claim';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Generate a UUID for claim IDs
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0,
          v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validate that required claim data is present
 * @param data Partial claim data to validate
 */
export function validateClaimData(data: Partial<ClaimData>): boolean {
  // Required fields
  const required = ['playerId', 'sessionId'];
  
  for (const field of required) {
    if (!data[field as keyof ClaimData]) {
      logWithTimestamp(`Missing required field in claim: ${field}`, 'error');
      return false;
    }
  }
  
  // Check for required ticket information if provided
  if (data.ticket) {
    const requiredTicket = ['serial', 'numbers'];
    for (const field of requiredTicket) {
      if (!data.ticket[field]) {
        logWithTimestamp(`Missing required ticket field in claim: ${field}`, 'error');
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Create a standardized claim object from partial data
 */
export function createClaimObject(data: Partial<ClaimData>): ClaimData {
  // Create a default claim structure
  const defaultClaim: ClaimData = {
    id: generateUUID(),
    sessionId: data.sessionId || '',
    playerId: data.playerId || '',
    playerName: data.playerName || 'Unknown',
    timestamp: data.timestamp || Date.now(),
    gameType: data.gameType || 'mainstage',
    gameNumber: data.gameNumber || 1,
    status: data.status || 'pending',
    winPattern: data.winPattern || 'oneLine'
  };
  
  // Merge with provided data (this will override defaults)
  return {
    ...defaultClaim,
    ...data
  };
}
