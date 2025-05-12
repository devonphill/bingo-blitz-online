
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

// Define an interface for ticket data
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
      // Get player ID from localStorage
      const playerId = localStorage.getItem('playerId');
      
      if (!playerId) {
        throw new Error('No player ID found');
      }
      
      logWithTimestamp(`Fetching tickets for session ${sessionId} with player ID ${playerId}`, 'info');
      
      // Get tickets for this player in this session
      const { data, error } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('session_id', sessionId)
        .eq('player_id', playerId);
      
      if (error) {
        throw new Error(`Failed to fetch tickets: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        logWithTimestamp('No tickets found', 'info');
        setPlayerTickets([]);
        setCurrentWinningTickets([]);
      } else {
        logWithTimestamp(`Found ${data.length} tickets`, 'info');
        
        // Map the data to ensure we have the expected properties
        const mappedTickets: PlayerTicket[] = data.map(ticket => ({
          id: ticket.id,
          session_id: ticket.session_id,
          player_id: ticket.player_id,
          serial: ticket.serial,
          perm: ticket.perm,
          position: ticket.position,
          layout_mask: ticket.layout_mask,
          numbers: ticket.numbers,
          called_numbers: ticket.called_numbers,
          time_stamp: ticket.time_stamp,
          is_winning: false,
          winning_pattern: null
        }));
        
        setPlayerTickets(mappedTickets);
        
        // Check for winning tickets
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
