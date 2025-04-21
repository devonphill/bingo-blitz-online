
import { supabase } from "@/integrations/supabase/client";
import { AssignedTicketResponse } from "@/integrations/supabase/customTypes";

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
  // Get available tickets for assignment by checking unassigned perms
  const getAvailableTickets = async (sessionId: string, count: number): Promise<TicketData[]> => {
    try {
      // Get already-assigned perm numbers for this session
      const { data: assignedPermsData, error: assignedError } = await supabase
        .from('assigned_tickets')
        .select('perm')
        .eq('session_id', sessionId)
        .distinctOn('perm');

      if (assignedError) {
        console.error("Error getting assigned perms:", assignedError);
        return [];
      }

      // Create a set of assigned perm numbers
      const assignedPerms = new Set();
      if (assignedPermsData && assignedPermsData.length > 0) {
        assignedPermsData.forEach(item => assignedPerms.add(item.perm));
      }
      
      console.log("Assigned perms:", Array.from(assignedPerms));

      // Get all available distinct perm numbers from bingo_tickets
      const { data: availablePermsData, error: permsError } = await supabase
        .from('bingo_tickets')
        .select('perm')
        .distinctOn('perm');

      if (permsError) {
        console.error("Error getting available perms:", permsError);
        return [];
      }

      // Filter out perms that are already assigned
      const availablePerms: number[] = [];
      if (availablePermsData && availablePermsData.length > 0) {
        availablePermsData.forEach(item => {
          if (!assignedPerms.has(item.perm)) {
            availablePerms.push(item.perm);
          }
        });
      }
      
      console.log("Available perms:", availablePerms);

      // Randomly select 'count' perms from available perms
      const selectedPerms: number[] = [];
      for (let i = 0; i < count && availablePerms.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availablePerms.length);
        selectedPerms.push(availablePerms[randomIndex]);
        availablePerms.splice(randomIndex, 1); // Remove selected perm
      }
      
      console.log("Selected perms:", selectedPerms);

      // Get all tickets for the selected perms
      const availableTickets: TicketData[] = [];
      for (const perm of selectedPerms) {
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('bingo_tickets')
          .select('serial, perm, position, layout_mask, numbers')
          .eq('perm', perm)
          .order('position');

        if (ticketsError) {
          console.error(`Error getting tickets for perm ${perm}:`, ticketsError);
          continue;
        }

        if (ticketsData && ticketsData.length > 0) {
          ticketsData.forEach(ticket => {
            availableTickets.push({
              serial: ticket.serial,
              perm: ticket.perm,
              position: ticket.position,
              layout_mask: ticket.layout_mask,
              numbers: ticket.numbers
            });
          });
        }
      }
      
      console.log(`Selected ${availableTickets.length} tickets for assignment`);
      return availableTickets;
    } catch (error) {
      console.error("Exception getting available tickets:", error);
      return [];
    }
  };

  // Assign tickets to player
  const assignTicketsToPlayer = async (playerId: string, sessionId: string, ticketCount: number): Promise<boolean> => {
    try {
      console.log(`Assigning ${ticketCount} tickets to player ${playerId} in session ${sessionId}`);
      
      // Check if player already has tickets assigned
      const { data: existingTicketsData, error: checkError } = await supabase
        .from('assigned_tickets')
        .select('perm')
        .eq('player_id', playerId)
        .eq('session_id', sessionId)
        .distinctOn('perm');

      if (checkError) {
        console.error("Error checking tickets count:", checkError);
        return false;
      }

      // Get the number of unique perm values (strips) assigned to this player
      const ticketsAssignedCount = existingTicketsData ? existingTicketsData.length : 0;
      console.log(`Player has ${ticketsAssignedCount} strips already assigned`);
      
      if (ticketsAssignedCount >= ticketCount) {
        console.log("Player already has enough tickets assigned");
        return true;
      }

      // Calculate how many more strips need to be assigned
      const additionalTicketsNeeded = ticketCount - ticketsAssignedCount;
      console.log(`Need to assign ${additionalTicketsNeeded} more strips`);
      
      // Get available tickets
      const availableTickets = await getAvailableTickets(sessionId, additionalTicketsNeeded);

      if (availableTickets.length === 0) {
        console.error("No available tickets found");
        return false;
      }

      console.log(`Found ${availableTickets.length} tickets to assign`);

      // Insert tickets into assigned_tickets table
      for (const ticket of availableTickets) {
        const { error: insertError } = await supabase
          .from('assigned_tickets')
          .insert({
            player_id: playerId,
            session_id: sessionId,
            serial: ticket.serial,
            perm: ticket.perm,
            position: ticket.position,
            layout_mask: ticket.layout_mask,
            numbers: ticket.numbers
          });

        if (insertError) {
          console.error(`Error inserting ticket ${ticket.serial}:`, insertError);
        }
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
        .from('assigned_tickets')
        .select('*')
        .eq('player_id', playerId)
        .eq('session_id', sessionId)
        .order('perm, position');

      if (error) {
        console.error("Error getting assigned tickets:", error);
        return [];
      }

      // Convert the response to our expected AssignedTicket type
      return Array.isArray(data)
        ? data.map((t) => ({
            id: t.id,
            player_id: t.player_id,
            session_id: t.session_id,
            serial: t.serial,
            perm: t.perm,
            position: t.position,
            layout_mask: t.layout_mask,
            numbers: t.numbers,
            created_at: t.created_at
          }))
        : [];
    } catch (error) {
      console.error("Exception getting assigned tickets:", error);
      return [];
    }
  };

  return { assignTicketsToPlayer, getAvailableTickets, getPlayerAssignedTickets };
}
