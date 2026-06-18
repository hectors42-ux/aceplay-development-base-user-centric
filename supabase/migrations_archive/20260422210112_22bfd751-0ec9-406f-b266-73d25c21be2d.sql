
-- =========================================================================
-- 1) Enum extension: bookings.kind acepta 'torneo'
-- =========================================================================
ALTER TYPE booking_kind ADD VALUE IF NOT EXISTS 'torneo';

-- =========================================================================
-- 2) Enum nuevo para aceptación de partidos por jugadores
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE match_acceptance_status AS ENUM ('pending','accepted','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- 3) Tabla tournament_courts: canchas dedicadas a un torneo
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.tournament_courts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  court_id      uuid NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, court_id)
);
CREATE INDEX IF NOT EXISTS idx_tournament_courts_tournament ON public.tournament_courts(tournament_id);

ALTER TABLE public.tournament_courts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven canchas dedicadas de su club"
  ON public.tournament_courts FOR SELECT
  TO authenticated
  USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona canchas dedicadas"
  ON public.tournament_courts FOR ALL
  TO authenticated
  USING (is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (is_club_admin_of(auth.uid(), tenant_id));

-- =========================================================================
-- 4) Tabla tournament_phases: ventana por ronda
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.tournament_phases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tournament_id       uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round               integer NOT NULL,
  name                text NOT NULL,
  starts_on           date NOT NULL,
  ends_on             date NOT NULL,
  daily_window_start  time NOT NULL DEFAULT '08:00',
  daily_window_end    time NOT NULL DEFAULT '22:00',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, round)
);
CREATE INDEX IF NOT EXISTS idx_tournament_phases_tournament ON public.tournament_phases(tournament_id);

-- Validación con trigger (no CHECK porque puede involucrar lógica futura con now())
CREATE OR REPLACE FUNCTION public.tournament_phases_validate()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ends_on < NEW.starts_on THEN
    RAISE EXCEPTION 'ends_on debe ser >= starts_on';
  END IF;
  IF NEW.daily_window_end <= NEW.daily_window_start THEN
    RAISE EXCEPTION 'daily_window_end debe ser > daily_window_start';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tournament_phases_validate ON public.tournament_phases;
CREATE TRIGGER trg_tournament_phases_validate
  BEFORE INSERT OR UPDATE ON public.tournament_phases
  FOR EACH ROW EXECUTE FUNCTION public.tournament_phases_validate();

ALTER TABLE public.tournament_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven fases de su club"
  ON public.tournament_phases FOR SELECT
  TO authenticated
  USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona fases"
  ON public.tournament_phases FOR ALL
  TO authenticated
  USING (is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (is_club_admin_of(auth.uid(), tenant_id));

-- =========================================================================
-- 5) Columnas en tournament_matches: aceptación + cambio único
-- =========================================================================
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS acceptance_a   match_acceptance_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS acceptance_b   match_acceptance_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS accepted_at    timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_used boolean NOT NULL DEFAULT false;

