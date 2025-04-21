
-- Function to get the count of assigned tickets for a player in a session
CREATE OR REPLACE FUNCTION public.get_player_assigned_tickets_count(p_player_id UUID, p_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.assigned_tickets
  WHERE player_id = p_player_id AND session_id = p_session_id;
  
  RETURN v_count;
END;
$$;

-- Function to get assigned ticket serials for a session
CREATE OR REPLACE FUNCTION public.get_assigned_ticket_serials_by_session(p_session_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_serials TEXT[];
BEGIN
  SELECT ARRAY_AGG(serial) INTO v_serials
  FROM public.assigned_tickets
  WHERE session_id = p_session_id;
  
  RETURN v_serials;
END;
$$;

-- Function to get player's assigned tickets
CREATE OR REPLACE FUNCTION public.get_player_assigned_tickets(p_player_id UUID, p_session_id UUID)
RETURNS SETOF public.assigned_tickets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.assigned_tickets
  WHERE player_id = p_player_id AND session_id = p_session_id
  ORDER BY perm, position;
END;
$$;

-- Function to insert assigned tickets
CREATE OR REPLACE FUNCTION public.insert_assigned_tickets(tickets jsonb[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  FOR i IN 1..array_length(tickets, 1) LOOP
    INSERT INTO public.assigned_tickets (
      player_id,
      session_id,
      serial,
      perm,
      position,
      layout_mask,
      numbers
    )
    VALUES (
      (tickets[i]->>'player_id')::uuid,
      (tickets[i]->>'session_id')::uuid,
      tickets[i]->>'serial',
      (tickets[i]->>'perm')::integer,
      (tickets[i]->>'position')::integer,
      (tickets[i]->>'layout_mask')::integer,
      (tickets[i]->'numbers')::integer[]
    );
  END LOOP;
END;
$$;
