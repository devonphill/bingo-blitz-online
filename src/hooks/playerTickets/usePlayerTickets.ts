
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { checkMainstageWinPattern } from '@/utils/mainstageWinLogic'; // Assuming this path is correct
import { normalizeWinPattern } from '@/utils/winPatternUtils'; // Assuming this path is correct

// --- Central PlayerTicket Type ---
export interface PlayerTicket {
  id: string;                     // From assigned_tickets
  serial_number: string;          // From assigned_tickets (assuming 'serial' column)
  perm_number: number;            // From assigned_tickets (assuming 'perm' column)
  position: number;               // From assigned_tickets, required for ordering
  layout_mask: number;            // From assigned_tickets
  raw_numbers: number[];          // The flat array of numbers from assigned_tickets.numbers
  numbers_grid: (number | null)[][]; // The 2D grid (e.g., 3x9) for UI display
  markedPositions?: Record<string, boolean>; // e.g., { "0,0": true, "1,2": true } or Set<string>
  is_winning?: boolean;
  winning_pattern?: string | null;
  to_go?: number;
}

// --- AllowedWinPattern Type (from your previous root hook) ---
// Ensure this aligns with what checkMainstageWinPattern expects
type AllowedWinPattern = 'oneLine' | 'twoLines' | 'fullHouse' | 'MAINSTAGE_oneLine' | 'MAINSTAGE_twoLines' | 'MAINSTAGE_fullHouse';

// --- Hook Return Type ---
export interface UsePlayerTicketsResult {
  playerTickets: PlayerTicket[];
  isLoadingTickets: boolean;
  ticketError: string | null;
  refreshTickets: () => Promise<void>;
  isRefreshingTickets: boolean;
  currentWinningTickets: PlayerTicket[];
  updateWinningStatus: (calledNumbers: number[], currentWinPattern: string | null) => void;
}

// --- Helper to build the 3x9 grid from flat numbers and layout mask ---
const buildTicketGrid = (flatNumbers: number[], layoutMask: number): (number | null)[][] => {
  const grid: (number | null)[][] = [[], [], []]; // 3 rows
  const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse(); // Assuming 27 cells for 9x3
  let numIndex = 0;

  if (!flatNumbers || flatNumbers.length === 0) {
    // Return an empty grid or grid of nulls if no numbers
    for (let r = 0; r < 3; r++) {
      grid[r] = Array(9).fill(null);
    }
    return grid;
  }

  for (let i = 0; i < 27; i++) { // Iterate through all 27 potential cell positions (9 columns x 3 rows)
    const row = Math.floor(i / 9);
    // const col = i % 9; // If needed for direct grid[row][col] assignment

    if (maskBits[i] === '1') {
      if (numIndex < flatNumbers.length) {
        grid[row].push(flatNumbers[numIndex]);
        numIndex++;
      } else {
        grid[row].push(null); // Not enough numbers for all mask positions
      }
    } else {
      grid[row].push(null); // This cell is empty according to the mask
    }
  }
  // Ensure all rows have 9 columns, padding with null if necessary
  for (let r = 0; r < 3; r++) {
    while(grid[r].length < 9) {
      grid[r].push(null);
    }
  }
  return grid;
};

