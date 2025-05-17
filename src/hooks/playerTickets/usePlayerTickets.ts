
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logWithTimestamp } from '@/utils/logUtils';

export interface PlayerTicket {
  id: string;
  serial: string;
  perm: number;
  position: number;
  layout_mask: number;
  numbers: number[][];
  marked?: boolean[][];
  markedPositions?: { row: number; col: number }[];
}

export interface UsePlayerTicketsResult {
  tickets: PlayerTicket[];
  isLoading: boolean;
  error: Error | null;
  refreshTickets: () => Promise<void>;
}

/**
 * Hook to fetch and manage player tickets
 */
export function usePlayerTickets(
  sessionId: string | null | undefined,
  playerId?: string | null,
  playerCode?: string | null
): UsePlayerTicketsResult {
  const [tickets, setTickets] = useState<PlayerTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Function to fetch tickets
  const fetchTickets = async () => {
    if (!sessionId || (!playerId && !playerCode)) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build the query based on available parameters
      let query = supabase
        .from('assigned_tickets')
        .select('*');

      if (playerId) {
        query = query.eq('player_id', playerId);
      } else if (playerCode) {
        // If we have playerCode but not playerId, first get the player id
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id')
          .eq('player_code', playerCode)
          .single();

        if (playerError || !playerData) {
          throw new Error(`Could not find player with code ${playerCode}`);
        }

        query = query.eq('player_id', playerData.id);
      }

      // Add session filter and execute query
      const { data, error: ticketsError } = await query
        .eq('session_id', sessionId)
        .order('position', { ascending: true });

      if (ticketsError) throw ticketsError;

      if (data && data.length > 0) {
        // Transform data if needed
        const formattedTickets = data.map((ticket) => {
          // Convert flat numbers array to 2D array for display
          let numbers: number[][] = [];
          
          if (Array.isArray(ticket.numbers)) {
            if (!Array.isArray(ticket.numbers[0])) {
              // If numbers is a flat array, convert to 2D based on game type
              // For 90-ball bingo (9x3 grid)
              const rows = 3;
              const cols = 9;
              
              for (let i = 0; i < rows; i++) {
                const row: number[] = [];
                for (let j = 0; j < cols; j++) {
                  const index = i * cols + j;
                  row.push(index < ticket.numbers.length ? ticket.numbers[index] : 0);
                }
                numbers.push(row);
              }
            } else {
              // Already in 2D format
              numbers = ticket.numbers;
            }
          }
          
          // Initialize marked array if needed
          const marked = Array(numbers.length)
            .fill(null)
            .map(() => Array(numbers[0]?.length || 0).fill(false));
            
          return {
            id: ticket.id,
            serial: ticket.serial,
            perm: ticket.perm,
            position: ticket.position,
            layout_mask: ticket.layout_mask,
            numbers,
            marked,
            markedPositions: [] // Initialize empty markedPositions array
          };
        });

        logWithTimestamp(`Loaded ${formattedTickets.length} tickets for player`, 'info');
        setTickets(formattedTickets);
      } else {
        logWithTimestamp('No tickets found for player', 'info');
        setTickets([]);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logWithTimestamp(`Error fetching tickets: ${errorMessage}`, 'error');
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch tickets on mount and when dependencies change
  useEffect(() => {
    fetchTickets();
  }, [sessionId, playerId, playerCode]);

  return {
    tickets,
    isLoading,
    error,
    refreshTickets: fetchTickets
  };
}
