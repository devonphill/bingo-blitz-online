
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

// Define an interface for ticket data to avoid type errors
export interface PlayerTicket {
  id: string;
  session_id: string;
  player_id: string;
  serial: string;
  perm: number;
  position: number;
  layout_mask: number;
  numbers: number[];
  called_numbers: number | null;
  time_stamp: string;
  is_winning?: boolean;
  winning_pattern?: string | null;
}

export function usePlayerTickets(sessionId: string | undefined) {
  const [playerTickets, setPlayerTickets] = useState<PlayerTicket[]>([]);
  const [currentWinningTickets, setCurrentWinningTickets] = useState<PlayerTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [isRefreshingTickets, setIsRefreshingTickets] = useState(false);

  const fetchTickets = useCallback(async () => {
    if (!sessionId) {
      setIsLoadingTickets(false);
      return;
    }
    
    try {
      const playerCode = localStorage.getItem('playerCode');
      if (!playerCode) {
        throw new Error('No player code found');
      }
      
      logWithTimestamp(`Fetching tickets for session ${sessionId} with player code ${playerCode}`, 'info');
      
      // Get tickets for this player in this session
      const { data, error } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('session_id', sessionId)
        .eq('player_code', playerCode);
      
      if (error) {
        throw new Error(`Failed to fetch tickets: ${error.message}`);
      }
      
      // If player_code doesn't work, try getting the player ID and use that instead
      if (!data || data.length === 0) {
        // Try to get player ID from localStorage
        const playerId = localStorage.getItem('playerId');
        
        if (playerId) {
          const { data: playerTickets, error: playerTicketsError } = await supabase
            .from('assigned_tickets')
            .select('*')
            .eq('session_id', sessionId)
            .eq('player_id', playerId);
            
          if (playerTicketsError) {
            throw new Error(`Failed to fetch tickets by player ID: ${playerTicketsError.message}`);
          }
          
          if (playerTickets && playerTickets.length > 0) {
            logWithTimestamp(`Found ${playerTickets.length} tickets using player ID`, 'info');
            
            const mappedTickets: PlayerTicket[] = playerTickets.map(ticket => ({
              ...ticket,
              is_winning: false,
              winning_pattern: null
            }));
            
            setPlayerTickets(mappedTickets);
            setCurrentWinningTickets([]);
            setTicketError(null);
            setIsLoadingTickets(false);
            return;
          }
        }
        
        logWithTimestamp('No tickets found', 'info');
        setPlayerTickets([]);
      } else {
        logWithTimestamp(`Found ${data.length} tickets`, 'info');
        
        // Map the data to ensure we have the expected properties
        const mappedTickets: PlayerTicket[] = data.map(ticket => ({
          ...ticket,
          is_winning: false, // Default value for is_winning
          winning_pattern: null // Default value for winning_pattern
        }));
        
        setPlayerTickets(mappedTickets);
        
        // Check for winning tickets
        // In a real app, this would check against game rules
        const winners = mappedTickets.filter(ticket => 
          ticket.is_winning || ticket.winning_pattern
        );
        setCurrentWinningTickets(winners);
      }
      
      setTicketError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load tickets';
      setTicketError(errorMessage);
      logWithTimestamp(`Error loading tickets: ${errorMessage}`, 'error');
    } finally {
      setIsLoadingTickets(false);
    }
  }, [sessionId]);

  // Initial fetch
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);
  
  // Function to refresh tickets
  const refreshTickets = useCallback(async () => {
    setIsRefreshingTickets(true);
    await fetchTickets();
    setIsRefreshingTickets(false);
    logWithTimestamp('Tickets refreshed', 'info');
  }, [fetchTickets]);

  return {
    playerTickets,
    isLoadingTickets,
    ticketError,
    currentWinningTickets,
    refreshTickets,
    isRefreshingTickets
  };
}
