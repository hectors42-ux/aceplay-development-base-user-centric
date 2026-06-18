-- ============================================================
-- EXTENSIÓN GIST para EXCLUDE constraint con tstzrange
-- ============================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.court_surface AS ENUM ('arcilla', 'dura', 'cesped', 'sintetico');
CREATE TYPE public.booking_status AS ENUM ('confirmada', 'cancelada');

-- ============================================================
-- TABLA: courts
-- ============================================================
CREATE TABLE public.courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  surface public.court_surface NOT NULL DEFAULT 'arcilla',
  is_indoor BOOLEAN NOT NULL DEFAULT false,
  slot_minutes INTEGER NOT NULL DEFAULT 60 CHECK (slot_minutes IN (60, 90, 120)),
  opens_at TIME NOT NULL DEFAULT '08:00',
  closes_at TIME NOT NULL DEFAULT '22:00',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT courts_hours_chk CHECK (closes_at > opens_at),
  CONSTRAINT courts_unique_name UNIQUE (tenant_id, name)
);

CREATE INDEX idx_courts_tenant ON public.courts(tenant_id) WHERE is_active = true;

ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven canchas de su club"
ON public.courts FOR SELECT TO authenticated
USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "club_admin crea canchas en su club"
ON public.courts FOR INSERT TO authenticated
WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

CREATE POLICY "club_admin actualiza canchas de su club"
ON public.courts FOR UPDATE TO authenticated
USING (public.is_club_admin_of(auth.uid(), tenant_id));

CREATE POLICY "club_admin elimina canchas de su club"
ON public.courts FOR DELETE TO authenticated
USING (public.is_club_admin_of(auth.uid(), tenant_id));

CREATE TRIGGER trg_courts_updated_at
BEFORE UPDATE ON public.courts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABLA: booking_rules (1 fila por tenant)
-- ============================================================
CREATE TABLE public.booking_rules (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  max_active_bookings INTEGER NOT NULL DEFAULT 2 CHECK (max_active_bookings BETWEEN 1 AND 20),
  max_advance_days INTEGER NOT NULL DEFAULT 7 CHECK (max_advance_days BETWEEN 1 AND 60),
  min_cancel_hours INTEGER NOT NULL DEFAULT 4 CHECK (min_cancel_hours BETWEEN 0 AND 72),
  allow_back_to_back BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios leen reglas de su club"
ON public.booking_rules FOR SELECT TO authenticated
USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona reglas de su club"
ON public.booking_rules FOR ALL TO authenticated
USING (public.is_club_admin_of(auth.uid(), tenant_id))
WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

CREATE TRIGGER trg_booking_rules_updated_at
BEFORE UPDATE ON public.booking_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-crea reglas default cuando se crea un tenant
CREATE OR REPLACE FUNCTION public.create_default_booking_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.booking_rules (tenant_id) VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_default_rules
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.create_default_booking_rules();

-- ============================================================
-- TABLA: bookings
-- ============================================================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'confirmada',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID,
  -- rango temporal generado para EXCLUDE GIST
  period TSTZRANGE GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED,
  CONSTRAINT bookings_time_chk CHECK (ends_at > starts_at),
  -- Anti doble-reserva atómico: misma cancha + cualquier overlap en estado confirmada
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    court_id WITH =,
    period WITH &&
  ) WHERE (status = 'confirmada')
);

CREATE INDEX idx_bookings_tenant_starts ON public.bookings(tenant_id, starts_at);
CREATE INDEX idx_bookings_user_status ON public.bookings(user_id, status, starts_at);
CREATE INDEX idx_bookings_court_starts ON public.bookings(court_id, starts_at) WHERE status = 'confirmada';

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven reservas de su club"
ON public.bookings FOR SELECT TO authenticated
USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- INSERT/UPDATE/DELETE solo vía funciones SECURITY DEFINER (create_booking, cancel_booking)
-- club_admin tiene escape:
CREATE POLICY "club_admin gestiona reservas de su club"
ON public.bookings FOR ALL TO authenticated
USING (public.is_club_admin_of(auth.uid(), tenant_id))
WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

