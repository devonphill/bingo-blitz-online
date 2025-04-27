import { supabase } from '@/integrations/supabase/client';
import { GameState, GameType, CurrentGameState } from '@/types';
import { Json } from '@/types/json';
import { getGameRulesForType } from '@/game-rules/gameRulesRegistry';
import { GameConfig } from '@/types';

/**
 * Converts legacy game config format to the current format
 */
export function convertFromLegacyConfig(config: any): GameConfig {
  // If it already has a patterns property, assume it's already in the new format
  if (config && config.patterns) {
    return config as GameConfig;
  }

  // Convert from legacy format
  const patterns: Record<string, any> = {};
  
  if (config.selectedPatterns && Array.isArray(config.selectedPatterns)) {
    config.selectedPatterns.forEach((patternId: string) => {
      const prize = config.prizes && config.prizes[patternId];
      patterns[patternId] = {
        active: true,
        isNonCash: prize?.isNonCash || false,
        prizeAmount: prize?.amount || '10.00',
        description: prize?.description || `${patternId} Prize`
      };
    });
  }
  
  return {
    gameNumber: config.gameNumber || 1,
    gameType: config.gameType || 'mainstage',
    patterns,
    session_id: config.session_id
  };
}

/**
 * Updates the session progress with the current game state
 */
export async function updateSessionProgress(
  sessionId: string, 
  updates: {
    current_game_number?: number;
    max_game_number?: number;
    current_win_pattern?: string;
    current_game_type?: GameType;
    called_numbers?: number[];
    game_status?: 'pending' | 'active' | 'completed';
  }
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sessions_progress')
      .update(updates)
      .eq('session_id', sessionId);
      
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error updating session progress:', err);
    return false;
  }
}

/**
 * Updates the current game state in a session
 */
export async function updateGameStateInSession(
  sessionId: string,
  gameState: CurrentGameState
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('game_sessions')
      .update({
        current_game: gameState.gameNumber
      })
      .eq('id', sessionId);

    if (error) throw error;
    
    // Also update the session progress
    await updateSessionProgress(sessionId, {
      current_game_number: gameState.gameNumber,
      current_win_pattern: gameState.activePatternIds[0] || null,
      current_game_type: gameState.gameType,
      called_numbers: gameState.calledItems,
      game_status: gameState.status
    });

    return true;
  } catch (err) {
    console.error('Error updating game state in session:', err);
    return false;
  }
}

/**
 * Gets the claim verification status from a ticket
 */
export async function verifyBingoClaim(
  sessionId: string,
  currentWinPattern: string | null,
  ticketInfo: {
    serial: string;
    numbers: number[];
    layoutMask?: number;
  },
  currentCalledNumbers: number[]
): Promise<boolean> {
  try {
    // Get session info to determine game type
    const { data: sessionData, error: sessionError } = await supabase
      .from('game_sessions')
      .select('game_type')
      .eq('id', sessionId)
      .single();
      
    if (sessionError) throw sessionError;
    
    const gameType = sessionData.game_type;
    const gameRules = getGameRulesForType(gameType);
    
    // Validate the claim
    const result = gameRules.getTicketStatus(
      ticketInfo, 
      currentCalledNumbers, 
      currentWinPattern || ''
    );
    
    return result.isWinner;
  } catch (err) {
    console.error('Error verifying bingo claim:', err);
    return false;
  }
}

/**
 * Get the existing claims for a session
 */
export async function getWinClaimsForSession(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from('universal_game_logs')
      .select(`
        id, 
        session_id,
        player_id,
        player_name,
        player_email,
        win_pattern,
        prize_amount,
        ticket_serial,
        ticket_position,
        ticket_layout_mask,
        ticket_numbers,
        claimed_at
      `)
      .eq('session_id', sessionId);
      
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching win claims:', err);
    return [];
  }
}

/**
 * Record a win claim in the universal game logs
 */
export async function recordWinClaim(
  sessionId: string,
  playerId: string,
  playerName: string,
  winPatternId: string,
  ticketInfo: {
    serial: string;
    numbers: number[];
    layoutMask?: number;
    position?: number;
    perm?: number;
  },
  calledNumbers: number[],
  prizeAmount?: string,
  playerEmail?: string
): Promise<any> {
  try {
    const { data: sessionData, error: sessionError } = await supabase
      .from('game_sessions')
      .select('current_game, game_type, name')
      .eq('id', sessionId)
      .single();
      
    if (sessionError) throw sessionError;
    
    const gameNumber = sessionData.current_game;
    const gameType = sessionData.game_type;
    const sessionName = sessionData.name;
    
    // Insert the claim
    const { data, error } = await supabase
      .from('universal_game_logs')
      .insert({
        session_id: sessionId,
        session_name: sessionName,
        game_type: gameType,
        game_number: gameNumber,
        player_id: playerId,
        player_name: playerName,
        player_email: playerEmail,
        win_pattern: winPatternId,
        ticket_serial: ticketInfo.serial,
        ticket_position: ticketInfo.position || 0,
        ticket_layout_mask: ticketInfo.layoutMask || 0,
        ticket_numbers: ticketInfo.numbers,
        called_numbers: calledNumbers,
        total_calls: calledNumbers.length,
        last_called_number: calledNumbers[calledNumbers.length - 1] || null,
        prize_amount: prizeAmount || '0.00',
        claimed_at: new Date().toISOString(),
        validated_at: new Date().toISOString()
      })
      .select('id')
      .single();
      
    if (error) throw error;
    return data;
    
  } catch (err) {
    console.error('Error recording win claim:', err);
    throw err;
  }
}
