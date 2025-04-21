
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
      console.log("Checking for assigned ticket serials in session:", sessionId);
      // First, check if the RPC function exists by capturing the error
      const { data: assignedTicketsData, error: assignedError } = await supabase
        .rpc('get_assigned_ticket_serials_by_session' as SupabaseRpcFunction, { 
          p_session_id: sessionId 
        });

      if (assignedError) {
        console.error("Error getting assigned tickets:", assignedError);
        // If there's an error with the RPC function, check if it's because the function doesn't exist
        if (assignedError.message.includes("function") && assignedError.message.includes("does not exist")) {
          console.error("RPC function doesn't exist. Database migrations may not have been applied.");
        }
        return [];
      }

      console.log("Assigned tickets data:", assignedTicketsData);
      const assignedSerials = new Set(Array.isArray(assignedTicketsData) ? assignedTicketsData : []);
      
      console.log("Fetching available tickets from bingo_cards table");
      // Check if the bingo_cards table exists and has data
      const { data: availableTickets, error: availableError } = await supabase
        .from('bingo_cards')
        .select('id, cells')
        .limit(count * 6);

      if (availableError) {
        console.error("Error getting available tickets:", availableError);
        if (availableError.message.includes("relation") && availableError.message.includes("does not exist")) {
          console.error("bingo_cards table doesn't exist. Database might not be properly set up.");
        }
        return [];
      }

      console.log("Available tickets from database:", availableTickets);
      const availableFormattedTickets: TicketData[] = [];

      if (availableTickets && availableTickets.length > 0) {
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
      } else {
        console.warn("No tickets available in the bingo_cards table");
      }

      // Group tickets by perm and arrange them
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
      
      console.log(`Returning ${result.length} formatted tickets`);
      return result;
    } catch (error) {
      console.error("Exception getting available tickets:", error);
      return [];
    }
  };

  // Assign tickets to player
  const assignTicketsToPlayer = async (playerId: string, sessionId: string, ticketCount: number): Promise<boolean> => {
    try {
      console.log(`Checking if player ${playerId} already has tickets in session ${sessionId}`);
      // First check if the assigned_tickets table and RPC functions exist
      const { data: existingTicketsCount, error: checkError } = await supabase
        .rpc('get_player_assigned_tickets_count' as SupabaseRpcFunction, { 
          p_player_id: playerId, 
          p_session_id: sessionId 
        });

      if (checkError) {
        console.error("Error checking tickets count:", checkError);
        if (checkError.message.includes("function") && checkError.message.includes("does not exist")) {
          console.error("RPC function doesn't exist. Database migrations may not have been applied.");
        }
        return false;
      }

      // Check if the player already has tickets (ensure existingTicketsCount is a number)
      const ticketsCount = typeof existingTicketsCount === 'number' ? existingTicketsCount : 0;
      console.log(`Player has ${ticketsCount} existing tickets`);
      
      if (ticketsCount > 0) {
        console.log("Player already has tickets assigned");
        return true;
      }

      console.log(`Getting ${ticketCount} available tickets for assignment`);
      const availableTickets = await getAvailableTickets(sessionId, ticketCount);
      
      if (availableTickets.length < ticketCount * 6) {
        console.error(`Not enough available tickets: ${availableTickets.length} available, ${ticketCount * 6} needed`);
        return false;
      }

      // Use an RPC function to insert the tickets
      const ticketsToInsert = availableTickets.map(ticket => ({
        player_id: playerId,
        session_id: sessionId,
        serial: ticket.serial,
        perm: ticket.perm,
        position: ticket.position,
        layout_mask: ticket.layout_mask,
        numbers: ticket.numbers
      }));

      console.log(`Inserting ${ticketsToInsert.length} tickets for player`);
      const { error: insertError } = await supabase
        .rpc('insert_assigned_tickets' as SupabaseRpcFunction, { tickets: ticketsToInsert });

      if (insertError) {
        console.error("Error assigning tickets:", insertError);
        if (insertError.message.includes("function") && insertError.message.includes("does not exist")) {
          console.error("RPC function doesn't exist. Database migrations may not have been applied.");
        }
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
      console.log(`Fetching assigned tickets for player ${playerId} in session ${sessionId}`);
      // Use an RPC function to get the player's assigned tickets
      const { data, error } = await supabase
        .rpc('get_player_assigned_tickets' as SupabaseRpcFunction, { 
          p_player_id: playerId, 
          p_session_id: sessionId 
        });

      if (error) {
        console.error("Error getting assigned tickets:", error);
        if (error.message.includes("function") && error.message.includes("does not exist")) {
          console.error("RPC function doesn't exist. Database migrations may not have been applied.");
        }
        return [];
      }

      console.log(`Retrieved ${Array.isArray(data) ? data.length : 0} assigned tickets`);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Exception getting assigned tickets:", error);
      return [];
    }
  };

  return { assignTicketsToPlayer, getAvailableTickets, getPlayerAssignedTickets };
}