-- =========================================================================
-- 6) RPC: accept_tournament_match
-- =========================================================================
CREATE OR REPLACE FUNCTION public.accept_tournament_match(_match_id uuid)
RETURNS public.tournament_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_match public.tournament_matches%ROWTYPE;
  v_reg_a public.tournament_registrations%ROWTYPE;
  v_reg_b public.tournament_registrations%ROWTYPE;
  v_is_a BOOLEAN := false;
  v_is_b BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no existe'; END IF;
  IF v_match.scheduled_at IS NULL THEN RAISE EXCEPTION 'Aún no programado'; END IF;
  IF v_match.status IN ('jugado','walkover','cancelado') THEN
    RAISE EXCEPTION 'El partido ya finalizó';
  END IF;

  IF v_match.registration_a_id IS NOT NULL THEN
    SELECT * INTO v_reg_a FROM public.tournament_registrations WHERE id = v_match.registration_a_id;
    IF v_user IN (v_reg_a.player1_user_id, v_reg_a.player2_user_id) THEN v_is_a := true; END IF;
  END IF;
  IF v_match.registration_b_id IS NOT NULL THEN
    SELECT * INTO v_reg_b FROM public.tournament_registrations WHERE id = v_match.registration_b_id;
    IF v_user IN (v_reg_b.player1_user_id, v_reg_b.player2_user_id) THEN v_is_b := true; END IF;
  END IF;
  IF NOT (v_is_a OR v_is_b) THEN
    RAISE EXCEPTION 'Solo los jugadores del partido pueden aceptar';
  END IF;

  IF v_is_a THEN
    UPDATE public.tournament_matches SET acceptance_a = 'accepted' WHERE id = _match_id;
  END IF;
  IF v_is_b THEN
    UPDATE public.tournament_matches SET acceptance_b = 'accepted' WHERE id = _match_id;
  END IF;

  -- Si ambos aceptaron, marcar accepted_at
  UPDATE public.tournament_matches
    SET accepted_at = COALESCE(accepted_at, now())
    WHERE id = _match_id
      AND acceptance_a = 'accepted'
      AND acceptance_b = 'accepted'
    RETURNING * INTO v_match;

  IF v_match.id IS NULL THEN
    SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  END IF;
  RETURN v_match;
END $$;

-- =========================================================================
-- 7) RPC: reject_tournament_match — rechaza y devuelve partido a 'pendiente'
-- =========================================================================
CREATE OR REPLACE FUNCTION public.reject_tournament_match(_match_id uuid, _reason text DEFAULT NULL)
RETURNS public.tournament_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_match public.tournament_matches%ROWTYPE;
  v_reg_a public.tournament_registrations%ROWTYPE;
  v_reg_b public.tournament_registrations%ROWTYPE;
  v_is_player BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no existe'; END IF;

  IF v_match.registration_a_id IS NOT NULL THEN
    SELECT * INTO v_reg_a FROM public.tournament_registrations WHERE id = v_match.registration_a_id;
    IF v_user IN (v_reg_a.player1_user_id, v_reg_a.player2_user_id) THEN v_is_player := true; END IF;
  END IF;
  IF NOT v_is_player AND v_match.registration_b_id IS NOT NULL THEN
    SELECT * INTO v_reg_b FROM public.tournament_registrations WHERE id = v_match.registration_b_id;
    IF v_user IN (v_reg_b.player1_user_id, v_reg_b.player2_user_id) THEN v_is_player := true; END IF;
  END IF;
  IF NOT v_is_player THEN
    RAISE EXCEPTION 'Solo los jugadores del partido pueden rechazar';
  END IF;

  -- Cancelar booking si existe; volver a 'pendiente' para que admin re-asigne
  IF v_match.booking_id IS NOT NULL THEN
    UPDATE public.bookings
      SET status = 'cancelada', cancelled_at = now(), cancelled_by = v_user
      WHERE id = v_match.booking_id;
  END IF;

  UPDATE public.tournament_matches
    SET status = 'pendiente',
        scheduled_at = NULL,
        court_id = NULL,
        booking_id = NULL,
        acceptance_a = 'pending',
        acceptance_b = 'pending',
        accepted_at = NULL
    WHERE id = _match_id
    RETURNING * INTO v_match;

  RETURN v_match;
END $$;

