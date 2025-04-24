-- Remove the old global win_patterns table as it's replaced by game rule defaults
-- and storing active patterns within the session's current_game_state JSONB
DROP TABLE IF EXISTS public.win_patterns;

-- Optional: If you had related types or functions based on this table, drop them too.
-- Example: DROP TYPE IF EXISTS ...;
-- Example: DROP FUNCTION IF EXISTS ...;