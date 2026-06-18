
CREATE OR REPLACE FUNCTION public.block_tournament_session(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.tournament_sessions%ROWTYPE;
  _court uuid;
BEGIN
  SELECT * INTO s FROM public.tournament_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no encontrada'; END IF;

  IF NOT (public.has_role(auth.uid(), 'club_admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Solo administradores pueden bloquear canchas';
  END IF;

  DELETE FROM public.bookings WHERE block_reason = _session_id::text;

  FOREACH _court IN ARRAY s.court_ids LOOP
    INSERT INTO public.bookings (tenant_id, court_id, user_id, starts_at, ends_at, status, kind, block_reason, notes)
    VALUES (s.tenant_id, _court, auth.uid(), s.starts_at, s.ends_at,
            'confirmada'::booking_status, 'torneo'::booking_kind, _session_id::text, s.block_label);
  END LOOP;

  UPDATE public.tournament_sessions SET status = 'bloqueada', updated_at = now() WHERE id = _session_id;

  INSERT INTO public.tournament_events (tournament_id, tenant_id, kind, payload, actor)
  VALUES (s.tournament_id, s.tenant_id, 'session_blocked',
          jsonb_build_object('session_id', _session_id, 'court_count', array_length(s.court_ids,1)),
          auth.uid());
END;
$$;
