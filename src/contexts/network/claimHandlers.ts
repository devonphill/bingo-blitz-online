
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
    // Enhanced DEBUG: Log the incoming ticket data with deeply nested properties
    console.log('CLAIM DEBUG - Full ticket data received:', JSON.stringify(ticket, null, 2));
    console.log('CLAIM DEBUG - Required fields validation:', {
      hasId: !!ticket?.id,
      hasSerial: !!ticket?.serial,
      hasPerm: !!ticket?.perm,
      hasPosition: !!ticket?.position,
      hasLayoutMask: !!(ticket?.layout_mask || ticket?.layoutMask),
      hasNumbers: !!(ticket?.numbers && Array.isArray(ticket?.numbers))
    });
    
    logWithTimestamp(`NetworkContext: Submitting bingo claim for player ${playerCode} in session ${sessionId}`, 'info');
    
    if (!ticket) {
      logWithTimestamp(`Cannot submit claim: No ticket data provided`, 'error');
      return false;
    }
    
    // Ensure serial exists - this is the required field mentioned in the error
    if (!ticket.serial) {
      logWithTimestamp(`Missing required ticket field in claim: serial`, 'error');
      return false;
    }
    
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
        
        // Standardize ticket field names to ensure consistency
        const ticketData = {
          serial: ticket.serial,
          perm: ticket.perm || 0,
          position: ticket.position || 0,
          layoutMask: ticket.layout_mask || ticket.layoutMask || 0,
          numbers: ticket.numbers || []
        };
        
        console.log('CLAIM DEBUG - Normalized ticket data for submission:', ticketData);
        
        // Submit the claim using the claim service
        const result = claimService.submitClaim({
          playerId: data.id,
          playerName: data.nickname || playerCode,
          sessionId: sessionId,
          ticket: ticketData,
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
