
// Custom type for our Supabase RPC function names to fix TypeScript errors
export type SupabaseRpcFunction = 
  | "is_superuser" 
  | "get_player_assigned_tickets_count"
  | "get_assigned_ticket_serials_by_session"
  | "insert_assigned_tickets"
  | "get_player_assigned_tickets";
