
import { logWithTimestamp } from '@/utils/logUtils';
import { claimStorageService } from './ClaimStorageService';
import { claimBroadcastService } from './ClaimBroadcastService';
import { generateUUID, validateClaimData } from './ClaimUtils';
import { ClaimData } from '@/types/claim';

/**
 * Service for managing bingo claim events and lifecycle.
 * This acts as a global system for tracking claims before they are recorded in the database.
 */
class ClaimManagementService {
  /**
   * Submit a new bingo claim for verification
   */
  submitClaim(claimData: any): boolean {
    if (!validateClaimData(claimData)) {
      logWithTimestamp('Cannot submit claim: Missing required data', 'error');
      return false;
    }

    try {
      const sessionId = claimData.sessionId;
      logWithTimestamp(`Submitting claim for session ${sessionId}`);

      // Generate a unique ID for this claim
      const claimId = generateUUID();

      // Create the full claim object
      const claim: ClaimData = {
        id: claimId,
        timestamp: new Date().toISOString(),
        ...claimData,
        status: 'pending'
      };

      // Add to storage
      const added = claimStorageService.storeClaim(claim);
      if (!added) {
        return false;
      }

      // Broadcast this claim to listeners (callers and other players)
      claimBroadcastService.broadcastClaimEvent(claim);

      return true;
    } catch (error) {
      console.error('Error submitting claim:', error);
      return false;
    }
  }

  /**
   * Process a claim validation result
   * @param claimId The ID of the claim to process
   * @param sessionId The session ID for context
   * @param isValid Whether the claim is valid or not
   * @param onGameProgress Optional callback for game progression after validation
   * @returns {Promise<boolean>} Success status
   */
  async processClaim(
    claimId: string,
    sessionId: string,
    isValid: boolean,
    onGameProgress?: () => void
  ): Promise<boolean> {
    try {
      if (!claimId || !sessionId) {
        logWithTimestamp('Cannot process claim: Missing claim ID or session ID', 'error');
        return false;
      }

      // Find and remove the claim
      const claim = claimStorageService.removeClaim(sessionId, claimId);
      
      if (!claim) {
        logWithTimestamp(`Claim ${claimId} not found in session ${sessionId}`, 'error');
        return false;
      }
      
      // Broadcast result to the player
      await claimBroadcastService.broadcastClaimResult({
        sessionId,
        playerId: claim.playerId,
        playerName: claim.playerName || 'Player',
        result: isValid ? 'valid' : 'invalid',
        timestamp: new Date().toISOString(),
        ticket: claim.ticket
      });
      
      // If valid and there's a progression callback, trigger it
      if (isValid && onGameProgress) {
        logWithTimestamp('Triggering game progression callback', 'info');
        onGameProgress();
      }
      
      return true;
    } catch (error) {
      console.error('Error processing claim:', error);
      return false;
    }
  }

  /**
   * Get all pending claims for a specific session
   */
  getClaimsForSession(sessionId: string): ClaimData[] {
    return claimStorageService.getClaimsForSession(sessionId);
  }

  /**
   * Clear all claims for a session (e.g., when game ends)
   */
  clearClaimsForSession(sessionId: string): void {
    claimStorageService.clearClaimsForSession(sessionId);
  }
}

// Export a singleton instance
export const claimService = new ClaimManagementService();