-- =========================================================================
-- 8) RPC modificado: schedule_match — set bookings.kind='torneo' y resetea aceptaciones
-- =========================================================================
CREATE OR REPLACE FUNCTION public.schedule_match(_match_id uuid, _starts_at timestamptz, _court_id uuid)
RETURNS public.tournament_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_match public.tournament_matches%ROWTYPE;
  v_court public.courts%ROWTYPE;
  v_ends_at TIMESTAMPTZ;
  v_old_booking UUID;
  v_new_booking public.bookings%ROWTYPE;
  v_in_dedicated INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El partido no existe'; END IF;
  IF NOT public.is_club_admin_of(v_user_id, v_match.tenant_id) THEN
    RAISE EXCEPTION 'Solo administradores pueden programar partidos';
  END IF;
  IF v_match.status IN ('jugado','walkover','cancelado') THEN
    RAISE EXCEPTION 'El partido ya finalizó';
  END IF;

  SELECT * INTO v_court FROM public.courts WHERE id = _court_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cancha no existe'; END IF;
  IF v_court.tenant_id <> v_match.tenant_id THEN
    RAISE EXCEPTION 'La cancha es de otro club';
  END IF;

  -- Si el torneo tiene canchas dedicadas, esta debe estar entre ellas
  SELECT COUNT(*) INTO v_in_dedicated
    FROM public.tournament_courts
    WHERE tournament_id = v_match.tournament_id;
  IF v_in_dedicated > 0 THEN
    PERFORM 1 FROM public.tournament_courts
      WHERE tournament_id = v_match.tournament_id AND court_id = _court_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Esta cancha no está dedicada al torneo';
    END IF;
  END IF;

  v_ends_at := _starts_at + (v_court.slot_minutes || ' minutes')::INTERVAL;

  v_old_booking := v_match.booking_id;
  IF v_old_booking IS NOT NULL THEN
    UPDATE public.bookings
      SET status = 'cancelada', cancelled_at = now(), cancelled_by = v_user_id
      WHERE id = v_old_booking;
  END IF;

  BEGIN
    INSERT INTO public.bookings (
      tenant_id, court_id, user_id, starts_at, ends_at, notes, kind
    ) VALUES (
      v_match.tenant_id, _court_id, v_user_id, _starts_at, v_ends_at,
      'Torneo: partido programado', 'torneo'
    ) RETURNING * INTO v_new_booking;
  EXCEPTION WHEN exclusion_violation THEN
    IF v_old_booking IS NOT NULL THEN
      UPDATE public.bookings SET status = 'confirmada', cancelled_at = NULL, cancelled_by = NULL WHERE id = v_old_booking;
    END IF;
    RAISE EXCEPTION 'La cancha ya está reservada en ese horario';
  END;

  UPDATE public.tournament_matches
    SET scheduled_at = _starts_at,
        court_id = _court_id,
        booking_id = v_new_booking.id,
        status = CASE WHEN status = 'pendiente' THEN 'programado' ELSE status END,
        acceptance_a = 'pending',
        acceptance_b = 'pending',
        accepted_at = NULL
    WHERE id = _match_id
    RETURNING * INTO v_match;

  RETURN v_match;
END $$;

