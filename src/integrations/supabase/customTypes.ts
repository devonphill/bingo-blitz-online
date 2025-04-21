
// Custom types for Supabase RPC functions
export type SupabaseRpcFunction = 
  | "is_superuser"
  | "get_player_assigned_tickets_count" 
  | "get_assigned_ticket_serials_by_session" 
  | "insert_assigned_tickets" 
  | "get_player_assigned_tickets";

// Add this file to extend Supabase's types with our custom RPC functions