-- ============================================================
-- FUNCIÓN: create_booking
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_booking(
  _court_id UUID,
  _starts_at TIMESTAMPTZ,
  _notes TEXT DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_user_tenant UUID;
  v_court public.courts%ROWTYPE;
  v_rules public.booking_rules%ROWTYPE;
  v_ends_at TIMESTAMPTZ;
  v_active_count INTEGER;
  v_local_start TIME;
  v_local_end TIME;
  v_tz TEXT;
  v_booking public.bookings%ROWTYPE;
  v_back_to_back BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  -- Cancha
  SELECT * INTO v_court FROM public.courts WHERE id = _court_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cancha no existe';
  END IF;
  IF NOT v_court.is_active THEN
    RAISE EXCEPTION 'La cancha no está disponible para reservas';
  END IF;

  -- Tenant del socio == tenant de la cancha
  v_user_tenant := public.user_tenant_id(v_user_id);
  IF v_user_tenant IS NULL OR v_user_tenant <> v_court.tenant_id THEN
    RAISE EXCEPTION 'No puedes reservar canchas de otro club';
  END IF;
  v_tenant_id := v_court.tenant_id;

  -- Reglas del club
  SELECT * INTO v_rules FROM public.booking_rules WHERE tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    INSERT INTO public.booking_rules (tenant_id) VALUES (v_tenant_id) RETURNING * INTO v_rules;
  END IF;

  v_ends_at := _starts_at + (v_court.slot_minutes || ' minutes')::INTERVAL;

  -- No reservas en el pasado
  IF _starts_at < now() THEN
    RAISE EXCEPTION 'No puedes reservar un horario pasado';
  END IF;

  -- Antelación máxima
  IF _starts_at > now() + (v_rules.max_advance_days || ' days')::INTERVAL THEN
    RAISE EXCEPTION 'Máximo % días de antelación', v_rules.max_advance_days;
  END IF;

  -- Horario apertura/cierre del club (en zona horaria del tenant)
  SELECT timezone INTO v_tz FROM public.tenants WHERE id = v_tenant_id;
  v_tz := COALESCE(v_tz, 'America/Santiago');
  v_local_start := (_starts_at AT TIME ZONE v_tz)::TIME;
  v_local_end := (v_ends_at AT TIME ZONE v_tz)::TIME;

  IF v_local_start < v_court.opens_at OR v_local_end > v_court.closes_at THEN
    RAISE EXCEPTION 'El horario está fuera del horario de la cancha (% a %)',
      to_char(v_court.opens_at, 'HH24:MI'), to_char(v_court.closes_at, 'HH24:MI');
  END IF;

  -- Slot alineado a la duración (desde opens_at)
  IF EXTRACT(EPOCH FROM (v_local_start - v_court.opens_at))::INTEGER % (v_court.slot_minutes * 60) <> 0 THEN
    RAISE EXCEPTION 'El horario no coincide con un slot válido';
  END IF;

  -- Máximo de reservas activas del socio en este club
  SELECT COUNT(*) INTO v_active_count
  FROM public.bookings
  WHERE user_id = v_user_id
    AND tenant_id = v_tenant_id
    AND status = 'confirmada'
    AND ends_at > now();

  IF v_active_count >= v_rules.max_active_bookings THEN
    RAISE EXCEPTION 'Llegaste al máximo de % reservas activas', v_rules.max_active_bookings;
  END IF;

  -- Back-to-back: prohibir si la regla está apagada
  IF NOT v_rules.allow_back_to_back THEN
    SELECT EXISTS (
      SELECT 1 FROM public.bookings
      WHERE user_id = v_user_id
        AND tenant_id = v_tenant_id
        AND status = 'confirmada'
        AND (ends_at = _starts_at OR starts_at = v_ends_at)
    ) INTO v_back_to_back;
    IF v_back_to_back THEN
      RAISE EXCEPTION 'No puedes reservar dos horarios seguidos';
    END IF;
  END IF;

  -- Insert: el EXCLUDE GIST bloquea overlaps automáticamente
  BEGIN
    INSERT INTO public.bookings (tenant_id, court_id, user_id, starts_at, ends_at, notes)
    VALUES (v_tenant_id, _court_id, v_user_id, _starts_at, v_ends_at, _notes)
    RETURNING * INTO v_booking;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Ese horario ya fue reservado, elige otro';
  END;

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking(UUID, TIMESTAMPTZ, TEXT) TO authenticated;

-- ============================================================
-- FUNCIÓN: cancel_booking
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_booking(_booking_id UUID)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_rules public.booking_rules%ROWTYPE;
  v_is_admin BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = _booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La reserva no existe';
  END IF;

  IF v_booking.status = 'cancelada' THEN
    RAISE EXCEPTION 'La reserva ya estaba cancelada';
  END IF;

  v_is_admin := public.is_club_admin_of(v_user_id, v_booking.tenant_id);

  IF v_booking.user_id <> v_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Solo puedes cancelar tus propias reservas';
  END IF;

  IF NOT v_is_admin THEN
    SELECT * INTO v_rules FROM public.booking_rules WHERE tenant_id = v_booking.tenant_id;
    IF FOUND AND v_booking.starts_at - now() < (v_rules.min_cancel_hours || ' hours')::INTERVAL THEN
      RAISE EXCEPTION 'Debes cancelar con al menos % horas de anticipación', v_rules.min_cancel_hours;
    END IF;
  END IF;

  UPDATE public.bookings
  SET status = 'cancelada', cancelled_at = now(), cancelled_by = v_user_id
  WHERE id = _booking_id
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_booking(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_booking(UUID) TO authenticated;

-- ============================================================
-- SEED Providencia
-- ============================================================
INSERT INTO public.booking_rules (tenant_id)
SELECT id FROM public.tenants WHERE slug = 'providencia'
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO public.courts (tenant_id, name, surface, sort_order)
SELECT t.id, c.name, 'arcilla'::public.court_surface, c.sort_order
FROM public.tenants t,
     (VALUES ('Cancha 1', 1), ('Cancha 2', 2), ('Cancha 3', 3), ('Cancha 4', 4)) AS c(name, sort_order)
WHERE t.slug = 'providencia'
ON CONFLICT (tenant_id, name) DO NOTHING;