-- =========================================================================
-- 9) RPC modificado: request_match_reschedule
--    - Falla si reschedule_used = true
--    - Si el torneo tiene canchas dedicadas y/o fases, las respeta
-- =========================================================================
CREATE OR REPLACE FUNCTION public.request_match_reschedule(_match_id uuid, _proposed_starts_at timestamptz, _proposed_court_id uuid)
RETURNS public.tournament_match_reschedule_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_match public.tournament_matches%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_court public.courts%ROWTYPE;
  v_phase public.tournament_phases%ROWTYPE;
  v_request public.tournament_match_reschedule_requests%ROWTYPE;
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_ends_at TIMESTAMPTZ;
  v_conflict BOOLEAN;
  v_in_dedicated INTEGER;
  v_proposed_date DATE;
  v_proposed_time TIME;
  v_tz TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El partido no existe'; END IF;
  IF NOT public.is_match_player(v_user_id, _match_id) THEN
    RAISE EXCEPTION 'Solo los jugadores pueden proponer reagendar';
  END IF;
  IF v_match.scheduled_at IS NULL THEN
    RAISE EXCEPTION 'El partido aún no está programado';
  END IF;
  IF v_match.status IN ('jugado','walkover','cancelado') THEN
    RAISE EXCEPTION 'El partido ya finalizó';
  END IF;
  IF v_match.reschedule_used THEN
    RAISE EXCEPTION 'Este partido ya fue reagendado una vez (límite alcanzado)';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;
  IF NOT v_tournament.reschedule_enabled THEN
    RAISE EXCEPTION 'El reagendamiento por jugadores está deshabilitado en este torneo';
  END IF;

  -- Anticipación mínima
  IF _proposed_starts_at < now() + (v_tournament.reschedule_min_notice_hours || ' hours')::INTERVAL THEN
    RAISE EXCEPTION 'Debes proponer con al menos % horas de anticipación', v_tournament.reschedule_min_notice_hours;
  END IF;

  -- Ventana: si hay fase para esta ronda, usarla; si no, fallback a ±window_hours
  SELECT * INTO v_phase FROM public.tournament_phases
    WHERE tournament_id = v_match.tournament_id AND round = v_match.round;
  IF FOUND THEN
    SELECT timezone INTO v_tz FROM public.tenants WHERE id = v_match.tenant_id;
    v_proposed_date := (_proposed_starts_at AT TIME ZONE COALESCE(v_tz,'America/Santiago'))::date;
    v_proposed_time := (_proposed_starts_at AT TIME ZONE COALESCE(v_tz,'America/Santiago'))::time;
    IF v_proposed_date < v_phase.starts_on OR v_proposed_date > v_phase.ends_on THEN
      RAISE EXCEPTION 'El horario propuesto está fuera de la fase (% a %)', v_phase.starts_on, v_phase.ends_on;
    END IF;
    IF v_proposed_time < v_phase.daily_window_start OR v_proposed_time >= v_phase.daily_window_end THEN
      RAISE EXCEPTION 'Hora fuera de la franja diaria (%-%)', v_phase.daily_window_start, v_phase.daily_window_end;
    END IF;
  ELSE
    v_window_start := v_match.scheduled_at - (v_tournament.reschedule_window_hours || ' hours')::INTERVAL;
    v_window_end := v_match.scheduled_at + (v_tournament.reschedule_window_hours || ' hours')::INTERVAL;
    IF _proposed_starts_at < v_window_start OR _proposed_starts_at > v_window_end THEN
      RAISE EXCEPTION 'El nuevo horario está fuera de la ventana permitida (±% horas)', v_tournament.reschedule_window_hours;
    END IF;
  END IF;

  SELECT * INTO v_court FROM public.courts WHERE id = _proposed_court_id;
  IF NOT FOUND OR v_court.tenant_id <> v_match.tenant_id THEN
    RAISE EXCEPTION 'Cancha inválida';
  END IF;

  -- Si torneo tiene canchas dedicadas, validar
  SELECT COUNT(*) INTO v_in_dedicated FROM public.tournament_courts WHERE tournament_id = v_match.tournament_id;
  IF v_in_dedicated > 0 THEN
    PERFORM 1 FROM public.tournament_courts
      WHERE tournament_id = v_match.tournament_id AND court_id = _proposed_court_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Esta cancha no está dedicada al torneo';
    END IF;
  END IF;

  v_ends_at := _proposed_starts_at + (v_court.slot_minutes || ' minutes')::INTERVAL;

  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE court_id = _proposed_court_id
      AND status = 'confirmada'
      AND id <> COALESCE(v_match.booking_id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(_proposed_starts_at, v_ends_at, '[)')
  ) INTO v_conflict;
  IF v_conflict THEN
    RAISE EXCEPTION 'La cancha ya está reservada en ese horario';
  END IF;

  -- Cancelar propuestas pendientes previas del mismo match
  UPDATE public.tournament_match_reschedule_requests
    SET status = 'cancelada', responded_at = now(), responded_by = v_user_id
    WHERE match_id = _match_id AND status = 'pendiente';

  INSERT INTO public.tournament_match_reschedule_requests (
    tenant_id, match_id, proposed_by, proposed_court_id, proposed_starts_at
  ) VALUES (
    v_match.tenant_id, _match_id, v_user_id, _proposed_court_id, _proposed_starts_at
  ) RETURNING * INTO v_request;

  RETURN v_request;
