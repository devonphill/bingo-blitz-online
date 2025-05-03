
-- Create a function to get pending claims for a session
CREATE OR REPLACE FUNCTION public.get_pending_claims(p_session_id UUID)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT jsonb_build_object(
    'id', lg.id,
    'player_id', lg.player_id,
    'player_name', lg.player_name,
    'session_id', lg.session_id,
    'game_number', lg.game_number,
    'ticket_id', lg.ticket_serial,
    'ticket_serial', lg.ticket_serial,
    'status', 'pending',
    'created_at', lg.claimed_at
  )
  FROM public.universal_game_logs lg
  WHERE lg.session_id = p_session_id
  AND lg.validated_at IS NULL
  ORDER BY lg.claimed_at DESC;
END;
$$;
