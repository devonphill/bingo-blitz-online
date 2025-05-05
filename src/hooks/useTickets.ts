import { useState, useEffect, useCallback } from 'react';
import { Ticket } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { cacheTickets, getCachedTickets } from '@/utils/ticketUtils';
import { toast } from 'sonner';
import { logWithTimestamp } from '@/utils/logUtils';
import { useNetwork } from '@/contexts/NetworkStatusContext';

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
  
  // Use the network context
  const network = useNetwork();
  
  const loadTickets = useCallback(async () => {
    if (!playerCode || !sessionId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
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
      logWithTimestamp(`Loaded ${mappedTickets.length} tickets from database and cached them`, 'info');
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
      logWithTimestamp(`Fetching tickets for player ${playerCode} in session ${sessionId}`, 'info');
      loadTickets();
      
      // Connect to the session
      network.connect(sessionId);
      
      // Set up a direct listener for assigned tickets in the database
      const ticketsChannel = supabase
        .channel(`player_tickets_${playerCode}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'assigned_tickets'
          },
          async (payload) => {
            // When new tickets are assigned, check if they're for our player
            const newTicket = payload.new as any;
            
            if (newTicket) {
              try {
                // Get the player ID for this player code
                const { data: playerData } = await supabase
                  .from('players')
                  .select('id')
                  .eq('player_code', playerCode)
                  .single();
                
                // If this ticket belongs to our player, refresh tickets
                if (playerData && playerData.id === newTicket.player_id) {
                  logWithTimestamp(`New ticket assigned to player ${playerCode}`, 'info');
                  loadTickets();
                  
                  toast.success('New tickets have been assigned to you!');
                }
              } catch (err) {
                console.error('Error processing ticket assignment:', err);
              }
            }
          })
        .subscribe();
      
      // Clean up
      return () => {
        supabase.removeChannel(ticketsChannel);
      };
    } else {
      logWithTimestamp("Not fetching tickets: waiting for game to be active", 'info');
      setTickets([]);
      setIsLoading(false);
    }
  }, [loadTickets, network, playerCode, sessionId]);
  
  return {
    tickets,
    isLoading,
    error,
    refreshTickets: loadTickets
  };
}
