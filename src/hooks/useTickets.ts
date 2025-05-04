import { useState, useEffect, useCallback } from 'react';
import { Ticket } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { cacheTickets, getCachedTickets } from '@/utils/ticketUtils';
import { toast } from 'sonner';
import { connectionManager } from '@/utils/connectionManager';
import { logWithTimestamp } from '@/utils/logUtils';

interface UseTicketsResult {
  tickets: Ticket[];
  isLoading: boolean;
  error: string | null;
  refreshTickets: () => Promise<void>;
}

export function useTickets(playerCode: string | null | undefined, sessionId: string | undefined): UseTicketsResult {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadTickets = useCallback(async () => {
    if (!playerCode || !sessionId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      // Fix: Use separate message and level parameters for logWithTimestamp
      logWithTimestamp(`Loading tickets for player ${playerCode} in session ${sessionId}`, 'info');
      
      // Try to get tickets from cache first
      const cachedTickets = getCachedTickets(playerCode, sessionId);
      
      if (cachedTickets && cachedTickets.length > 0) {
        console.log(`Using ${cachedTickets.length} cached tickets from session storage`);
        setTickets(cachedTickets);
        setIsLoading(false);
        return;
      }
      
      // Fetch player info to get player ID
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('player_code', playerCode)
        .single();
        
      if (playerError || !playerData) {
        setError(`Player not found: ${playerError?.message || 'Unknown error'}`);
        setIsLoading(false);
        return;
      }
      
      const playerId = playerData.id;
      
      // Fetch tickets for this player and session
      const { data: ticketData, error: ticketError } = await supabase
        .from('assigned_tickets')
        .select('*')
        .eq('player_id', playerId)
        .eq('session_id', sessionId)
        .order('perm, position');
        
      if (ticketError) {
        setError(`Error fetching tickets: ${ticketError.message}`);
        setIsLoading(false);
        return;
      }

      if (!ticketData || ticketData.length === 0) {
        console.warn('No tickets found for player');
        setTickets([]);
        setIsLoading(false);
        return;
      }
      
      console.log('Raw ticket data from DB:', ticketData);
      
      // Map database ticket fields to our Ticket interface
      const mappedTickets: Ticket[] = ticketData.map(ticket => {
        // Ensure the layout_mask is present
        if (ticket.layout_mask === undefined) {
          console.warn(`Ticket ${ticket.serial} missing layout mask:`, ticket);
          toast.error(`Ticket ${ticket.serial} has no layout information`);
        }
        
        return {
          id: ticket.id,
          playerId: ticket.player_id,
          sessionId: ticket.session_id,
          numbers: ticket.numbers || [],
          serial: ticket.serial || `Unknown-${Math.random().toString(36).substring(2, 7)}`,
          position: ticket.position || 0,
          layoutMask: ticket.layout_mask || 0, // Map layout_mask from DB to layoutMask in our interface
          perm: ticket.perm || 0
        };
      });
      
      console.log('Mapped tickets:', mappedTickets);
      
      // Cache tickets in session storage
      cacheTickets(playerCode, sessionId, mappedTickets);
      
      setTickets(mappedTickets);
      logWithTimestamp(`Loaded ${mappedTickets.length} tickets from database and cached them`);
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error('Error in fetchTickets:', errorMsg, err);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [playerCode, sessionId]);
  
  // Initial fetch
  useEffect(() => {
    if (playerCode && sessionId) {
      logWithTimestamp(`Fetching tickets for player ${playerCode} in session ${sessionId}`);
      loadTickets();
      
      // Set up the real-time listener for ticket assignments via connection manager
      connectionManager.initialize(sessionId)
        .onTicketsAssigned((assignedPlayerCode, assignedTickets) => {
          if (assignedPlayerCode === playerCode && assignedTickets && assignedTickets.length > 0) {
            logWithTimestamp(`Received ${assignedTickets.length} tickets assignment for player ${playerCode}`);
            
            // Map the assigned tickets to our format
            const mappedTickets: Ticket[] = assignedTickets.map(ticket => ({
              id: ticket.id,
              playerId: ticket.player_id,
              sessionId: ticket.session_id,
              numbers: ticket.numbers || [],
              serial: ticket.serial || `RT-${Math.random().toString(36).substring(2, 7)}`,
              position: ticket.position || 0,
              layoutMask: ticket.layout_mask || 0, 
              perm: ticket.perm || 0
            }));
            
            // Update state and cache
            setTickets(mappedTickets);
            cacheTickets(playerCode, sessionId, mappedTickets);
            
            toast.success(`${mappedTickets.length} tickets have been assigned to you!`);
            setIsLoading(false);
          }
        });
    } else {
      logWithTimestamp("Not fetching tickets: waiting for game to be active", { playerCode, sessionId });
      setTickets([]);
      setIsLoading(false);
    }
  }, [loadTickets, playerCode, sessionId]);
  
  return {
    tickets,
    isLoading,
    error,
    refreshTickets: loadTickets
  };
}
