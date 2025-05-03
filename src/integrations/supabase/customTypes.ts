
// Custom type for our Supabase RPC function names to fix TypeScript errors
export type SupabaseRpcFunction = 
  | "is_superuser" 
  | "get_player_assigned_tickets_count"
  | "get_assigned_ticket_serials_by_session"
  | "insert_assigned_tickets"
  | "get_player_assigned_tickets"
  | "get_available_bingo_tickets"
  | "get_available_tickets_for_session"
  | "get_player_bingo_tickets"
  | "get_player_bingo_tickets_count"
  | "get_bingo_ticket_serials_by_session"
  | "insert_bingo_tickets"
  | "get_pending_claims";

// Helper type for assigned ticket response
export interface AssignedTicketResponse {
  id: string;
  player_id: string;
  session_id: string;
  serial: string;
  perm: number;
  position: number;
  layout_mask: number;
  numbers: number[];
  time_stamp: string;
}
