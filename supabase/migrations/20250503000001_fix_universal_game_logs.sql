
-- This migration fixes the universal_game_logs table to allow NULL values for validated_at
ALTER TABLE public.universal_game_logs ALTER COLUMN validated_at DROP NOT NULL;

-- Add a trigger to ensure validated_at is either NULL or has a valid timestamp
CREATE OR REPLACE FUNCTION public.validate_game_log_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- If validated_at is provided, ensure it's properly formatted
  IF NEW.validated_at IS NOT NULL AND NOT INSTR(NEW.validated_at::TEXT, '+') > 0 THEN
    NEW.validated_at := NEW.validated_at AT TIME ZONE 'UTC';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_game_log_timestamps_trigger
BEFORE INSERT OR UPDATE ON public.universal_game_logs
FOR EACH ROW EXECUTE FUNCTION public.validate_game_log_timestamps();
