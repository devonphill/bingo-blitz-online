import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';
import { checkMainstageWinPattern } from '@/utils/mainstageWinLogic';
import { normalizeWinPattern, areWinPatternsEquivalent } from '@/utils/winPatternUtils';

// Export the PlayerTicket type so it can be imported elsewhere
export interface PlayerTicket {
  id: string;
  serial: string;
  perm: number;
  position?: number;
  layout_mask: number;
  numbers: number[];
  is_winning?: boolean;
  winning_pattern?: string | null;
  to_go?: number;
}

// Define the allowed win pattern types to match mainstageWinLogic expectations
type AllowedWinPattern = 'oneLine' | 'twoLines' | 'fullHouse' | 'MAINSTAGE_oneLine' | 'MAINSTAGE_twoLines' | 'MAINSTAGE_fullHouse';

export function usePlayerTickets(sessionId?: string | null) {
  const [playerTickets, setPlayerTickets] = useState<PlayerTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [isRefreshingTickets, setIsRefreshingTickets] = useState(false);
  const [currentWinningTickets, setCurrentWinningTickets] = useState<PlayerTicket[]>([]);

  // Function to process tickets and check if they're winning
  const processTickets = useCallback((tickets: any[], calledNumbers: number[], currentWinPattern: string | null) => {
    if (!tickets || tickets.length === 0) return [];
    
    try {
      // ALWAYS normalize the win pattern for consistent checking
      // Make sure we have a valid pattern for checkMainstageWinPattern function
      const normalizedWinPattern = normalizeWinPattern(currentWinPattern || 'oneLine', 'MAINSTAGE');
      
      // Log the normalized pattern for debugging
      console.log(`Processing tickets with normalized pattern: ${normalizedWinPattern}`);
      
      return tickets.map(ticket => {
        // Convert ticket data into the format needed for win checking
        const layoutMask = ticket.layout_mask || ticket.layoutMask || 0;
        const numbers = ticket.numbers || [];
        
        if (!layoutMask || numbers.length === 0) {
          return { ...ticket, is_winning: false };
        }
        
        // Create a grid representation for win checking
        const maskBits = layoutMask.toString(2).padStart(27, "0").split("").reverse();
        const grid: (number | null)[][] = [[], [], []];
        let numIndex = 0;
        
        for (let i = 0; i < 27; i++) {
          const row = Math.floor(i / 9);
          if (maskBits[i] === '1') {
            if (numIndex < numbers.length) {
              grid[row].push(numbers[numIndex]);
              numIndex++;
            } else {
              grid[row].push(null); // Safety check in case of data mismatch
            }
          } else {
            grid[row].push(null);
          }
        }
        
        // Check if it's a winning ticket - cast the normalized pattern to the expected type
        const result = checkMainstageWinPattern(
          grid, 
          calledNumbers,
          normalizedWinPattern as AllowedWinPattern
        );
        
        return { 
          ...ticket, 
          is_winning: result.isWinner,
          winning_pattern: result.isWinner ? currentWinPattern : null,
          to_go: result.tg
        };
      });
    } catch (error) {
      console.error("Error processing tickets:", error);
      return tickets.map(ticket => ({ ...ticket, is_winning: false }));
    }
  }, []);

  // Function to fetch tickets from the database
  const fetchTickets = useCallback(async (forceRefresh = false) => {
    if (!sessionId) {
      setPlayerTickets([]);
      setCurrentWinningTickets([]);
      return;
    }
    
    if (forceRefresh) {
      setIsRefreshingTickets(true);
    } else {
      setIsLoadingTickets(true);
    }
    
    setTicketError(null);
    
    try {
      logWithTimestamp(`Fetching tickets for session ${sessionId}`, 'info');
      
      const { data, error } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('session_id', sessionId);
        
      if (error) {
        setTicketError(`Error fetching tickets: ${error.message}`);
        return;
      }
      
      if (!data || data.length === 0) {
        logWithTimestamp('No tickets found for this session', 'warn');
        setPlayerTickets([]);
        setCurrentWinningTickets([]);
        return;
      }
      
      logWithTimestamp(`Found ${data.length} tickets`, 'info');
      
      // Also fetch the current win pattern and called numbers
      const { data: sessionData } = await supabase
        .from('sessions_progress')
        .select('current_win_pattern, called_numbers')
        .eq('session_id', sessionId)
        .single();
        
      const currentWinPattern = sessionData?.current_win_pattern || 'oneLine';
      const calledNumbers = sessionData?.called_numbers || [];
      
      // Process tickets to check for winners - always use normalized pattern
      const normalizedPattern = normalizeWinPattern(currentWinPattern, 'MAINSTAGE');
      const processedTickets = processTickets(data, calledNumbers, normalizedPattern);
      setPlayerTickets(processedTickets);
      
      // Find winning tickets
      const winningTickets = processedTickets.filter(t => t.is_winning);
      setCurrentWinningTickets(winningTickets);
      
      if (winningTickets.length > 0) {
        logWithTimestamp(`Found ${winningTickets.length} winning tickets!`, 'info');
      } else {
        logWithTimestamp('No winning tickets found', 'warn');
      }
      
    } catch (err) {
      setTicketError(`An error occurred while fetching tickets: ${err}`);
      console.error('Error fetching tickets:', err);
    } finally {
      setIsLoadingTickets(false);
      setIsRefreshingTickets(false);
    }
  }, [sessionId, processTickets]);
  
  // Initial fetch of tickets
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);
  
  // Function to manually refresh tickets
  const refreshTickets = useCallback(() => {
    return fetchTickets(true);
  }, [fetchTickets]);
  
  // Function to update the winning status of tickets
  const updateWinningStatus = useCallback((calledNumbers: number[], currentWinPattern: string | null) => {
    setPlayerTickets(tickets => {
      try {
        // Always normalize the win pattern for consistent checking
        const normalizedPattern = normalizeWinPattern(currentWinPattern || 'oneLine', 'MAINSTAGE');
        console.log(`Updating winning status with pattern: ${normalizedPattern}`);
        
        const updatedTickets = processTickets(tickets, calledNumbers, normalizedPattern);
        const winningTickets = updatedTickets.filter(t => t.is_winning);
        
        setCurrentWinningTickets(winningTickets);
        
        if (winningTickets.length > 0) {
          logWithTimestamp(`Found ${winningTickets.length} winning tickets after update!`, 'info');
        }
        
        return updatedTickets;
      } catch (error) {
        console.error("Error updating winning status:", error);
        return tickets;
      }
    });
  }, [processTickets]);

  return {
    playerTickets,
    isLoadingTickets,
    ticketError,
    refreshTickets: useCallback(() => fetchTickets(true), [fetchTickets]),
    isRefreshingTickets,
    currentWinningTickets,
    updateWinningStatus
  };
}
