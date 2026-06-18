-- ============================================================================
-- S8 — COACH PRO
-- ============================================================================

-- 1. Nuevo rol "coach"
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'coach';

-- 2. Nuevo valor para rating_change_source
DO $$ BEGIN
  ALTER TYPE rating_change_source ADD VALUE IF NOT EXISTS 'clase';
EXCEPTION WHEN others THEN null; END $$;

-- 3. Nuevos enums S8
DO $$ BEGIN CREATE TYPE booking_kind AS ENUM ('socio', 'clase');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE coach_class_kind AS ENUM ('socio_individual', 'socio_compartida', 'externa');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE coach_class_status AS ENUM ('propuesta', 'confirmada', 'completada', 'cancelada', 'no_show');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE coach_payment_status AS ENUM ('pendiente', 'pagada', 'condonada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. Ajustar bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS kind booking_kind NOT NULL DEFAULT 'socio';
CREATE INDEX IF NOT EXISTS idx_bookings_kind ON bookings(tenant_id, kind);

-- 5. Ajustar canchas (cemento → 'dura')
DO $$
DECLARE v_tenant_id uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE short_name = 'Providencia' LIMIT 1;
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  UPDATE courts SET surface = 'dura', updated_at = now()
    WHERE tenant_id = v_tenant_id AND name IN ('Cancha 1', 'Cancha 2');

  INSERT INTO courts (tenant_id, name, surface, sort_order, slot_minutes, opens_at, closes_at, is_active, is_indoor)
  SELECT v_tenant_id, x.name, x.surface::court_surface, x.sort_order, 60, '08:00'::time, '22:00'::time, true, false
  FROM (VALUES
    ('Cancha 5', 'arcilla', 5),
    ('Cancha 6', 'arcilla', 6),
    ('Cancha 7', 'arcilla', 7),
    ('Cancha 8', 'arcilla', 8),
    ('Court Central', 'arcilla', 9)
  ) AS x(name, surface, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM courts c2 WHERE c2.tenant_id = v_tenant_id AND c2.name = x.name
  );
END $$;

-- ============================================================================
-- 6. coach_profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS coach_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  bio_pro text,
  years_coaching integer DEFAULT 0,
  specialties text[] DEFAULT ARRAY[]::text[],
  languages text[] DEFAULT ARRAY['Español']::text[],
  certifications text,
  hourly_rate_member_clp integer NOT NULL DEFAULT 25000,
  hourly_rate_shared_clp integer NOT NULL DEFAULT 35000,
  hourly_rate_external_clp integer NOT NULL DEFAULT 35000,
  is_head_coach boolean NOT NULL DEFAULT false,
  accepts_external boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  photo_url text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_profiles_tenant ON coach_profiles(tenant_id, is_active);
ALTER TABLE coach_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven coaches activos de su club" ON coach_profiles FOR SELECT TO authenticated
  USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Coach edita su propio perfil" ON coach_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "club_admin gestiona perfiles de coach" ON coach_profiles FOR ALL TO authenticated
  USING (is_club_admin_of(auth.uid(), tenant_id)) WITH CHECK (is_club_admin_of(auth.uid(), tenant_id));

-- ============================================================================
-- 7. coach_class_blocks
-- ============================================================================
CREATE TABLE IF NOT EXISTS coach_class_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES coach_profiles(id) ON DELETE CASCADE,
  weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  allow_external boolean NOT NULL DEFAULT true,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_class_blocks_tenant_day ON coach_class_blocks(tenant_id, weekday, court_id);
ALTER TABLE coach_class_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven bloques de clase de su club" ON coach_class_blocks FOR SELECT TO authenticated
  USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "club_admin gestiona bloques de clase" ON coach_class_blocks FOR ALL TO authenticated
  USING (is_club_admin_of(auth.uid(), tenant_id)) WITH CHECK (is_club_admin_of(auth.uid(), tenant_id));

-- ============================================================================
-- 8. coach_availability
-- ============================================================================
CREATE TABLE IF NOT EXISTS coach_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES coach_profiles(id) ON DELETE CASCADE,
  weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  is_recurring boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_coach_avail_coach_day ON coach_availability(coach_id, weekday);
ALTER TABLE coach_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven disponibilidad de coaches del club" ON coach_availability FOR SELECT TO authenticated
  USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Coach gestiona su propia disponibilidad" ON coach_availability FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM coach_profiles cp WHERE cp.id = coach_id AND cp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM coach_profiles cp WHERE cp.id = coach_id AND cp.user_id = auth.uid()));
CREATE POLICY "club_admin gestiona disponibilidad de coaches" ON coach_availability FOR ALL TO authenticated
  USING (is_club_admin_of(auth.uid(), tenant_id)) WITH CHECK (is_club_admin_of(auth.uid(), tenant_id));

-- ============================================================================
-- 9. coach_class_bookings
-- ============================================================================
CREATE TABLE IF NOT EXISTS coach_class_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES coach_profiles(id) ON DELETE RESTRICT,
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (60, 120)),
  kind coach_class_kind NOT NULL,
  status coach_class_status NOT NULL DEFAULT 'propuesta',
  student1_user_id uuid,
  student2_user_id uuid,
  external_student_name text,
  external_student_phone text,
  price_clp integer NOT NULL DEFAULT 0,
  payment_status coach_payment_status NOT NULL DEFAULT 'pendiente',
  paid_at timestamptz,
  paid_by uuid,
  notes text,
  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_classes_coach_starts ON coach_class_bookings(coach_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_classes_tenant_starts ON coach_class_bookings(tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_classes_student1 ON coach_class_bookings(student1_user_id);
CREATE INDEX IF NOT EXISTS idx_classes_student2 ON coach_class_bookings(student2_user_id);
CREATE INDEX IF NOT EXISTS idx_classes_status ON coach_class_bookings(tenant_id, status);
ALTER TABLE coach_class_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socio o coach ven la clase" ON coach_class_bookings FOR SELECT TO authenticated
  USING (
    student1_user_id = auth.uid() OR student2_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM coach_profiles cp WHERE cp.id = coach_id AND cp.user_id = auth.uid())
    OR is_club_admin_of(auth.uid(), tenant_id) OR is_super_admin(auth.uid())
  );
CREATE POLICY "club_admin gestiona clases del club" ON coach_class_bookings FOR ALL TO authenticated
  USING (is_club_admin_of(auth.uid(), tenant_id)) WITH CHECK (is_club_admin_of(auth.uid(), tenant_id));

-- ============================================================================
-- 10. coach_payments
-- ============================================================================
CREATE TABLE IF NOT EXISTS coach_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES coach_profiles(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_clp integer NOT NULL DEFAULT 0,
  classes_count integer NOT NULL DEFAULT 0,
  marked_paid_at timestamptz,
  marked_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS idx_payments_coach ON coach_payments(coach_id, period_start);
ALTER TABLE coach_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach ve sus liquidaciones" ON coach_payments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM coach_profiles cp WHERE cp.id = coach_id AND cp.user_id = auth.uid())
    OR is_club_admin_of(auth.uid(), tenant_id) OR is_super_admin(auth.uid())
  );
CREATE POLICY "club_admin gestiona liquidaciones" ON coach_payments FOR ALL TO authenticated
  USING (is_club_admin_of(auth.uid(), tenant_id)) WITH CHECK (is_club_admin_of(auth.uid(), tenant_id));

-- ============================================================================
-- 11. Triggers updated_at
-- ============================================================================
CREATE TRIGGER trg_coach_profiles_updated BEFORE UPDATE ON coach_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_coach_class_blocks_updated BEFORE UPDATE ON coach_class_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_coach_availability_updated BEFORE UPDATE ON coach_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_coach_class_bookings_updated BEFORE UPDATE ON coach_class_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_coach_payments_updated BEFORE UPDATE ON coach_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 12. RPC: create_coach_class
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_coach_class(
  _coach_id uuid,
  _court_id uuid,
  _starts_at timestamptz,
  _duration_minutes integer,
  _kind coach_class_kind,
  _student1_user_id uuid DEFAULT NULL,
  _student2_user_id uuid DEFAULT NULL,
  _external_student_name text DEFAULT NULL,
  _external_student_phone text DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid; v_ends_at timestamptz; v_weekday int;
  v_start_time time; v_end_time time; v_block_ok boolean;
  v_price int; v_class_id uuid; v_booking_id uuid;
  v_coach_user uuid; v_status coach_class_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _duration_minutes NOT IN (60, 120) THEN RAISE EXCEPTION 'Duración debe ser 60 o 120 minutos'; END IF;

  SELECT cp.tenant_id, cp.user_id,
    CASE _kind
      WHEN 'socio_individual' THEN cp.hourly_rate_member_clp
      WHEN 'socio_compartida' THEN cp.hourly_rate_shared_clp
      WHEN 'externa' THEN cp.hourly_rate_external_clp
    END
  INTO v_tenant, v_coach_user, v_price
  FROM coach_profiles cp WHERE cp.id = _coach_id AND cp.is_active = true;

  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Coach no encontrado o inactivo'; END IF;
  v_ends_at := _starts_at + make_interval(mins => _duration_minutes);

  IF user_tenant_id(auth.uid()) <> v_tenant
     AND NOT is_club_admin_of(auth.uid(), v_tenant)
     AND NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _kind = 'socio_individual' AND _student1_user_id IS NULL THEN
    RAISE EXCEPTION 'Clase individual requiere un socio'; END IF;
  IF _kind = 'socio_compartida' AND (_student1_user_id IS NULL OR _student2_user_id IS NULL) THEN
    RAISE EXCEPTION 'Clase compartida requiere dos socios'; END IF;
  IF _kind = 'externa' AND _external_student_name IS NULL THEN
    RAISE EXCEPTION 'Clase externa requiere nombre del alumno'; END IF;

  v_weekday := EXTRACT(DOW FROM _starts_at AT TIME ZONE 'America/Santiago');
  v_start_time := (_starts_at AT TIME ZONE 'America/Santiago')::time;
  v_end_time := (v_ends_at AT TIME ZONE 'America/Santiago')::time;

  SELECT EXISTS (
    SELECT 1 FROM coach_class_blocks b
    WHERE b.tenant_id = v_tenant AND b.court_id = _court_id
      AND b.weekday = v_weekday AND b.is_active = true
      AND b.starts_at <= v_start_time AND b.ends_at >= v_end_time
      AND (b.coach_id IS NULL OR b.coach_id = _coach_id)
      AND (_kind <> 'externa' OR b.allow_external = true)
  ) INTO v_block_ok;

  IF NOT v_block_ok THEN
    RAISE EXCEPTION 'No hay bloque de clase habilitado para esa cancha/horario';
  END IF;

  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.court_id = _court_id AND b.status = 'confirmada'
      AND tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(_starts_at, v_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'La cancha ya está reservada en ese horario';
  END IF;

  IF auth.uid() = v_coach_user OR is_club_admin_of(auth.uid(), v_tenant) THEN
    v_status := 'confirmada';
  ELSE
    v_status := 'propuesta';
  END IF;

  INSERT INTO bookings (tenant_id, court_id, user_id, starts_at, ends_at, status, kind, notes)
  VALUES (v_tenant, _court_id, v_coach_user, _starts_at, v_ends_at, 'confirmada', 'clase', 'Clase con coach')
  RETURNING id INTO v_booking_id;

  INSERT INTO coach_class_bookings (
    tenant_id, coach_id, court_id, booking_id,
    starts_at, ends_at, duration_minutes, kind, status,
    student1_user_id, student2_user_id, external_student_name, external_student_phone,
    price_clp, notes, created_by
  ) VALUES (
    v_tenant, _coach_id, _court_id, v_booking_id,
    _starts_at, v_ends_at, _duration_minutes, _kind, v_status,
    _student1_user_id, _student2_user_id, _external_student_name, _external_student_phone,
    v_price, _notes, auth.uid()
  ) RETURNING id INTO v_class_id;

  RETURN v_class_id;
END $$;

-- ============================================================================
-- 13. RPC: confirm_coach_class
-- ============================================================================
CREATE OR REPLACE FUNCTION public.confirm_coach_class(_class_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class coach_class_bookings%ROWTYPE; v_coach_user uuid;
BEGIN
  SELECT * INTO v_class FROM coach_class_bookings WHERE id = _class_id;
  IF v_class.id IS NULL THEN RAISE EXCEPTION 'Clase no encontrada'; END IF;
  SELECT user_id INTO v_coach_user FROM coach_profiles WHERE id = v_class.coach_id;
  IF auth.uid() <> v_coach_user AND NOT is_club_admin_of(auth.uid(), v_class.tenant_id) THEN
    RAISE EXCEPTION 'Solo el coach o admin puede confirmar';
  END IF;
  IF v_class.status <> 'propuesta' THEN RAISE EXCEPTION 'La clase no está en estado propuesta'; END IF;
  UPDATE coach_class_bookings SET status = 'confirmada', updated_at = now() WHERE id = _class_id;
END $$;

-- ============================================================================
-- 14. RPC: cancel_coach_class
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancel_coach_class(_class_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class coach_class_bookings%ROWTYPE; v_coach_user uuid;
BEGIN
  SELECT * INTO v_class FROM coach_class_bookings WHERE id = _class_id;
  IF v_class.id IS NULL THEN RAISE EXCEPTION 'Clase no encontrada'; END IF;
  SELECT user_id INTO v_coach_user FROM coach_profiles WHERE id = v_class.coach_id;
  IF auth.uid() <> v_coach_user
     AND auth.uid() <> v_class.student1_user_id
     AND auth.uid() <> v_class.student2_user_id
     AND NOT is_club_admin_of(auth.uid(), v_class.tenant_id) THEN
    RAISE EXCEPTION 'No autorizado para cancelar esta clase';
  END IF;
  IF v_class.status IN ('completada', 'cancelada') THEN
    RAISE EXCEPTION 'La clase ya está finalizada';
  END IF;
  UPDATE coach_class_bookings
  SET status = 'cancelada', cancel_reason = _reason,
      cancelled_at = now(), cancelled_by = auth.uid(), updated_at = now()
  WHERE id = _class_id;
  IF v_class.booking_id IS NOT NULL THEN
    UPDATE bookings SET status = 'cancelada',
      cancelled_at = now(), cancelled_by = auth.uid()
    WHERE id = v_class.booking_id;
  END IF;
END $$;

-- ============================================================================
-- 15. RPC: complete_coach_class (micro-delta ELO)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.complete_coach_class(_class_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_class coach_class_bookings%ROWTYPE; v_coach_user uuid; v_student uuid;
  v_weekly_count int; v_delta numeric; v_current_level numeric; v_current_rel int;
BEGIN
  SELECT * INTO v_class FROM coach_class_bookings WHERE id = _class_id;
  IF v_class.id IS NULL THEN RAISE EXCEPTION 'Clase no encontrada'; END IF;
  SELECT user_id INTO v_coach_user FROM coach_profiles WHERE id = v_class.coach_id;
  IF auth.uid() <> v_coach_user AND NOT is_club_admin_of(auth.uid(), v_class.tenant_id) THEN
    RAISE EXCEPTION 'Solo el coach o admin puede marcar completada';
  END IF;
  IF v_class.status <> 'confirmada' THEN
    RAISE EXCEPTION 'Solo se pueden completar clases confirmadas';
  END IF;

  UPDATE coach_class_bookings SET status = 'completada',
    completed_at = now(), updated_at = now() WHERE id = _class_id;

  FOR v_student IN
    SELECT s FROM unnest(ARRAY[v_class.student1_user_id, v_class.student2_user_id]) AS s
    WHERE s IS NOT NULL
  LOOP
    v_delta := 0.01;
    SELECT COUNT(*) INTO v_weekly_count
    FROM rating_history rh
    WHERE rh.user_id = v_student AND rh.source = 'clase'
      AND rh.recorded_at >= date_trunc('week', now());
    IF v_weekly_count >= 5 THEN v_delta := 0; END IF;

    SELECT level, reliability INTO v_current_level, v_current_rel
    FROM player_ratings
    WHERE user_id = v_student AND tenant_id = v_class.tenant_id AND sport = 'tenis_singles';

    IF v_current_level IS NULL THEN CONTINUE; END IF;

    UPDATE player_ratings
    SET level = LEAST(7.0, v_current_level + v_delta),
        reliability = LEAST(100, v_current_rel + 1),
        last_change_delta = v_delta,
        last_match_at = now(), updated_at = now()
    WHERE user_id = v_student AND tenant_id = v_class.tenant_id AND sport = 'tenis_singles';

    INSERT INTO rating_history (
      tenant_id, user_id, sport, source, source_ref_id,
      level_before, level_after, reliability_before, reliability_after,
      delta, notes
    ) VALUES (
      v_class.tenant_id, v_student, 'tenis_singles', 'clase', _class_id,
      v_current_level, LEAST(7.0, v_current_level + v_delta),
      v_current_rel, LEAST(100, v_current_rel + 1),
      v_delta, 'Clase con coach completada'
    );
  END LOOP;
END $$;

-- ============================================================================
-- 16. RPC: mark_class_paid
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_class_paid(_class_id uuid, _status coach_payment_status DEFAULT 'pagada')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_class coach_class_bookings%ROWTYPE; v_coach_user uuid;
BEGIN
  SELECT * INTO v_class FROM coach_class_bookings WHERE id = _class_id;
  IF v_class.id IS NULL THEN RAISE EXCEPTION 'Clase no encontrada'; END IF;
  SELECT user_id INTO v_coach_user FROM coach_profiles WHERE id = v_class.coach_id;
  IF auth.uid() <> v_coach_user AND NOT is_club_admin_of(auth.uid(), v_class.tenant_id) THEN
    RAISE EXCEPTION 'Solo el coach o admin puede marcar pago';
  END IF;
  UPDATE coach_class_bookings
  SET payment_status = _status,
      paid_at = CASE WHEN _status = 'pagada' THEN now() ELSE NULL END,
      paid_by = CASE WHEN _status = 'pagada' THEN auth.uid() ELSE NULL END,
      updated_at = now()
  WHERE id = _class_id;
END $$;

-- ============================================================================
-- 17. Badges nuevos
-- ============================================================================
INSERT INTO badges (code, name, description, icon, category, threshold)
VALUES
  ('aprendiz_dedicado', 'Aprendiz dedicado', 'Asistió a 5 clases con coach', 'graduation-cap', 'milestone', 5),
  ('diez_horas_coach', '10 horas con coach', 'Acumuló 10 horas de clases', 'clock', 'milestone', 10)
ON CONFLICT (code) DO NOTHING;