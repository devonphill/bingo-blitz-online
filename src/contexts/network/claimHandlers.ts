
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { claimService } from '@/services/ClaimManagementService';
import { v4 as uuidv4 } from 'uuid';

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
  
  try {
    // First try fetching from database for most accurate data
    const { data: claims, error } = await supabase
      .from('claims')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'pending')
      .order('claimed_at', { ascending: true });
    
    if (error) {
      logWithTimestamp(`Error fetching claims from database: ${error.message}`, 'error');
      // Fallback to in-memory service
      return claimService.getClaimsForSession(sessionId);
    }
    
    logWithTimestamp(`NetworkContext: Found ${claims.length} claims in database`, 'debug');
    return claims;
  } catch (err) {
    logWithTimestamp(`Exception fetching claims: ${(err as Error).message}`, 'error');
    // Fallback to in-memory service
    return claimService.getClaimsForSession(sessionId);
  }
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
      .then(({ data: player, error }) => {
        if (error) {
          logWithTimestamp(`Error finding player by code: ${error.message}`, 'error');
          return false;
        }
        
        if (!player) {
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
        
        // Now we need to fetch the current game state to get the win pattern and called numbers
        supabase
          .from('sessions_progress')
          .select('current_win_pattern, called_numbers')
          .eq('session_id', sessionId)
          .single()
          .then(({ data: gameState, error: gameStateError }) => {
            if (gameStateError) {
              logWithTimestamp(`Error fetching game state: ${gameStateError.message}`, 'error');
              return false;
            }
            
            // Generate a unique ID for this claim - use UUID string which matches the column type
            const claimId = uuidv4();
            
            // Insert complete claim data into the database - make sure types match the schema
            const claimDataForDB = {
              id: claimId, // UUID string
              session_id: sessionId,
              player_id: player.id,
              player_name: player.nickname || playerCode,
              player_code: playerCode,
              ticket_serial: ticket.serial,
              ticket_details: ticketData, // Store the full ticket object in JSONB column
              pattern_claimed: gameState?.current_win_pattern || 'fullhouse',
              called_numbers_snapshot: gameState?.called_numbers || [],
              status: 'pending',
              claimed_at: new Date().toISOString()
            };
            
            // Log the data that will be inserted into the claims table
            console.log('Final object being inserted into "claims" table:', JSON.stringify(claimDataForDB, null, 2));
            
            // Insert into claims table
            supabase
              .from('claims')
              .insert(claimDataForDB)
              .then(({ data: insertData, error: insertError }) => {
                if (insertError) {
                  logWithTimestamp(`Error inserting claim into database: ${insertError.message}`, 'error');
                  
                  // Even if DB insert fails, still use the claim service as fallback
                  claimService.submitClaim({
                    id: claimId,
                    playerId: player.id,
                    playerName: player.nickname || playerCode,
                    sessionId: sessionId,
                    ticket: ticketData, // FIXED: Pass full ticket data, not a placeholder
                    gameType: 'mainstage', // Default, can be updated if we have more info
                    calledNumbers: gameState?.called_numbers || [],
                    lastCalledNumber: gameState?.called_numbers ? 
                      gameState.called_numbers[gameState.called_numbers.length - 1] : null,
                    winPattern: gameState?.current_win_pattern || 'fullhouse'
                  });
                  
                  return;
                }
                
                logWithTimestamp(`Successfully inserted claim into database with ID ${claimId}`, 'info');
                
                // Create a detailed broadcast payload for WebSocket
                const detailedClaimDataForBroadcast = {
                  id: claimId,
                  playerId: player.id,
                  playerName: player.nickname || playerCode,
                  sessionId: sessionId,
                  ticket: ticketData, // FIXED: Pass full ticket data, not a placeholder
                  gameType: 'mainstage',
                  calledNumbers: gameState?.called_numbers || [],
                  lastCalledNumber: gameState?.called_numbers ? 
                    gameState.called_numbers[gameState.called_numbers.length - 1] : null,
                  winPattern: gameState?.current_win_pattern || 'fullhouse',
                  status: 'pending',
                  timestamp: new Date().toISOString()
                };
                
                // Log the WebSocket broadcast payload
                console.log('Final object being broadcast for claim:', JSON.stringify(detailedClaimDataForBroadcast, null, 2));
                
                // Use claim service for memory storage and WebSocket broadcasting
                claimService.submitClaim(detailedClaimDataForBroadcast);
              });
          });
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
    // Update the claim status in the database
    const { error } = await supabase
      .from('claims')
      .update({
        status: isValid ? 'valid' : 'rejected',
        verified_at: new Date().toISOString()
      })
      .eq('id', claim.id);
    
    if (error) {
      logWithTimestamp(`Error updating claim in database: ${error.message}`, 'error');
    } else {
      logWithTimestamp(`Updated claim ${claim.id} in database to ${isValid ? 'valid' : 'rejected'}`, 'info');
    }
    
    // Use claim service to process claim (broadcasts result, etc.)
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
