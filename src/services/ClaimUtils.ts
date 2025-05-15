
import { v4 as uuidv4 } from 'uuid';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Generate a unique UUID for claims
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Validate that the claim data has all required fields
 */
export function validateClaimData(claimData: any): boolean {
  if (!claimData) {
    logWithTimestamp('Claim data is null or undefined', 'error');
    return false;
  }

  // Required fields
  const requiredFields = [
    'sessionId',
    'playerId',
    'playerName',
    'ticket'
  ];

  for (const field of requiredFields) {
    if (!claimData[field]) {
      logWithTimestamp(`Claim data missing required field: ${field}`, 'error');
      return false;
    }
  }

  // Validate ticket data if it exists
  if (claimData.ticket) {
    // Make sure the ticket has a serial number (which is the minimum required field)
    if (!claimData.ticket.serial) {
      logWithTimestamp('Ticket missing required serial number', 'error');
      return false;
    }
  } else {
    logWithTimestamp('Ticket data is empty', 'error');
    return false;
  }

  return true;
}

/**
 * Format claim data for database insertion
 */
export function formatClaimForDatabase(claimData: any): any {
  if (!validateClaimData(claimData)) {
    logWithTimestamp('Cannot format invalid claim data for database', 'error');
    return null;
  }

  return {
    id: claimData.id || generateUUID(),
    session_id: claimData.sessionId,
    player_id: claimData.playerId,
    player_name: claimData.playerName,
    ticket_serial: claimData.ticket.serial,
    ticket_details: claimData.ticket,
    pattern_claimed: claimData.winPattern || 'fullhouse', // Default to fullhouse if not specified
    called_numbers_snapshot: claimData.calledNumbers || [],
    status: 'pending',
    claimed_at: new Date().toISOString()
  };
}

/**
 * Format database claim for websocket broadcast
 */
export function formatClaimForBroadcast(dbClaim: any): any {
  return {
    id: dbClaim.id,
    sessionId: dbClaim.session_id,
    playerId: dbClaim.player_id,
    playerName: dbClaim.player_name,
    ticket: dbClaim.ticket_details,
    winPattern: dbClaim.pattern_claimed,
    calledNumbers: dbClaim.called_numbers_snapshot,
    timestamp: dbClaim.claimed_at,
    status: dbClaim.status
  };
}
