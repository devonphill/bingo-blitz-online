
import { ClaimData } from '@/types/claim';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Generate a unique ID for a claim
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0,
        v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validate if claim data contains the minimal required fields
 */
export function validateClaimData(claimData: any): boolean {
  if (!claimData) {
    logWithTimestamp('ClaimUtils: Claim data is null or undefined', 'error');
    return false;
  }
  
  if (!claimData.sessionId) {
    logWithTimestamp('ClaimUtils: Missing sessionId in claim data', 'error');
    return false;
  }
  
  if (!claimData.playerId) {
    logWithTimestamp('ClaimUtils: Missing playerId in claim data', 'error');
    return false;
  }
  
  // Optional but helpful validation
  if (!claimData.ticket) {
    logWithTimestamp('ClaimUtils: Warning - Claim data has no ticket information', 'warn');
    // Don't fail validation for this, but log a warning
  }
  
  return true;
}

/**
 * Calculate if a ticket has won based on called numbers and win pattern
 */
export function calculateTicketWinStatus(
  ticket: any, 
  calledNumbers: number[], 
  winPattern: string = 'oneLine'
): {
  isWinner: boolean;
  toGoCount: number;
  hasLastCalledNumber?: boolean;
} {
  // Implementation would depend on specific bingo rules
  // This is a placeholder that just returns default values
  return {
    isWinner: false,
    toGoCount: 0,
    hasLastCalledNumber: false
  };
}

/**
 * Create a proper ClaimData object from partial data
 */
export function createClaimData(partialData: Partial<ClaimData>): ClaimData {
  const claimId = partialData.id || generateUUID();
  const timestamp = partialData.timestamp || new Date().toISOString();
  
  const claim: ClaimData = {
    id: claimId,
    timestamp,
    sessionId: partialData.sessionId || '',
    playerId: partialData.playerId || '',
    playerName: partialData.playerName,
    gameType: partialData.gameType || 'mainstage',
    winPattern: partialData.winPattern || 'oneLine',
    gameNumber: partialData.gameNumber || 1,
    toGoCount: partialData.toGoCount || 0,
    ticket: partialData.ticket,
    status: partialData.status || 'pending',
    lastCalledNumber: partialData.lastCalledNumber || null,
    calledNumbers: partialData.calledNumbers || [],
    hasLastCalledNumber: partialData.hasLastCalledNumber || false
  };
  
  return claim;
}
