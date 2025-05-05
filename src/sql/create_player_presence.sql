
-- Create a table for tracking player presence
CREATE TABLE IF NOT EXISTS public.player_presence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  player_code text NOT NULL,
  nickname text,
  last_seen_at timestamp with time zone DEFAULT now(),
  UNIQUE(session_id, player_id)
);

-- Enable row-level security on the table
ALTER TABLE public.player_presence ENABLE ROW LEVEL SECURITY;

-- Allow anyone to select from this table
CREATE POLICY "Anyone can view player presence" 
  ON public.player_presence 
  FOR SELECT 
  USING (true);

-- Allow authenticated users to insert/update presence records
CREATE POLICY "Authenticated users can insert presence" 
  ON public.player_presence 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Allow authenticated users to update their own presence
CREATE POLICY "Authenticated users can update presence" 
  ON public.player_presence 
  FOR UPDATE 
  TO authenticated 
  USING (true);

-- Enable realtime for the player_presence table
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_presence;
