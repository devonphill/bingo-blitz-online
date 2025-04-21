
import { supabase } from "@/integrations/supabase/client";
import { SupabaseRpcFunction } from "@/integrations/supabase/customTypes";

export interface TicketData {
  serial: string;
  perm: number;
  position: number;
  layout_mask: number;
  numbers: number[];
}

export interface AssignedTicket {
  id: string;
  player_id: string;
  session_id: string;
  serial: string;
  perm: number;
  position: number;
  layout_mask: number;
  numbers: number[];
  created_at: string;
}

export function useTickets() {
  // Fetch available tickets for assignment
  const getAvailableTickets = async (sessionId: string, count: number): Promise<TicketData[]> => {
    try {
      const { data: assignedTicketsData, error: assignedError } = await supabase
        .rpc('get_assigned_ticket_serials_by_session' as SupabaseRpcFunction, { 
          p_session_id: sessionId 
        });

      if (assignedError) {
        console.error("Error getting assigned tickets:", assignedError);
        return [];
      }
      const assignedSerials = new Set(Array.isArray(assignedTicketsData) ? assignedTicketsData : []);
      const { data: availableTickets, error: availableError } = await supabase
        .from('bingo_cards')
        .select('id, cells')
        .limit(count * 6);

      if (availableError) {
        console.error("Error getting available tickets:", availableError);
        return [];
      }
      const availableFormattedTickets: TicketData[] = [];

      if (availableTickets) {
        for (const ticket of availableTickets) {
          if (!assignedSerials.has(ticket.id) && availableFormattedTickets.length < count * 6) {
            const cells = ticket.cells as any;
            availableFormattedTickets.push({
              serial: ticket.id,
              perm: cells.perm || 1,
              position: cells.position || 1,
              layout_mask: cells.layout_mask || 0,
              numbers: cells.numbers || []
            });
          }
        }
      }

      const ticketsByPerm: Record<number, TicketData[]> = {};
      for (const ticket of availableFormattedTickets) {
        if (!ticketsByPerm[ticket.perm]) {
          ticketsByPerm[ticket.perm] = [];
        }
        ticketsByPerm[ticket.perm].push(ticket);
      }

      Object.values(ticketsByPerm).forEach(tickets =>
        tickets.sort((a, b) => a.position - b.position)
      );
      const result: TicketData[] = [];
      const permNumbers = Object.keys(ticketsByPerm).map(Number);
      for (let i = 0; i < count && i < permNumbers.length; i++) {
        const perm = ticketsByPerm[permNumbers[i]];
        if (perm && perm.length === 6) {
          result.push(...perm);
        }
      }
      return result;
    } catch (error) {
      console.error("Exception getting available tickets:", error);
      return [];
    }
  };

  // Assign tickets to player
  const assignTicketsToPlayer = async (playerId: string, sessionId: string, ticketCount: number): Promise<boolean> => {
    try {
      const { data: existingTicketsCount, error: checkError } = await supabase
        .rpc('get_player_assigned_tickets_count' as SupabaseRpcFunction, { 
          p_player_id: playerId, 
          p_session_id: sessionId 
        });
      if (checkError) {
        console.error("Error checking tickets count:", checkError);
        return false;
      }
      const ticketsCount = typeof existingTicketsCount === 'number' ? existingTicketsCount : 0;
      if (ticketsCount > 0) {
        console.log("Player already has tickets assigned");
        return true;
      }
      const availableTickets = await getAvailableTickets(sessionId, ticketCount);
      if (availableTickets.length < ticketCount * 6) {
        console.error(`Not enough available tickets: ${availableTickets.length} available, ${ticketCount * 6} needed`);
        return false;
      }
      const ticketsToInsert = availableTickets.map(ticket => ({
        player_id: playerId,
        session_id: sessionId,
        serial: ticket.serial,
        perm: ticket.perm,
        position: ticket.position,
        layout_mask: ticket.layout_mask,
        numbers: ticket.numbers
      }));
      const { error: insertError } = await supabase
        .rpc('insert_assigned_tickets' as SupabaseRpcFunction, { tickets: ticketsToInsert });
      if (insertError) {
        console.error("Error assigning tickets:", insertError);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Exception assigning tickets:", error);
      return false;
    }
  };

  // Fetch tickets assigned to a player
  const getPlayerAssignedTickets = async (playerId: string, sessionId: string): Promise<AssignedTicket[]> => {
    try {
      const { data, error } = await supabase
        .rpc('get_player_assigned_tickets' as SupabaseRpcFunction, { 
          p_player_id: playerId, 
          p_session_id: sessionId 
        });

      if (error) {
        console.error("Error getting assigned tickets:", error);
        return [];
      }
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Exception getting assigned tickets:", error);
      return [];
    }
  };

  return { assignTicketsToPlayer, getAvailableTickets, getPlayerAssignedTickets };
}
