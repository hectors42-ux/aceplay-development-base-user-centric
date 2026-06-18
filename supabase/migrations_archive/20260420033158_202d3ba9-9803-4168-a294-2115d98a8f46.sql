-- 1. Add partner_user_id column (nullable for legacy data)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS partner_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_bookings_partner_user_id ON public.bookings(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_starts ON public.bookings(user_id, starts_at);

-- 2. Replace create_booking to require partner
CREATE OR REPLACE FUNCTION public.create_booking(
  _court_id uuid,
  _starts_at timestamptz,
  _partner_user_id uuid,
  _notes text DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _court public.courts;
  _user_tenant uuid;
  _partner_tenant uuid;
  _ends_at timestamptz;
  _new public.bookings;
  _conflict_count int;
  _partner_conflict int;
  _rules public.booking_rules;
  _active_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF _partner_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes seleccionar un compañero/a para reservar';
  END IF;

  IF _partner_user_id = auth.uid() THEN
    RAISE EXCEPTION 'El compañero debe ser otro socio, no tú mismo';
  END IF;

  SELECT * INTO _court FROM public.courts WHERE id = _court_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cancha no encontrada o inactiva';
  END IF;

  SELECT tenant_id INTO _user_tenant FROM public.profiles WHERE user_id = auth.uid();
  SELECT tenant_id INTO _partner_tenant FROM public.profiles WHERE user_id = _partner_user_id;

  IF _user_tenant IS NULL OR _user_tenant <> _court.tenant_id THEN
    RAISE EXCEPTION 'No perteneces al club de esta cancha';
  END IF;

  IF _partner_tenant IS NULL OR _partner_tenant <> _user_tenant THEN
    RAISE EXCEPTION 'El compañero debe ser socio del mismo club';
  END IF;

  _ends_at := _starts_at + make_interval(mins => _court.slot_minutes);

  IF _starts_at < now() THEN
    RAISE EXCEPTION 'No puedes reservar en el pasado';
  END IF;

  SELECT * INTO _rules FROM public.booking_rules WHERE tenant_id = _user_tenant;
  IF FOUND THEN
    IF _starts_at > now() + make_interval(days => _rules.max_advance_days) THEN
      RAISE EXCEPTION 'No puedes reservar con más de % días de anticipación', _rules.max_advance_days;
    END IF;
    SELECT count(*) INTO _active_count
      FROM public.bookings
      WHERE user_id = auth.uid()
        AND status = 'confirmada'
        AND ends_at > now();
    IF _active_count >= _rules.max_active_bookings THEN
      RAISE EXCEPTION 'Ya tienes el máximo de reservas activas (%)', _rules.max_active_bookings;
    END IF;
  END IF;

  SELECT count(*) INTO _conflict_count
    FROM public.bookings
    WHERE court_id = _court_id
      AND status = 'confirmada'
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(_starts_at, _ends_at, '[)');
  IF _conflict_count > 0 THEN
    RAISE EXCEPTION 'La cancha ya está reservada en ese horario';
  END IF;

  SELECT count(*) INTO _partner_conflict
    FROM public.bookings
    WHERE status = 'confirmada'
      AND (user_id = _partner_user_id OR partner_user_id = _partner_user_id)
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(_starts_at, _ends_at, '[)');
  IF _partner_conflict > 0 THEN
    RAISE EXCEPTION 'Tu compañero ya tiene una reserva en ese horario';
  END IF;

  SELECT count(*) INTO _partner_conflict
    FROM public.bookings
    WHERE status = 'confirmada'
      AND (user_id = auth.uid() OR partner_user_id = auth.uid())
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(_starts_at, _ends_at, '[)');
  IF _partner_conflict > 0 THEN
    RAISE EXCEPTION 'Ya tienes otra reserva en ese horario';
  END IF;

  INSERT INTO public.bookings (court_id, user_id, partner_user_id, tenant_id, starts_at, ends_at, status, notes)
  VALUES (_court_id, auth.uid(), _partner_user_id, _user_tenant, _starts_at, _ends_at, 'confirmada', _notes)
  RETURNING * INTO _new;

  RETURN _new;
END;
$$;

-- Drop the old 3-arg signature
DROP FUNCTION IF EXISTS public.create_booking(uuid, timestamptz, text);

-- 3. My upcoming bookings (as owner OR partner)
CREATE OR REPLACE FUNCTION public.my_upcoming_bookings(_limit int DEFAULT 5)
RETURNS TABLE (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status booking_status,
  court_id uuid,
  court_name text,
  court_surface court_surface,
  user_id uuid,
  partner_user_id uuid,
  other_first_name text,
  other_last_name text,
  i_am_owner boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.starts_at,
    b.ends_at,
    b.status,
    b.court_id,
    c.name AS court_name,
    c.surface AS court_surface,
    b.user_id,
    b.partner_user_id,
    p_other.first_name AS other_first_name,
    p_other.last_name  AS other_last_name,
    (b.user_id = auth.uid()) AS i_am_owner
  FROM public.bookings b
  JOIN public.courts c ON c.id = b.court_id
  LEFT JOIN public.profiles p_other
    ON p_other.user_id = CASE
      WHEN b.user_id = auth.uid() THEN b.partner_user_id
      ELSE b.user_id
    END
  WHERE b.status = 'confirmada'
    AND b.ends_at >= now()
    AND (b.user_id = auth.uid() OR b.partner_user_id = auth.uid())
  ORDER BY b.starts_at ASC
  LIMIT GREATEST(_limit, 1);
$$;

-- 4. Pending actions counts for home
CREATE OR REPLACE FUNCTION public.home_pending_actions()
RETURNS TABLE (
  ladder_challenges_received int,
  ladder_results_to_confirm int,
  tournament_results_to_confirm int,
  doubles_invitations int,
  reschedule_requests int,
  total int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lcr AS (
    SELECT count(*)::int AS n FROM public.ladder_challenges
    WHERE challenged_user_id = auth.uid() AND status = 'propuesto'
  ),
  lrc AS (
    SELECT count(*)::int AS n FROM public.ladder_challenges
    WHERE result_proposed_at IS NOT NULL
      AND result_confirmed_at IS NULL
      AND result_proposed_by IS DISTINCT FROM auth.uid()
      AND (challenger_user_id = auth.uid() OR challenged_user_id = auth.uid())
  ),
  trc AS (
    SELECT count(*)::int AS n
    FROM public.tournament_match_results r
    JOIN public.tournament_matches m ON m.id = r.match_id
    WHERE r.status = 'propuesto'
      AND r.proposed_by IS DISTINCT FROM auth.uid()
      AND public.is_match_player(m.id, auth.uid())
  ),
  di AS (
    SELECT count(*)::int AS n FROM public.tournament_registrations
    WHERE player2_user_id = auth.uid() AND status = 'pendiente_pareja'
  ),
  rsr AS (
    SELECT count(*)::int AS n
    FROM public.tournament_match_reschedule_requests rr
    JOIN public.tournament_matches m ON m.id = rr.match_id
    WHERE rr.status = 'pendiente'
      AND rr.proposed_by IS DISTINCT FROM auth.uid()
      AND public.is_match_player(m.id, auth.uid())
  )
  SELECT
    lcr.n, lrc.n, trc.n, di.n, rsr.n,
    (lcr.n + lrc.n + trc.n + di.n + rsr.n) AS total
  FROM lcr, lrc, trc, di, rsr;
$$;