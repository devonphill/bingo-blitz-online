import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

/**
 * Utility functions for handling player claims
 */

/**
 * Checks if a string is likely to be a player code rather than UUID
 */
export const isPlayerCode = (id: string): boolean => {
  return id.length < 30 && /[A-Za-z]/.test(id);
};

/**
 * Resolves a player ID (either UUID or player code) to the actual UUID and player name
 */
export const resolvePlayerId = async (
  playerId: string
): Promise<{ actualPlayerId: string; playerName: string | null; error?: string }> => {
  // If it's already a UUID, no need to resolve
  if (!isPlayerCode(playerId)) {
    return { actualPlayerId: playerId, playerName: null };
  }

  try {
    // Try to find the player by code
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('id, nickname')
      .eq('player_code', playerId)
      .single();

    if (playerError) {
      logWithTimestamp(`Error finding player by code: ${playerError}`, 'error');
      return { 
        actualPlayerId: playerId, 
        playerName: null, 
        error: `Failed to resolve player code: ${playerError.message}` 
      };
    }

    if (!playerData) {
      logWithTimestamp(`No player found with code ${playerId}`, 'warn');
      return { actualPlayerId: playerId, playerName: null };
    }

    logWithTimestamp(`Found player by code: ${playerData.id} (${playerData.nickname || 'unnamed'})`, 'info');
    return { 
      actualPlayerId: playerData.id, 
      playerName: playerData.nickname 
    };
  } catch (err) {
    logWithTimestamp(`Error resolving player ID: ${(err as Error).message}`, 'error');
    return { 
      actualPlayerId: playerId, 
      playerName: null, 
      error: `Exception resolving player: ${(err as Error).message}` 
    };
  }
};

/**
 * Updates an existing claim or creates a new one in the database
 */
export const upsertClaimInDatabase = async (
  sessionId: string,
  playerId: string,
  playerName: string,
  winPattern: string,
  calledNumbers: number[],
  lastCalledNumber: number | null,
  ticketData: any,
  gameNumber: number = 1,
  gameType: string = 'mainstage',
  isValid: boolean = true
): Promise<boolean> => {
  try {
    // First check if the claim already exists
    const { data: existingClaims, error: fetchError } = await supabase
      .from('universal_game_logs')
      .select('id')
      .eq('session_id', sessionId)
      .eq('player_id', playerId)
      .is('validated_at', null);

    if (fetchError) {
      logWithTimestamp(`Error fetching existing claims: ${fetchError}`, 'error');
    }

    // If we found an existing claim, update it
    if (existingClaims && existingClaims.length > 0) {
      const { error: updateError } = await supabase
        .from('universal_game_logs')
        .update({
          validated_at: new Date().toISOString(),
          prize_shared: isValid
        })
        .eq('id', existingClaims[0].id);

      if (updateError) {
        logWithTimestamp(`Error updating claim: ${updateError}`, 'error');
        return false;
      }
    } else {
      // Otherwise create a new validated entry
      const { error: insertError } = await supabase
        .from('universal_game_logs')
        .insert({
          session_id: sessionId,
          player_id: playerId,
          player_name: playerName,
          game_number: gameNumber,
          game_type: gameType,
          win_pattern: winPattern,
          ticket_serial: ticketData.serial,
          ticket_perm: ticketData.perm,
          ticket_position: ticketData.position,
          ticket_layout_mask: ticketData.layoutMask || ticketData.layout_mask,
          ticket_numbers: ticketData.numbers,
          called_numbers: calledNumbers,
          last_called_number: lastCalledNumber,
          total_calls: calledNumbers.length,
          claimed_at: new Date().toISOString(),
          validated_at: new Date().toISOString(),
          prize_shared: isValid
        });

      if (insertError) {
        logWithTimestamp(`Error inserting claim: ${insertError}`, 'error');
        return false;
      }
    }
    
    return true;
  } catch (err) {
    logWithTimestamp(`Exception in upsertClaimInDatabase: ${(err as Error).message}`, 'error');
    return false;
  }
};
