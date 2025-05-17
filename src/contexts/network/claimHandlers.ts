
import { logWithTimestamp } from '@/utils/logUtils';
import { getSingleSourceConnection } from '@/utils/NEWConnectionManager_SinglePointOfTruth';
import { EVENT_TYPES } from '@/constants/websocketConstants';

/**
 * Broadcasts a bingo claim to the appropriate channel
 * 
 * @param ticket The ticket being claimed
 * @param playerCode The player's unique code
 * @param gameSessionId The game session ID
 * @returns boolean indicating success
 */
export const performClaimBroadcast = (
  ticket: any,
  playerCode: string,
  gameSessionId: string
): boolean => {
  try {
    if (!ticket || !playerCode || !gameSessionId) {
      logWithTimestamp('Cannot broadcast claim: Missing required parameters', 'error');
      return false;
    }

    const ncmSpot = getSingleSourceConnection();
    if (!ncmSpot.isOverallConnected()) {
      logWithTimestamp('Cannot broadcast claim: Connection not available', 'error');
      return false;
    }

    const claimId = `claim_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create the payload
    const claimPayload = {
      claimId,
      playerCode,
      sessionId: gameSessionId,
      ticket: {
        ...ticket,
        // Make sure we have consistent naming
        serial: ticket.serial || ticket.id,
        layout_mask: ticket.layout_mask || ticket.layoutMask || 0
      },
      timestamp: new Date().toISOString()
    };

    logWithTimestamp(`Broadcasting claim for player ${playerCode} in session ${gameSessionId}`, 'info');

    // Use NCM_SPOT to send the message on the claim sender channel
    ncmSpot.sendMessage(
      'claim_sender',
      gameSessionId,
      EVENT_TYPES.CLAIM_SUBMITTED,
      claimPayload
    );

    return true;
  } catch (error) {
    logWithTimestamp(`Error broadcasting claim: ${error}`, 'error');
    return false;
  }
};
