
// Fix the recordWinClaim function to match the database table structure
// Modify only the recordWinClaim function to resolve the insert error
import { supabase } from '@/integrations/supabase/client';
import { GameConfig, LegacyGameConfig, WinPatternConfig } from '@/types';

/**
 * Converts a legacy game configuration to the new format
 */
export function convertFromLegacyConfig(config: any): GameConfig {
  if (!config) {
    return {
      gameNumber: 1,
      gameType: 'mainstage',
      patterns: {
        'oneLine': {
          active: true,
          isNonCash: false,
          prizeAmount: '10.00',
          description: 'One Line Prize'
        }
      }
    };
  }
  
  // Check if it's already in the new format with patterns property
  if (config.patterns) {
    return {
      gameNumber: config.gameNumber || 1,
      gameType: config.gameType || 'mainstage',
      patterns: config.patterns
    };
  }
  
  // Convert from legacy format
  const patterns: Record<string, WinPatternConfig> = {};
  
  // Use selectedPatterns to populate patterns
  if (config.selectedPatterns && Array.isArray(config.selectedPatterns)) {
    config.selectedPatterns.forEach((patternId: string) => {
      const prize = config.prizes?.[patternId] || {};
      patterns[patternId] = {
        active: true,
        isNonCash: prize.isNonCash || false,
        prizeAmount: prize.amount || '10.00',
        description: prize.description || `${patternId} Prize`
      };
    });
  } else {
    // Default pattern if none selected
    patterns['oneLine'] = {
      active: true,
      isNonCash: false,
      prizeAmount: '10.00',
      description: 'One Line Prize'
    };
  }
  
  return {
    gameNumber: config.gameNumber || 1,
    gameType: config.gameType || 'mainstage',
    patterns
  };
}

/**
 * Updates the session progress in the database
 */
export async function updateSessionProgress(
  sessionId: string,
  updates: any
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sessions_progress')
      .update(updates)
      .eq('session_id', sessionId);
      
    if (error) {
      console.error('Error updating session progress:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Exception in updateSessionProgress:', err);
    return false;
  }
}

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
    
    // Insert the claim - match column names exactly as defined in the database
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
