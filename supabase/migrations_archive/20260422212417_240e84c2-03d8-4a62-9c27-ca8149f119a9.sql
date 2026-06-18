
-- RPC: huecos disponibles para una ronda específica del torneo (auto-scheduling al generar la llave)
CREATE OR REPLACE FUNCTION public.get_tournament_phase_slots(_tournament_id uuid, _round integer)
RETURNS TABLE (court_id uuid, court_name text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_tournament public.tournaments%ROWTYPE;
  v_phase public.tournament_phases%ROWTYPE;
  v_tz TEXT;
  v_day DATE;
  v_court RECORD;
  v_window_start_local TIME;
  v_window_end_local TIME;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_has_dedicated INTEGER;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = _tournament_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Torneo no existe'; END IF;
  IF NOT (public.is_club_admin_of(v_user, v_tournament.tenant_id) OR public.user_tenant_id(v_user) = v_tournament.tenant_id) THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  SELECT timezone INTO v_tz FROM public.tenants WHERE id = v_tournament.tenant_id;
  v_tz := COALESCE(v_tz, 'America/Santiago');

  SELECT * INTO v_phase FROM public.tournament_phases
    WHERE tournament_id = _tournament_id AND round = _round;

  IF v_phase.id IS NOT NULL THEN
    v_start_date := GREATEST(current_date, v_phase.starts_on);
    v_end_date := v_phase.ends_on;
  ELSE
    -- Fallback: usar la ventana del torneo
    v_start_date := GREATEST(current_date, v_tournament.starts_at::date);
    v_end_date := v_tournament.ends_at::date;
  END IF;

  IF v_start_date > v_end_date THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_has_dedicated FROM public.tournament_courts WHERE tournament_id = _tournament_id;

  FOR v_day IN SELECT generate_series(v_start_date, v_end_date, INTERVAL '1 day')::date
  LOOP
    FOR v_court IN
      SELECT c.id, c.name, c.slot_minutes, c.opens_at, c.closes_at
      FROM public.courts c
      WHERE c.tenant_id = v_tournament.tenant_id
        AND c.is_active = true
        AND (
          v_has_dedicated = 0
          OR EXISTS (SELECT 1 FROM public.tournament_courts tc WHERE tc.tournament_id = _tournament_id AND tc.court_id = c.id)
        )
      ORDER BY c.sort_order, c.name
    LOOP
      v_window_start_local := GREATEST(v_court.opens_at, COALESCE(v_phase.daily_window_start, v_court.opens_at));
      v_window_end_local   := LEAST(v_court.closes_at, COALESCE(v_phase.daily_window_end, v_court.closes_at));

      v_slot_start := ((v_day::text || ' ' || v_window_start_local::text)::timestamp AT TIME ZONE v_tz);
      WHILE TRUE LOOP
        v_slot_end := v_slot_start + (v_court.slot_minutes || ' minutes')::INTERVAL;
        EXIT WHEN ((v_slot_end AT TIME ZONE v_tz)::time > v_window_end_local AND (v_slot_end AT TIME ZONE v_tz)::date = v_day);
        EXIT WHEN (v_slot_start AT TIME ZONE v_tz)::date <> v_day;

        IF v_slot_start >= now()
           AND NOT EXISTS (
             SELECT 1 FROM public.bookings b
             WHERE b.court_id = v_court.id
               AND b.status = 'confirmada'
               AND tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(v_slot_start, v_slot_end, '[)')
           )
        THEN
          court_id := v_court.id;
          court_name := v_court.name;
          starts_at := v_slot_start;
          ends_at := v_slot_end;
          RETURN NEXT;
        END IF;

        v_slot_start := v_slot_start + (v_court.slot_minutes || ' minutes')::INTERVAL;
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN;
END $$;

GRANT EXECUTE ON FUNCTION public.get_tournament_phase_slots(uuid, integer) TO authenticated;
