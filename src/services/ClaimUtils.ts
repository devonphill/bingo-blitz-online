
import { v4 as uuidv4 } from 'uuid';
import { ClaimData } from '@/types/claim';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Generate a unique claim ID
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Validate claim data to ensure all required fields are present
 */
export function validateClaimData(claim: any): boolean {
  if (!claim) return false;
  
  // Check for required fields
  const missingFields = [];
  
  if (!claim.sessionId) missingFields.push('sessionId');
  if (!claim.playerId) missingFields.push('playerId');
  
  // Check if ticket has the required fields
  const ticketMissingFields = [];
  if (!claim.ticket) {
    missingFields.push('ticket');
  } else {
    if (!claim.ticket.serial) ticketMissingFields.push('ticket.serial');
  }
  
  if (missingFields.length > 0) {
    logWithTimestamp(`Invalid claim data: Missing required fields: ${missingFields.join(', ')}`, 'error');
    return false;
  }
  
  if (ticketMissingFields.length > 0) {
    logWithTimestamp(`Invalid claim ticket data: Missing required fields: ${ticketMissingFields.join(', ')}`, 'error');
    return false;
  }
  
  return true;
}

/**
 * Format a claim for storage
 */
export function formatClaimForStorage(claim: ClaimData): ClaimData {
  return {
    ...claim,
    id: claim.id || generateUUID(),
    timestamp: claim.timestamp || new Date().toISOString()
  };
}

/**
 * Format a claim for broadcast
 */
export function formatClaimForBroadcast(claim: ClaimData): any {
  // Ensure we have an ID
  const claimId = claim.id || generateUUID();
  
  return {
    claimId,
    sessionId: claim.sessionId,
    playerId: claim.playerId, 
    playerName: claim.playerName || 'unknown',
    timestamp: claim.timestamp || new Date().toISOString(),
    gameType: claim.gameType || 'mainstage',
    winPattern: claim.winPattern || 'oneLine',
    status: claim.status || 'pending',
    ticket: claim.ticket ? {
      serial: claim.ticket.serial,
      perm: claim.ticket.perm || 0,
      position: claim.ticket.position || 0,
      layoutMask: claim.ticket.layoutMask || 0,
      numbers: claim.ticket.numbers || []
    } : undefined,
    calledNumbers: claim.calledNumbers || [],
    lastCalledNumber: claim.lastCalledNumber
  };
}