END $$;

-- =========================================================================
-- 10) RPC modificado: respond_match_reschedule
--     - Si _accept y aplica el cambio, marca reschedule_used = true
--     - Booking nuevo con kind='torneo'
--     - Resetea acceptance_* a pending para que ambos confirmen el nuevo horario
-- =========================================================================
CREATE OR REPLACE FUNCTION public.respond_match_reschedule(_request_id uuid, _accept boolean, _reason text DEFAULT NULL)
RETURNS public.tournament_match_reschedule_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request public.tournament_match_reschedule_requests%ROWTYPE;
  v_match public.tournament_matches%ROWTYPE;
  v_court public.courts%ROWTYPE;
  v_ends_at TIMESTAMPTZ;
  v_is_admin BOOLEAN;
  v_is_opponent BOOLEAN;
  v_new_booking public.bookings%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_request FROM public.tournament_match_reschedule_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_request.status <> 'pendiente' THEN RAISE EXCEPTION 'La solicitud no está pendiente'; END IF;

  v_is_admin := public.is_club_admin_of(v_user_id, v_request.tenant_id);
  v_is_opponent := public.is_match_player(v_user_id, v_request.match_id) AND v_user_id <> v_request.proposed_by;
  IF NOT (v_is_admin OR v_is_opponent) THEN
    RAISE EXCEPTION 'Solo el rival o un admin pueden responder';
  END IF;

  IF NOT _accept THEN
    UPDATE public.tournament_match_reschedule_requests
      SET status = 'rechazada', responded_by = v_user_id, responded_at = now(), reject_reason = _reason
      WHERE id = _request_id
      RETURNING * INTO v_request;
    RETURN v_request;
  END IF;

  SELECT * INTO v_match FROM public.tournament_matches WHERE id = v_request.match_id;
  IF v_match.reschedule_used THEN
    RAISE EXCEPTION 'Este partido ya fue reagendado una vez';
  END IF;

  SELECT * INTO v_court FROM public.courts WHERE id = v_request.proposed_court_id;
  v_ends_at := v_request.proposed_starts_at + (v_court.slot_minutes || ' minutes')::INTERVAL;

  IF v_match.booking_id IS NOT NULL THEN
    UPDATE public.bookings
      SET status = 'cancelada', cancelled_at = now(), cancelled_by = v_user_id
      WHERE id = v_match.booking_id;
  END IF;

  BEGIN
    INSERT INTO public.bookings (
      tenant_id, court_id, user_id, starts_at, ends_at, notes, kind
    ) VALUES (
      v_match.tenant_id, v_request.proposed_court_id, v_user_id,
      v_request.proposed_starts_at, v_ends_at,
      'Torneo: partido reagendado', 'torneo'
    ) RETURNING * INTO v_new_booking;

    UPDATE public.tournament_matches
      SET scheduled_at = v_request.proposed_starts_at,
          court_id = v_request.proposed_court_id,
          booking_id = v_new_booking.id,
          reschedule_used = true,
          acceptance_a = 'pending',
          acceptance_b = 'pending',
          accepted_at = NULL
      WHERE id = v_match.id;
  EXCEPTION WHEN exclusion_violation THEN
    IF v_match.booking_id IS NOT NULL THEN
      UPDATE public.bookings SET status = 'confirmada', cancelled_at = NULL, cancelled_by = NULL WHERE id = v_match.booking_id;
    END IF;
    RAISE EXCEPTION 'La cancha ya no está disponible';
  END;

  UPDATE public.tournament_match_reschedule_requests
    SET status = 'aceptada', responded_by = v_user_id, responded_at = now()
    WHERE id = _request_id
    RETURNING * INTO v_request;

  RETURN v_request;
END $$;

