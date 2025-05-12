
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export function usePlayerTickets(sessionId: string | undefined) {
  const [playerTickets, setPlayerTickets] = useState<any[]>([]);
  const [currentWinningTickets, setCurrentWinningTickets] = useState<any[]>([]);
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
      const { data: tickets, error } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('session_id', sessionId)
        .eq('player_code', playerCode);
      
      if (error) {
        throw new Error(`Failed to fetch tickets: ${error.message}`);
      }
      
      if (!tickets || tickets.length === 0) {
        logWithTimestamp('No tickets found', 'info');
        setPlayerTickets([]);
      } else {
        logWithTimestamp(`Found ${tickets.length} tickets`, 'info');
        setPlayerTickets(tickets);
        
        // Check for winning tickets
        const winners = tickets.filter(ticket => ticket.is_winning || ticket.winning_pattern);
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
