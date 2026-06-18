-- 1) Subir default y actualizar clubes existentes
ALTER TABLE public.booking_rules ALTER COLUMN max_active_bookings SET DEFAULT 3;
UPDATE public.booking_rules SET max_active_bookings = 3 WHERE max_active_bookings < 3;

-- 2) Excluir reservas de torneo del conteo de "reservas activas" en create_booking
CREATE OR REPLACE FUNCTION public.create_booking(
  _court_id uuid,
  _starts_at timestamptz,
  _notes text DEFAULT NULL,
  _partner_user_id uuid DEFAULT NULL,
  _duration_minutes int DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_tenant uuid;
  _court public.courts;
  _rules public.booking_rules;
  _ends_at timestamptz;
  _conflict_count int;
  _partner_conflict int;
  _active_count int;
  _new public.bookings;
  _effective_duration int;
BEGIN
  _user_tenant := public.user_tenant_id(auth.uid());
  IF _user_tenant IS NULL THEN
    RAISE EXCEPTION 'Sin tenant para el usuario';
  END IF;

  SELECT * INTO _court FROM public.courts WHERE id = _court_id;
  IF NOT FOUND OR _court.tenant_id <> _user_tenant THEN
    RAISE EXCEPTION 'Cancha no encontrada en tu club';
  END IF;

  _effective_duration := COALESCE(_duration_minutes, _court.slot_minutes);
  IF _effective_duration NOT IN (60, 90) THEN
    RAISE EXCEPTION 'La duración debe ser 60 o 90 minutos';
  END IF;

  _ends_at := _starts_at + make_interval(mins => _effective_duration);

  IF _starts_at < now() THEN
    RAISE EXCEPTION 'No puedes reservar en el pasado';
  END IF;

  SELECT * INTO _rules FROM public.booking_rules WHERE tenant_id = _user_tenant;
  IF FOUND THEN
    IF _starts_at > now() + make_interval(days => _rules.max_advance_days) THEN
      RAISE EXCEPTION 'No puedes reservar con más de % días de anticipación', _rules.max_advance_days;
    END IF;
    -- Excluir reservas de torneo del límite de simultáneas
    SELECT count(*) INTO _active_count
      FROM public.bookings
      WHERE user_id = auth.uid()
        AND status = 'confirmada'
        AND ends_at > now()
        AND kind <> 'torneo';
    IF _active_count >= _rules.max_active_bookings THEN
      RAISE EXCEPTION 'Has alcanzado el máximo de reservas activas (%)', _rules.max_active_bookings;
    END IF;
  END IF;

  SELECT count(*) INTO _conflict_count
    FROM public.bookings
    WHERE court_id = _court_id
      AND status = 'confirmada'
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(_starts_at, _ends_at, '[)');
  IF _conflict_count > 0 THEN
    RAISE EXCEPTION 'Ese horario ya está ocupado en esta cancha';
  END IF;

  SELECT count(*) INTO _partner_conflict
    FROM public.bookings
    WHERE status = 'confirmada'
      AND (user_id = _partner_user_id OR partner_user_id = _partner_user_id)
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(_starts_at, _ends_at, '[)');
  IF _partner_user_id IS NOT NULL AND _partner_conflict > 0 THEN
    RAISE EXCEPTION 'Tu compañero/a ya tiene una reserva en ese horario';
  END IF;

  INSERT INTO public.bookings (
    court_id, user_id, partner_user_id, tenant_id,
    starts_at, ends_at, status, notes
  ) VALUES (
    _court_id, auth.uid(), _partner_user_id, _user_tenant,
    _starts_at, _ends_at, 'confirmada', _notes
  )
  RETURNING * INTO _new;

  RETURN _new;
END;
$$;