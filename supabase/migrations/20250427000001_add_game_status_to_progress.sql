
-- Add game_status column to sessions_progress table
ALTER TABLE public.sessions_progress
ADD COLUMN IF NOT EXISTS game_status TEXT DEFAULT 'pending';
