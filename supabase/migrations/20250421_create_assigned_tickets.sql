
-- Create a new table for assigned tickets
CREATE TABLE IF NOT EXISTS public.assigned_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  serial TEXT NOT NULL,
  perm INTEGER NOT NULL,
  position INTEGER NOT NULL,
  layout_mask INTEGER NOT NULL,
  numbers INTEGER[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(player_id, session_id, perm, position), -- Ensure unique assignment per player within a session
  UNIQUE(session_id, serial) -- Ensure a ticket is only assigned once per session
);

-- Add an index for faster queries
CREATE INDEX IF NOT EXISTS idx_assigned_tickets_player_id ON public.assigned_tickets(player_id);
CREATE INDEX IF NOT EXISTS idx_assigned_tickets_session_id ON public.assigned_tickets(session_id);

-- Enable Row Level Security
ALTER TABLE public.assigned_tickets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Players can view their own assigned tickets"
  ON public.assigned_tickets
  FOR SELECT
  USING (true); -- For now, allow all authenticated users to view tickets for development purposes

-- Create policy that prevents duplicate assignments
CREATE POLICY "No duplicate ticket assignments within a session"
  ON public.assigned_tickets
  FOR INSERT
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.assigned_tickets
      WHERE 
        session_id = NEW.session_id AND
        serial = NEW.serial
    )
  );

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.assigned_tickets;
ALTER TABLE public.assigned_tickets REPLICA IDENTITY FULL;