-- =========================================================================
-- 11) RPC: get_tournament_reschedule_slots
--     Devuelve huecos válidos (cancha + datetime) dentro de la fase y canchas
--     dedicadas del torneo del partido.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_tournament_reschedule_slots(_match_id uuid)
RETURNS TABLE (court_id uuid, court_name text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_match public.tournament_matches%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_phase public.tournament_phases%ROWTYPE;
  v_tz TEXT;
  v_min_notice INTERVAL;
  v_day DATE;
  v_court RECORD;
  v_window_start_local TIME;
  v_window_end_local TIME;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_has_dedicated INTEGER;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partido no existe'; END IF;
  IF NOT public.is_match_player(v_user, _match_id) AND NOT public.is_club_admin_of(v_user, v_match.tenant_id) THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;
  v_min_notice := (v_tournament.reschedule_min_notice_hours || ' hours')::INTERVAL;
  SELECT timezone INTO v_tz FROM public.tenants WHERE id = v_match.tenant_id;
  v_tz := COALESCE(v_tz, 'America/Santiago');

  SELECT * INTO v_phase FROM public.tournament_phases
    WHERE tournament_id = v_match.tournament_id AND round = v_match.round;

  -- ¿Hay canchas dedicadas?
  SELECT COUNT(*) INTO v_has_dedicated FROM public.tournament_courts WHERE tournament_id = v_match.tournament_id;

  -- Iterar días de la fase (o ±window_hours alrededor de scheduled_at si no hay fase)
  FOR v_day IN
    SELECT generate_series(
      CASE WHEN v_phase.id IS NOT NULL THEN v_phase.starts_on
           ELSE GREATEST(current_date, (v_match.scheduled_at - (v_tournament.reschedule_window_hours||' hours')::interval)::date) END,
      CASE WHEN v_phase.id IS NOT NULL THEN v_phase.ends_on
           ELSE (v_match.scheduled_at + (v_tournament.reschedule_window_hours||' hours')::interval)::date END,
      INTERVAL '1 day'
    )::date
  LOOP
    -- Iterar canchas elegibles
    FOR v_court IN
      SELECT c.id, c.name, c.slot_minutes, c.opens_at, c.closes_at
      FROM public.courts c
      WHERE c.tenant_id = v_match.tenant_id
        AND c.is_active = true
        AND (
          v_has_dedicated = 0
          OR EXISTS (SELECT 1 FROM public.tournament_courts tc WHERE tc.tournament_id = v_match.tournament_id AND tc.court_id = c.id)
        )
      ORDER BY c.sort_order, c.name
    LOOP
      v_window_start_local := GREATEST(v_court.opens_at, COALESCE(v_phase.daily_window_start, v_court.opens_at));
      v_window_end_local   := LEAST(v_court.closes_at, COALESCE(v_phase.daily_window_end, v_court.closes_at));

      v_slot_start := ((v_day::text || ' ' || v_window_start_local::text)::timestamp AT TIME ZONE v_tz);
      WHILE v_slot_start::time AT TIME ZONE v_tz < v_window_end_local LOOP
        EXIT WHEN ((v_slot_start AT TIME ZONE v_tz)::time + (v_court.slot_minutes||' minutes')::interval)::time > v_window_end_local;
        v_slot_end := v_slot_start + (v_court.slot_minutes || ' minutes')::INTERVAL;

        -- Filtros: anticipación mínima y no choque con bookings existentes (excepto el del propio match)
        IF v_slot_start >= now() + v_min_notice
           AND NOT EXISTS (
             SELECT 1 FROM public.bookings b
             WHERE b.court_id = v_court.id
               AND b.status = 'confirmada'
               AND b.id <> COALESCE(v_match.booking_id, '00000000-0000-0000-0000-000000000000'::uuid)
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

-- Permisos: cualquiera autenticado puede llamar (la función valida adentro)
GRANT EXECUTE ON FUNCTION public.accept_tournament_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_tournament_match(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tournament_reschedule_slots(uuid) TO authenticated;
