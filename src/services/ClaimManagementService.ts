
import { logWithTimestamp } from '@/utils/logUtils';
import { claimStorageService } from './ClaimStorageService';
import { claimBroadcastService } from './ClaimBroadcastService';
import { generateUUID, validateClaimData } from './ClaimUtils';
import { ClaimData } from '@/types/claim';
import { supabase } from '@/integrations/supabase/client';

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

      // Generate a unique ID for this claim if not provided
      const claimId = claimData.id || generateUUID();

      // Create the full claim object
      const claim: ClaimData = {
        id: claimId,
        timestamp: new Date().toISOString(),
        ...claimData,
        status: 'pending'
      };

      // Log the claim for debugging
      logWithTimestamp(`Submitting claim: ${JSON.stringify({
        id: claim.id,
        playerId: claim.playerId,
        playerName: claim.playerName,
        sessionId: claim.sessionId,
        ticket: claim.ticket ? {
          serial: claim.ticket.serial,
          perm: claim.ticket.perm,
          hasNumbers: !!claim.ticket.numbers
        } : 'missing',
        winPattern: claim.winPattern
      })}`, 'info');

      // Add to storage - this should store it in memory for caller retrieval
      const added = claimStorageService.storeClaim(claim);
      if (!added) {
        logWithTimestamp(`Failed to add claim ${claim.id} to storage`, 'error');
        return false;
      }

      logWithTimestamp(`Successfully stored claim ${claim.id} locally`, 'info');

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

      logWithTimestamp(`Looking for claim ${claimId} in session ${sessionId}`, 'info');

      // Find claim in storage service
      const claim = claimStorageService.removeClaim(sessionId, claimId);
      
      if (!claim) {
        logWithTimestamp(`Claim ${claimId} not found in session ${sessionId}, checking database`, 'info');
        
        // Try to find the claim in the database - using the updated schema where id is a UUID string
        const { data: dbClaim, error } = await supabase
          .from('claims')
          .select('*')
          .eq('id', claimId)
          .single();
        
        if (error || !dbClaim) {
          logWithTimestamp(`Claim ${claimId} not found in database either: ${error?.message || 'No claim found'}`, 'error');
          return false;
        }
        
        logWithTimestamp(`Found claim ${claimId} in database`, 'info');
        
        // Update the claim status in the database - id is already a string in the new schema
        const { error: updateError } = await supabase
          .from('claims')
          .update({
            status: isValid ? 'valid' : 'rejected',
            verified_at: new Date().toISOString()
          })
          .eq('id', dbClaim.id);
        
        if (updateError) {
          logWithTimestamp(`Error updating claim in database: ${updateError.message}`, 'error');
          return false;
        }
        
        // Broadcast result to the player
        await claimBroadcastService.broadcastClaimResult({
          sessionId,
          playerId: dbClaim.player_id,
          playerName: dbClaim.player_name || 'Player',
          result: isValid ? 'valid' : 'rejected',
          timestamp: new Date().toISOString(),
          ticket: dbClaim.ticket_details
        });
        
        // If valid and there's a progression callback, trigger it
        if (isValid && onGameProgress) {
          logWithTimestamp('Triggering game progression callback', 'info');
          onGameProgress();
        }
        
        return true;
      }
      
      logWithTimestamp(`Found and removed claim ${claimId} from storage`, 'info');
      
      // Broadcast result to the player
      await claimBroadcastService.broadcastClaimResult({
        sessionId,
        playerId: claim.playerId,
        playerName: claim.playerName || 'Player',
        result: isValid ? 'valid' : 'rejected',
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
    const claims = claimStorageService.getClaimsForSession(sessionId);
    logWithTimestamp(`Retrieved ${claims.length} claims for session ${sessionId} from storage service`, 'info');
    return claims;
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