export function usePlayerTickets(
  sessionId: string | null | undefined,
  playerId?: string | null,       // Player's database UUID
  playerCode?: string | null,    // Short player code
): UsePlayerTicketsResult {
  const [playerTickets, setPlayerTickets] = useState<PlayerTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [isRefreshingTickets, setIsRefreshingTickets] = useState(false);
  const [currentWinningTickets, setCurrentWinningTickets] = useState<PlayerTicket[]>([]);

  const processFetchedTickets = useCallback((
    fetchedDbTickets: any[], // Raw from DB, assuming 'numbers' is flat array
    calledNumbersForWinCheck: number[],
    winPatternForWinCheck: string | null
  ): PlayerTicket[] => {
    if (!fetchedDbTickets || fetchedDbTickets.length === 0) return [];

    const normalizedPattern = normalizeWinPattern(winPatternForWinCheck || 'oneLine', 'MAINSTAGE');

    console.log(`Processing ${fetchedDbTickets.length} tickets with pattern: ${normalizedPattern}`);

    return fetchedDbTickets.map((dbTicket) => {
      const rawNumbers: number[] = dbTicket.numbers || [];
      const layoutMask: number = dbTicket.layout_mask || 0;
      
      // Build the 2D grid from the flat array of numbers
      const numbersGrid = buildTicketGrid(rawNumbers, layoutMask);

      // Perform win checking
      const winCheckResult = checkMainstageWinPattern(
        numbersGrid, // Pass the 2D grid
        calledNumbersForWinCheck,
        normalizedPattern as AllowedWinPattern // Cast if necessary, ensure AllowedWinPattern is correct
      );
      
      // Create the PlayerTicket object with all required properties
      return {
        id: dbTicket.id,
        serial_number: dbTicket.serial, // DB column is 'serial'
        perm_number: dbTicket.perm,     // DB column is 'perm'
        position: dbTicket.position || 0, // Ensure position is always a number
        layout_mask: layoutMask,
        raw_numbers: rawNumbers,         // Keep the original flat array
        numbers_grid: numbersGrid,       // Add the 2D grid
        markedPositions: {},             // Initialize as needed
        is_winning: winCheckResult.isWinner,
        winning_pattern: winCheckResult.isWinner ? winPatternForWinCheck : null,
        to_go: winCheckResult.tg,
      };
    });
  }, []); 

  const fetchTickets = useCallback(async (forceRefresh = false) => {
    if (!sessionId) {
      setPlayerTickets([]);
      setCurrentWinningTickets([]);
      setIsLoadingTickets(false);
      return;
    }
    
    // Determine actual playerId if only playerCode is available
    let currentPId = playerId;
    if (!currentPId && playerCode) {
      try {
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id')
          .eq('player_code', playerCode)
          .single();
        if (playerError || !playerData) {
          throw new Error(playerError?.message || `Could not find player with code ${playerCode}`);
        }
        currentPId = playerData.id;
      } catch (e: any) {
        logWithTimestamp(`Error fetching playerId for code ${playerCode}: ${e.message}`, 'error');
        setTicketError(e.message);
        setIsLoadingTickets(false);
        setIsRefreshingTickets(false);
        return;
      }
    }

    if (!currentPId) { // Still no playerId
        logWithTimestamp('No playerId available to fetch tickets.', 'warn');
        setPlayerTickets([]);
        setCurrentWinningTickets([]);
        setIsLoadingTickets(false);
        return;
    }

    if (forceRefresh) setIsRefreshingTickets(true);
    else setIsLoadingTickets(true);
    setTicketError(null);

    try {
      logWithTimestamp(`Fetching tickets for player ${currentPId} in session ${sessionId}`, 'info');

      const { data: assignedTicketsData, error: ticketsFetchError } = await supabase
        .from('assigned_tickets')
        .select('id, serial, perm, position, layout_mask, numbers') // Select only needed fields
        .eq('player_id', currentPId)
        .eq('session_id', sessionId)
        .order('position', { ascending: true });

      if (ticketsFetchError) throw ticketsFetchError;

      if (!assignedTicketsData || assignedTicketsData.length === 0) {
        logWithTimestamp('No tickets found for this player in this session', 'info');
        setPlayerTickets([]);
        setCurrentWinningTickets([]);
        return;
      }
      
      logWithTimestamp(`Found ${assignedTicketsData.length} assigned tickets`, 'info');

      // Fetch current game progress for win checking
      const { data: sessionProgressData, error: progressError } = await supabase
        .from('sessions_progress')
        .select('current_win_pattern, called_numbers')
        .eq('session_id', sessionId)
        .single();

      if (progressError) {
        logWithTimestamp(`Warning: Could not fetch session progress for win checking: ${progressError.message}`, 'warn');
      }
      
      const currentWinPattern = sessionProgressData?.current_win_pattern || 'oneLine';
      const calledNumbers = sessionProgressData?.called_numbers || [];

      const processed = processFetchedTickets(assignedTicketsData, calledNumbers, currentWinPattern);
      setPlayerTickets(processed);
      
      const winningTickets = processed.filter(t => t.is_winning);
      setCurrentWinningTickets(winningTickets);

      if (winningTickets.length > 0) {
        logWithTimestamp(`Found ${winningTickets.length} winning tickets initially!`, 'info');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logWithTimestamp(`Error in fetchTickets: ${errorMessage}`, 'error');
      setTicketError(errorMessage);
      setPlayerTickets([]); // Clear tickets on error
      setCurrentWinningTickets([]);
    } finally {
      setIsLoadingTickets(false);
      setIsRefreshingTickets(false);
    }
  }, [sessionId, playerId, playerCode, processFetchedTickets]); 

  useEffect(() => {
    if (sessionId && (playerId || playerCode)) {
      fetchTickets();
    } else {
      // Clear tickets if session/player context is lost
      setPlayerTickets([]);
      setCurrentWinningTickets([]);
      setIsLoadingTickets(false); // Ensure loading stops if no IDs
    }
  }, [sessionId, playerId, playerCode, fetchTickets]);

  const updateWinningStatus = useCallback((
    calledNumbers: number[],
    currentWinPattern: string | null
  ) => {
    setPlayerTickets(currentTickets => {
      // Create a proper array of DB-like objects from the current tickets
      const ticketsForProcessing = currentTickets.map(ticket => ({
        id: ticket.id,
        serial: ticket.serial_number,
        perm: ticket.perm_number,
        position: ticket.position,
        layout_mask: ticket.layout_mask,
        numbers: ticket.raw_numbers
      }));
      
      const updatedTickets = processFetchedTickets(ticketsForProcessing, calledNumbers, currentWinPattern);
      
      const winningTickets = updatedTickets.filter(t => t.is_winning);
      setCurrentWinningTickets(winningTickets);
      
      if (winningTickets.length > 0) {
         logWithTimestamp(`Found ${winningTickets.length} winning tickets after update!`, 'info');
      }
      
      return updatedTickets;
    });
  }, [processFetchedTickets]); 

  return {
    playerTickets,
    isLoadingTickets,
    ticketError,
    refreshTickets: useCallback(() => fetchTickets(true), [fetchTickets]),
    isRefreshingTickets,
    currentWinningTickets,
    updateWinningStatus,
  };
}
