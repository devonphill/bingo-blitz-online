
import { useState, useEffect, useCallback } from 'react';
import { Ticket } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { cacheTickets, getCachedTickets } from '@/utils/ticketUtils';
import { toast } from 'sonner';

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
  
  const fetchTickets = useCallback(async () => {
    if (!playerCode || !sessionId) {
      setError("Missing player code or session ID");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
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
          numbers: ticket.numbers,
          serial: ticket.serial,
          position: ticket.position,
          layoutMask: ticket.layout_mask, // This maps layout_mask from DB to layoutMask in our interface
          perm: ticket.perm
        };
      });
      
      // Cache tickets in session storage
      cacheTickets(playerCode, sessionId, mappedTickets);
      
      setTickets(mappedTickets);
      console.log(`Loaded ${mappedTickets.length} tickets from database and cached them`);
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
    fetchTickets();
  }, [fetchTickets]);
  
  return {
    tickets,
    isLoading,
    error,
    refreshTickets: fetchTickets
  };
}
