
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from './logUtils';
import { getSingleSourceConnection } from './SingleSourceTrueConnections';
import { CHANNEL_NAMES, EVENT_TYPES } from '@/constants/websocketConstants';

/**
 * Submit a bingo claim and persist it to the database
 */
export async function submitBingoClaim(
  ticket: any, 
  playerCode: string, 
  sessionId: string, 
  playerName?: string,
  pattern?: string
): Promise<boolean> {
  if (!ticket || !playerCode || !sessionId) {
    logWithTimestamp('Cannot submit claim: Missing required parameters', 'error');
    return false;
  }

  try {
    // First get current game state
    const { data: progressData, error: progressError } = await supabase
      .from('sessions_progress')
      .select('called_numbers, current_win_pattern')
      .eq('session_id', sessionId)
      .single();

    if (progressError) {
      logWithTimestamp(`Error fetching session progress: ${progressError.message}`, 'error');
      return false;
    }

    // Get player data if player name not provided
    if (!playerName) {
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('nickname, id')
        .eq('player_code', playerCode)
        .single();

      if (playerError) {
        logWithTimestamp(`Error fetching player: ${playerError.message}`, 'error');
        return false;
      }

      playerName = playerData.nickname;
    }

    // Create the claim record in the database
    const claimData = {
      session_id: sessionId,
      player_code: playerCode,
      player_name: playerName,
      ticket_serial: ticket.serial || ticket.id,
      ticket_details: {
        id: ticket.id,
        serial: ticket.serial,
        perm: ticket.perm,
        position: ticket.position,
        layout_mask: ticket.layout_mask,
        numbers: ticket.numbers
      },
      called_numbers_snapshot: progressData.called_numbers,
      pattern_claimed: pattern || progressData.current_win_pattern || 'Not specified'
    };

    // Insert into claims table
    const { data, error } = await supabase
      .from('claims')
      .insert(claimData)
      .select()
      .single();

    if (error) {
      logWithTimestamp(`Error inserting claim: ${error.message}`, 'error');
      return false;
    }

    // Send real-time notification
    try {
      const connection = getSingleSourceConnection();
      const success = await connection.broadcast(
        CHANNEL_NAMES.CLAIM_UPDATES,
        EVENT_TYPES.CLAIM_SUBMITTED,
        {
          claimId: data.id,
          playerName: playerName,
          playerCode: playerCode,
          sessionId: sessionId,
          timestamp: Date.now(),
          pattern: pattern || progressData.current_win_pattern
        }
      );

      if (!success) {
        logWithTimestamp('Failed to broadcast claim notification', 'error');
      }
    } catch (broadcastError) {
      logWithTimestamp(`Error broadcasting claim: ${broadcastError}`, 'error');
      // Non-fatal, the claim is still saved in the database
    }

    logWithTimestamp(`Claim submitted successfully: ID ${data.id}`, 'info');
    return true;
  } catch (error) {
    logWithTimestamp(`Exception submitting claim: ${error}`, 'error');
    return false;
  }
}

/**
 * Verify if a ticket is a winner based on called numbers and pattern
 */
export function verifyTicket(
  ticket: any,
  calledNumbers: number[],
  pattern: string = 'line'
): { isWinner: boolean; markedCount: number; unmarkedCount: number; matchedNumbers: number[] } {
  if (!ticket?.numbers || !Array.isArray(ticket.numbers)) {
    return { isWinner: false, markedCount: 0, unmarkedCount: 0, matchedNumbers: [] };
  }

  // Simple pattern checking logic - can be expanded
  const matchedNumbers: number[] = [];
  let markedCount = 0;
  let unmarkedCount = 0;
  
  // Examine the ticket grid
  if (pattern === 'line' || pattern === 'one-line' || pattern.toLowerCase().includes('line')) {
    // Check each row for a full line
    for (let rowIndex = 0; rowIndex < ticket.numbers.length; rowIndex++) {
      const row = ticket.numbers[rowIndex];
      let rowComplete = true;
      
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const number = row[colIndex];
        if (number === 0) continue; // Skip empty cells (0 represents empty in many bingo systems)
        
        if (calledNumbers.includes(number)) {
          markedCount++;
          matchedNumbers.push(number);
        } else {
          rowComplete = false;
          unmarkedCount++;
        }
      }
      
      if (rowComplete && markedCount > 0) {
        return { isWinner: true, markedCount, unmarkedCount, matchedNumbers };
      }
    }
  } else if (pattern === 'full-house' || pattern === 'fullhouse' || pattern.toLowerCase().includes('full')) {
    // Check entire card
    let allMarked = true;
    
    for (let rowIndex = 0; rowIndex < ticket.numbers.length; rowIndex++) {
      const row = ticket.numbers[rowIndex];
      
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const number = row[colIndex];
        if (number === 0) continue; // Skip empty cells
        
        if (calledNumbers.includes(number)) {
          markedCount++;
          matchedNumbers.push(number);
        } else {
          allMarked = false;
          unmarkedCount++;
        }
      }
    }
    
    return { 
      isWinner: allMarked && markedCount > 0, 
      markedCount, 
      unmarkedCount, 
      matchedNumbers 
    };
  }
  
  // Default: not a winner
  return { isWinner: false, markedCount, unmarkedCount, matchedNumbers };
}
