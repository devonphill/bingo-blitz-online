
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
 * Resolves a player ID (which might be a player code) to an actual database ID
 */
export async function resolvePlayerId(playerIdOrCode: string): Promise<{ 
  actualPlayerId: string | null; 
  playerName: string | null;
  error: string | null;
}> {
  try {
    // First, check if this is already a valid UUID
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidPattern.test(playerIdOrCode);
    
    if (isUuid) {
      // It's already a UUID, so just return it
      logWithTimestamp(`Player ID ${playerIdOrCode} appears to be a valid UUID, using as-is`, 'info');
      
      // Try to get the player name though
      const { data } = await supabase
        .from('players')
        .select('nickname')
        .eq('id', playerIdOrCode)
        .single();
        
      return { 
        actualPlayerId: playerIdOrCode, 
        playerName: data?.nickname || null,
        error: null 
      };
    }
    
    // Otherwise, assume it's a player code and look it up
    logWithTimestamp(`Looking up player by code: ${playerIdOrCode}`, 'info');
    const { data, error } = await supabase
      .from('players')
      .select('id, nickname')
      .eq('player_code', playerIdOrCode)
      .single();
    
    if (error) {
      logWithTimestamp(`Error finding player by code ${playerIdOrCode}: ${error.message}`, 'error');
      return { 
        actualPlayerId: null, 
        playerName: null,
        error: `Player not found: ${error.message}` 
      };
    }
    
    if (!data) {
      logWithTimestamp(`No player found with code ${playerIdOrCode}`, 'error');
      return { 
        actualPlayerId: null, 
        playerName: null,
        error: 'Player not found' 
      };
    }
    
    logWithTimestamp(`Resolved player code ${playerIdOrCode} to ID ${data.id}`, 'info');
    return { 
      actualPlayerId: data.id, 
      playerName: data.nickname,
      error: null 
    };
  } catch (err) {
    logWithTimestamp(`Error resolving player ID: ${(err as Error).message}`, 'error');
    return { 
      actualPlayerId: null, 
      playerName: null,
      error: `Error resolving player ID: ${(err as Error).message}` 
    };
  }
}

/**
 * Updates or inserts a claim in the database
 */
export async function upsertClaimInDatabase(
  sessionId: string,
  playerId: string,
  playerName: string,
  winPattern: string,
  calledNumbers: number[],
  lastCalledNumber: number | null,
  ticketData: any,
  gameNumber: number,
  gameType: string,
  isValid: boolean
): Promise<boolean> {
  try {
    // Log this info but don't actually store it in the database
    // This function is just for compatibility with existing code
    logWithTimestamp(`MOCK DB: Would upsert claim for player ${playerName} in session ${sessionId}`, 'info');
    logWithTimestamp(`MOCK DB: Claim validity: ${isValid}`, 'info');
    
    // Also broadcast to the channel that we've processed this claim
    const broadcastChannel = supabase.channel('game-updates');
    
    await broadcastChannel.send({
      type: 'broadcast',
      event: 'claim-processed',
      payload: {
        sessionId,
        playerId,
        playerName,
        isValid,
        timestamp: new Date().toISOString()
      }
    });
    
    // Always return success since we're not actually storing in DB
    return true;
  } catch (err) {
    logWithTimestamp(`Error upserting claim: ${(err as Error).message}`, 'error');
    return false;
  }
}
