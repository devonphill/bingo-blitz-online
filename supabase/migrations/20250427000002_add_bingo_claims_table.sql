
-- Create bingo_claims table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.bingo_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id),
  player_id UUID NOT NULL REFERENCES public.players(id),
  game_number INTEGER NOT NULL,
  pattern_id TEXT NOT NULL, 
  ticket_serial TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  validated_at TIMESTAMP WITH TIME ZONE,
  called_numbers INTEGER[] DEFAULT '{}',
  ticket_numbers INTEGER[] DEFAULT '{}'
);

-- Add RLS policies
ALTER TABLE public.bingo_claims ENABLE ROW LEVEL SECURITY;

-- Everyone can read claims
CREATE POLICY "Anyone can read claims" 
ON public.bingo_claims FOR SELECT 
TO authenticated, anon
USING (true);

-- Only authenticated users can insert claims
CREATE POLICY "Authenticated users can insert claims" 
ON public.bingo_claims FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Only superusers can update claims
CREATE POLICY "Only superusers can update claims" 
ON public.bingo_claims FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superuser'
  )
);
