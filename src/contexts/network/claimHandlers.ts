
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { claimService } from '@/services/ClaimManagementService';

/**
 * Fetch pending claims for a session
 * 
 * @param sessionId The session ID to fetch claims for
 * @returns Array of claims
 */
export async function fetchClaimsForSession(sessionId: string | null): Promise<any[]> {
  if (!sessionId) {
    return [];
  }
  
  logWithTimestamp(`NetworkContext: Fetching claims for session ${sessionId}`, 'info');
  
  // Use claimService instead of direct database calls
  const claims = claimService.getClaimsForSession(sessionId);
  logWithTimestamp(`NetworkContext: Found ${claims.length} claims in service`, 'debug');
  return claims;
}

/**
 * Submit a bingo claim 
 * 
 * @param ticket Ticket data
 * @param playerCode Player code  
 * @param sessionId Session ID
 * @returns Whether the claim was submitted
 */
export function submitBingoClaim(ticket: any, playerCode: string, sessionId: string): boolean {
  try {
    logWithTimestamp(`NetworkContext: Submitting bingo claim for player ${playerCode} in session ${sessionId}`, 'info');
    
    // First, we need to fetch the actual player ID
    supabase
      .from('players')
      .select('id, nickname')
      .eq('player_code', playerCode)
      .eq('session_id', sessionId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          logWithTimestamp(`Error finding player by code: ${error.message}`, 'error');
          return false;
        }
        
        if (!data) {
          logWithTimestamp(`No player found with code ${playerCode}`, 'error');
          return false;
        }
        
        // Submit the claim using the claim service
        const result = claimService.submitClaim({
          playerId: data.id,
          playerName: data.nickname || playerCode,
          sessionId: sessionId,
          ticket: {
            serial: ticket.serial,
            perm: ticket.perm,
            position: ticket.position,
            layoutMask: ticket.layout_mask || ticket.layoutMask,
            numbers: ticket.numbers
          },
          gameType: 'mainstage', // Default, can be changed later
          calledNumbers: ticket.calledNumbers || [],
          lastCalledNumber: ticket.lastCalledNumber || null
        });
        
        return result;
      });
    
    return true; // Return true to indicate claim submission attempt started
  } catch (err) {
    logWithTimestamp(`Exception submitting bingo claim: ${(err as Error).message}`, 'error');
    return false;
  }
}

/**
 * Validate a claim (approve or reject)
 * 
 * @param claim Claim data
 * @param isValid Whether the claim is valid
 * @returns Whether the claim was processed successfully
 */
export async function validateClaim(claim: any, isValid: boolean, sessionId: string | null): Promise<boolean> {
  if (!claim || !claim.id) {
    logWithTimestamp(`NetworkContext: Cannot validate claim: invalid claim data`, 'error');
    return false;
  }
  
  logWithTimestamp(`NetworkContext: Processing claim ${claim.id}, isValid=${isValid}`, 'info');
  try {
    // Use claim service to process claim
    const result = await claimService.processClaim(claim.id, claim.sessionId || sessionId || '', isValid);
    
    if (result) {
      logWithTimestamp(`NetworkContext: Claim ${claim.id} processed successfully, isValid=${isValid}`, 'info');
    } else {
      logWithTimestamp(`NetworkContext: Failed to process claim ${claim.id}`, 'error');
    }
    
    return result;
  } catch (err) {
    logWithTimestamp(`NetworkContext: Exception validating claim: ${(err as Error).message}`, 'error');
    return false;
  }
}
