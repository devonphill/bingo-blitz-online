import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from './logUtils';

/**
 * Utility function to log the current state of all called numbers for a session
 */
export const debugLogCalledNumbers = async (
  sessionId: string | null | undefined,
  label: string = 'Called Numbers Status'
): Promise<void> => {
  try {
    if (!sessionId) {
      console.warn('No sessionId provided to debugLogCalledNumbers');
      return;
    }

    const { data: sessionProgress, error } = await supabase
      .from('sessions_progress')
      .select('called_numbers, current_game_number')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      console.error(`Error fetching called numbers: ${error.message}`);
      return;
    }

    const calledNumbers = sessionProgress?.called_numbers || [];
    const currentGame = sessionProgress?.current_game_number || 1;

    console.log(`===== ${label} =====`);
    console.log(`Session: ${sessionId}`);
    console.log(`Game Number: ${currentGame}`);
    console.log(`Numbers Called (${calledNumbers.length}):`, calledNumbers);
    console.log('===========================');
  } catch (err) {
    console.error('Error in debugLogCalledNumbers:', err);
  }
};

/**
 * Check if the local storage called numbers are in sync with the database
 */
export const checkCalledNumbersSync = async (
  sessionId: string | null | undefined,
  localCalledNumbers: number[]
): Promise<boolean> => {
  if (!sessionId) {
    console.warn('No sessionId provided to checkCalledNumbersSync');
    return false;
  }

  try {
    const { data: sessionProgress, error } = await supabase
      .from('sessions_progress')
      .select('called_numbers')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      console.error(`Error checking called numbers sync: ${error.message}`);
      return false;
    }

    const dbCalledNumbers = sessionProgress?.called_numbers || [];

    // Check if the arrays have the same length
    if (localCalledNumbers.length !== dbCalledNumbers.length) {
      console.warn(
        `Called numbers out of sync: Local has ${localCalledNumbers.length}, DB has ${dbCalledNumbers.length}`
      );
      return false;
    }

    // Check if all numbers match (order matters)
    for (let i = 0; i < localCalledNumbers.length; i++) {
      if (localCalledNumbers[i] !== dbCalledNumbers[i]) {
        console.warn(
          `Called numbers out of sync at position ${i}: Local has ${localCalledNumbers[i]}, DB has ${dbCalledNumbers[i]}`
        );
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error('Error in checkCalledNumbersSync:', err);
    return false;
  }
};

/**
 * Get the last called number from the local storage or database
 */
export const getLastCalledNumber = async (
  sessionId: string | null | undefined,
  localCalledNumbers?: number[]
): Promise<number | null> => {
  // If we have local called numbers, use the last one
  if (localCalledNumbers && localCalledNumbers.length > 0) {
    return localCalledNumbers[localCalledNumbers.length - 1];
  }

  // Otherwise, fetch from the database
  if (!sessionId) {
    console.warn('No sessionId provided to getLastCalledNumber');
    return null;
  }

  try {
    const { data: sessionProgress, error } = await supabase
      .from('sessions_progress')
      .select('called_numbers')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      console.error(`Error fetching last called number: ${error.message}`);
      return null;
    }

    const dbCalledNumbers = sessionProgress?.called_numbers || [];
    
    if (dbCalledNumbers.length === 0) {
      return null;
    }

    return dbCalledNumbers[dbCalledNumbers.length - 1];
  } catch (err) {
    console.error('Error in getLastCalledNumber:', err);
    return null;
  }
};

/**
 * Load the called numbers from the database and return them
 */
export const fetchCalledNumbersFromDb = async (
  sessionId: string
): Promise<number[]> => {
  try {
    logWithTimestamp(`Fetching called numbers from database for session ${sessionId}`, 'info');
    
    if (!sessionId) {
      logWithTimestamp('No sessionId provided to fetchCalledNumbersFromDb', 'warn');
      return [];
    }
    
    const { data, error } = await supabase
      .from('sessions_progress') // Using the correct table name
      .select('called_numbers')
      .eq('session_id', sessionId)
      .single();
      
    if (error) {
      logWithTimestamp(`Error fetching called numbers: ${error.message}`, 'error');
      return [];
    }
    
    const calledNumbers = data?.called_numbers || [];
    logWithTimestamp(`Retrieved ${calledNumbers.length} called numbers from DB`, 'info');
    
    return calledNumbers;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logWithTimestamp(`Exception in fetchCalledNumbersFromDb: ${errorMessage}`, 'error');
    return [];
  }
};

/**
 * Debug utility to dump all player tickets for a session
 */
export const debugDumpAllPlayerTickets = async (
  sessionId: string
): Promise<void> => {
  try {
    if (!sessionId) {
      console.warn('No sessionId provided to debugDumpAllPlayerTickets');
      return;
    }

    const { data: tickets, error } = await supabase
      .from('assigned_tickets')
      .select(`
        id, serial, position, perm, layout_mask, numbers,
        players:player_id (id, nickname, player_code)
      `)
      .eq('session_id', sessionId);

    if (error) {
      console.error(`Error fetching tickets: ${error.message}`);
      return;
    }

    console.log(`===== All Player Tickets for Session ${sessionId} =====`);
    console.log(`Found ${tickets?.length || 0} tickets`);
    
    if (tickets && tickets.length > 0) {
      tickets.forEach((ticket, index) => {
        const playerInfo = ticket.players;
        console.log(`Ticket #${index + 1}:`);
        console.log(`  ID: ${ticket.id}`);
        console.log(`  Serial: ${ticket.serial}`);
        console.log(`  Position: ${ticket.position}`);
        console.log(`  Player: ${playerInfo?.nickname || 'Unknown'} (${playerInfo?.player_code || 'No code'})`);
        console.log(`  Numbers: ${JSON.stringify(ticket.numbers)}`);
        console.log('-------------------');
      });
    }
    
    console.log('=============================================');
  } catch (err) {
    console.error('Error in debugDumpAllPlayerTickets:', err);
  }
};
