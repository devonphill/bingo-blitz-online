
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { claimService } from '@/services/ClaimManagementService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Type for universal_game_logs insert to satisfy TypeScript
 */
interface GameLogEntry {
  validation_status: string;
  win_pattern: string;
  session_uuid: string;
  session_name: string;
  player_id: string;
  player_uuid?: string;
  player_name: string;
  game_type: string;
  game_number: number;
  called_numbers: number[];
  last_called_number: number | null;
  total_calls: number;
  claimed_at: string;
  ticket_serial: string[];
  ticket_perm: number[];
  ticket_layout_mask: number[];
  ticket_position: number[];
  ticket_numbers?: string;
  prize?: string | null;
  prize_amount?: string | null;
}

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
      .order('claimed_at', { ascending: true });
    
    if (error) {
      logWithTimestamp(`Error fetching claims from database: ${error.message}`, 'error');
      // Fallback to in-memory service
      return claimService.getClaimsForSession(sessionId);
    }
    
    logWithTimestamp(`NetworkContext: Found ${claims?.length || 0} claims in database`, 'debug');
    return claims || [];
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
export async function validateClaim(
  claim: any, 
  isValid: boolean, 
  sessionId: string | null,
  calledNumbers: number[] = [],
  lastCalledNumber: number | null = null,
  sessionName: string = 'Unknown Session'
): Promise<boolean> {
  if (!claim || !claim.id) {
    logWithTimestamp(`NetworkContext: Cannot validate claim: invalid claim data`, 'error');
    return false;
  }
  
  logWithTimestamp(`NetworkContext: Processing claim ${claim.id}, isValid=${isValid}`, 'info');
  
  try {
    // Prepare log entry for universal_game_logs
    const ticketDetails = claim.ticket || claim.ticket_details || {};
    const playerId = claim.playerId || claim.player_id;
    const playerName = claim.playerName || claim.player_name || 'Unknown Player';
    const playerCode = claim.playerCode || claim.player_code;
    
    // Create a properly typed log entry object
    const logEntry: GameLogEntry = {
      validation_status: isValid ? 'VALID' : 'INVALID',
      win_pattern: claim.winPattern || claim.pattern_claimed || '',
      session_uuid: sessionId || '',
      session_name: sessionName,
      player_id: playerCode, // Using player_code for the text field
      player_name: playerName,
      game_type: claim.gameType || 'mainstage',
      game_number: claim.gameNumber || 1,
      called_numbers: calledNumbers,
      last_called_number: lastCalledNumber,
      total_calls: calledNumbers?.length || 0,
      claimed_at: claim.claimed_at || claim.timestamp || new Date().toISOString(),
      
      // Ticket details wrapped in arrays for new schema
      ticket_serial: [ticketDetails.serial || claim.ticketSerial || ''], 
      ticket_perm: [ticketDetails.perm || 0],
      ticket_layout_mask: [ticketDetails.layoutMask || ticketDetails.layout_mask || 0],
      ticket_position: [ticketDetails.position || 0],
      
      // Add prize fields with defaults
      prize: claim.prize || null,
      prize_amount: claim.prizeAmount || null
    };
    
    // Add ticket_numbers as JSON string if it exists
    if (ticketDetails.numbers && Array.isArray(ticketDetails.numbers)) {
      logEntry.ticket_numbers = JSON.stringify(ticketDetails.numbers);
    }
    
    // Log the attempt
    console.log('[CallerAction] Attempting to insert into universal_game_logs:', logEntry);
    
    // Insert into universal_game_logs
    const { data: logData, error: logError } = await supabase
      .from('universal_game_logs')
      .insert(logEntry);
      
    if (logError) {
      console.error('[DB Log Error] Failed to insert into universal_game_logs:', logError, 'Payload:', logEntry);
      return false;
    }
    
    console.log('[DB Log Success] Logged to universal_game_logs:', logData);
    
    // Delete from claims queue
    console.log('[CallerAction] Attempting to delete from claims queue, ID:', claim.id);
    
    const { error: deleteError } = await supabase
      .from('claims')
      .delete()
      .match({ id: claim.id });
      
    if (deleteError) {
      console.error('[DB Delete Error] Failed to delete from claims table:', deleteError, 'ID:', claim.id);
      // Continue even if delete fails
    } else {
      console.log('[DB Delete Success] Claim deleted from claims queue:', claim.id);
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
