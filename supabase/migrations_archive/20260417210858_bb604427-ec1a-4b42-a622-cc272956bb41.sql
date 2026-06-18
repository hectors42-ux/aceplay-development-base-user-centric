
-- ============================================================================
-- TORNEOS v2: Refactor a torneo padre + categorías, programación con bookings,
-- resultados con confirmación entre jugadores, reagendamiento auto-gestionado.
-- ============================================================================

-- 1) Limpiar datos existentes (torneos de prueba)
DELETE FROM public.tournament_matches;
DELETE FROM public.tournament_registrations;
DELETE FROM public.tournaments;

-- 2) Drop de funciones que vamos a reemplazar (cambian firmas)
DROP FUNCTION IF EXISTS public.register_to_tournament(uuid, uuid);
DROP FUNCTION IF EXISTS public.generate_bracket(uuid);
DROP FUNCTION IF EXISTS public.record_match_result(uuid, uuid, jsonb, boolean, boolean);
DROP FUNCTION IF EXISTS public.accept_doubles_invitation(uuid);
DROP FUNCTION IF EXISTS public.reject_doubles_invitation(uuid);
DROP FUNCTION IF EXISTS public.withdraw_from_tournament(uuid);

-- 3) Nuevos enums
DO $$ BEGIN
  CREATE TYPE public.result_validation_mode AS ENUM (
    'solo_admin',
    'jugadores_con_confirmacion',
    'jugadores_con_aprobacion_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.match_result_proposal_status AS ENUM (
    'propuesto', 'confirmado', 'rechazado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reschedule_request_status AS ENUM (
    'pendiente', 'aceptada', 'rechazada', 'cancelada', 'expirada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.category_gender AS ENUM ('varones', 'damas', 'mixto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Refactor de tournaments: ahora es el "evento" padre
ALTER TABLE public.tournaments
  DROP COLUMN IF EXISTS discipline,
  DROP COLUMN IF EXISTS max_participants,
  DROP COLUMN IF EXISTS seeding_method,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS surface,
  DROP COLUMN IF EXISTS bracket_generated_at,
  DROP COLUMN IF EXISTS format;

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS result_validation_mode public.result_validation_mode NOT NULL DEFAULT 'jugadores_con_confirmacion',
  ADD COLUMN IF NOT EXISTS reschedule_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reschedule_window_hours INTEGER NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS reschedule_min_notice_hours INTEGER NOT NULL DEFAULT 12;

-- 5) Tabla de categorías (cuadros)
CREATE TABLE IF NOT EXISTS public.tournament_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_label TEXT NOT NULL DEFAULT 'Open',
  gender public.category_gender NOT NULL DEFAULT 'mixto',
  discipline public.tournament_discipline NOT NULL DEFAULT 'tenis_singles',
  surface public.court_surface NOT NULL DEFAULT 'arcilla',
  max_participants INTEGER NOT NULL DEFAULT 32,
  seeding_method public.seeding_method NOT NULL DEFAULT 'manual',
  status public.tournament_status NOT NULL DEFAULT 'borrador',
  bracket_generated_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tournament_categories_tournament ON public.tournament_categories(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_categories_tenant ON public.tournament_categories(tenant_id);

ALTER TABLE public.tournament_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven categorías de su club"
  ON public.tournament_categories FOR SELECT
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona categorías"
  ON public.tournament_categories FOR ALL
  USING (public.is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

CREATE TRIGGER tg_tournament_categories_updated
  BEFORE UPDATE ON public.tournament_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) tournament_registrations: ahora pertenece a una categoría
ALTER TABLE public.tournament_registrations
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.tournament_categories(id) ON DELETE CASCADE;

-- como ya borramos los datos, podemos hacerlo NOT NULL
ALTER TABLE public.tournament_registrations
  ALTER COLUMN category_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_registrations_category ON public.tournament_registrations(category_id);

-- 7) tournament_matches: pertenece a una categoría y puede estar atado a un booking
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.tournament_categories(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;

ALTER TABLE public.tournament_matches
  ALTER COLUMN category_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_matches_category ON public.tournament_matches(category_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_booking ON public.tournament_matches(booking_id);

-- 8) Propuestas de resultado (auto-gestión)
CREATE TABLE IF NOT EXISTS public.tournament_match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL,
  winner_registration_id UUID NOT NULL REFERENCES public.tournament_registrations(id),
  score JSONB,
  walkover BOOLEAN NOT NULL DEFAULT false,
  retired BOOLEAN NOT NULL DEFAULT false,
  status public.match_result_proposal_status NOT NULL DEFAULT 'propuesto',
  responded_by UUID,
  responded_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_results_match ON public.tournament_match_results(match_id);
CREATE INDEX IF NOT EXISTS idx_match_results_tenant ON public.tournament_match_results(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_match_results_one_pending
  ON public.tournament_match_results(match_id) WHERE status = 'propuesto';

ALTER TABLE public.tournament_match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven propuestas de resultado de su club"
  ON public.tournament_match_results FOR SELECT
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona propuestas de resultado"
  ON public.tournament_match_results FOR ALL
  USING (public.is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

CREATE TRIGGER tg_match_results_updated
  BEFORE UPDATE ON public.tournament_match_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9) Solicitudes de reagendamiento
CREATE TABLE IF NOT EXISTS public.tournament_match_reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL,
  proposed_starts_at TIMESTAMPTZ NOT NULL,
  proposed_court_id UUID REFERENCES public.courts(id),
  status public.reschedule_request_status NOT NULL DEFAULT 'pendiente',
  responded_by UUID,
  responded_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reschedule_match ON public.tournament_match_reschedule_requests(match_id);
CREATE INDEX IF NOT EXISTS idx_reschedule_tenant ON public.tournament_match_reschedule_requests(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reschedule_one_pending
  ON public.tournament_match_reschedule_requests(match_id) WHERE status = 'pendiente';

ALTER TABLE public.tournament_match_reschedule_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven solicitudes de reagendar de su club"
  ON public.tournament_match_reschedule_requests FOR SELECT
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona solicitudes de reagendar"
  ON public.tournament_match_reschedule_requests FOR ALL
  USING (public.is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

CREATE TRIGGER tg_reschedule_updated
  BEFORE UPDATE ON public.tournament_match_reschedule_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- HELPERS
-- ============================================================================

-- Detecta si el usuario es uno de los jugadores de un match (player1 o player2 de A o B)
CREATE OR REPLACE FUNCTION public.is_match_player(_user_id UUID, _match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tournament_matches m
    LEFT JOIN public.tournament_registrations ra ON ra.id = m.registration_a_id
    LEFT JOIN public.tournament_registrations rb ON rb.id = m.registration_b_id
    WHERE m.id = _match_id
      AND (
        ra.player1_user_id = _user_id OR ra.player2_user_id = _user_id OR
        rb.player1_user_id = _user_id OR rb.player2_user_id = _user_id
      )
  );
$$;

-- Devuelve la registration_id "del rival" del usuario en un match (la que NO es su equipo)
CREATE OR REPLACE FUNCTION public.opponent_registration(_user_id UUID, _match_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN ra.player1_user_id = _user_id OR ra.player2_user_id = _user_id THEN m.registration_b_id
    WHEN rb.player1_user_id = _user_id OR rb.player2_user_id = _user_id THEN m.registration_a_id
    ELSE NULL
  END
  FROM public.tournament_matches m
  LEFT JOIN public.tournament_registrations ra ON ra.id = m.registration_a_id
  LEFT JOIN public.tournament_registrations rb ON rb.id = m.registration_b_id
  WHERE m.id = _match_id;
$$;

-- ============================================================================
-- INSCRIPCIONES (refactor: ahora por categoría)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_to_category(
  _category_id UUID,
  _player2_user_id UUID DEFAULT NULL
)
RETURNS public.tournament_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_tenant UUID;
  v_category public.tournament_categories%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_count INTEGER;
  v_registration public.tournament_registrations%ROWTYPE;
  v_initial_status public.registration_status;
  v_dues public.dues_status;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_category FROM public.tournament_categories WHERE id = _category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La categoría no existe'; END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_category.tournament_id;

  v_user_tenant := public.user_tenant_id(v_user_id);
  IF v_user_tenant IS NULL OR v_user_tenant <> v_category.tenant_id THEN
    RAISE EXCEPTION 'No puedes inscribirte a torneos de otro club';
  END IF;

  -- Estado de cuotas
  SELECT dues_status INTO v_dues FROM public.profiles WHERE user_id = v_user_id;
  IF v_dues IN ('moroso','suspendido') THEN
    RAISE EXCEPTION 'No puedes inscribirte: cuotas %', v_dues;
  END IF;

  -- Ventana de inscripción
  IF now() < v_tournament.registration_opens_at THEN
    RAISE EXCEPTION 'Las inscripciones aún no abren';
  END IF;
  IF now() > v_tournament.registration_closes_at THEN
    RAISE EXCEPTION 'Las inscripciones ya cerraron';
  END IF;

  -- Capacidad de la categoría
  SELECT COUNT(*) INTO v_count
  FROM public.tournament_registrations
  WHERE category_id = _category_id
    AND status IN ('confirmada','pendiente_admin','pendiente_pareja');
  IF v_count >= v_category.max_participants THEN
    RAISE EXCEPTION 'La categoría está llena';
  END IF;

  -- Validar dobles
  IF v_category.discipline = 'tenis_dobles' THEN
    IF _player2_user_id IS NULL THEN
      RAISE EXCEPTION 'Debes elegir una pareja para dobles';
    END IF;
    IF _player2_user_id = v_user_id THEN
      RAISE EXCEPTION 'La pareja debe ser otro socio';
    END IF;
    -- Pareja debe ser del mismo club
    IF public.user_tenant_id(_player2_user_id) <> v_category.tenant_id THEN
      RAISE EXCEPTION 'La pareja debe ser socio del mismo club';
    END IF;
    v_initial_status := 'pendiente_pareja';
  ELSE
    IF _player2_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'No se acepta pareja en singles';
    END IF;
    v_initial_status := 'pendiente_admin';
  END IF;

  -- Evitar doble inscripción
  IF EXISTS (
    SELECT 1 FROM public.tournament_registrations
    WHERE category_id = _category_id
      AND status NOT IN ('rechazada','retirada')
      AND (player1_user_id = v_user_id OR player2_user_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'Ya estás inscrito en esta categoría';
  END IF;

  INSERT INTO public.tournament_registrations (
    tournament_id, category_id, tenant_id,
    player1_user_id, player2_user_id, status
  ) VALUES (
    v_category.tournament_id, _category_id, v_category.tenant_id,
    v_user_id, _player2_user_id, v_initial_status
  ) RETURNING * INTO v_registration;

  RETURN v_registration;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_doubles_invitation(_registration_id UUID)
RETURNS public.tournament_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reg public.tournament_registrations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_reg FROM public.tournament_registrations WHERE id = _registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inscripción no encontrada'; END IF;
  IF v_reg.player2_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Solo la pareja invitada puede aceptar';
  END IF;
  IF v_reg.status <> 'pendiente_pareja' THEN
    RAISE EXCEPTION 'La invitación ya no está pendiente';
  END IF;
  UPDATE public.tournament_registrations
    SET status = 'pendiente_admin'
    WHERE id = _registration_id
    RETURNING * INTO v_reg;
  RETURN v_reg;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_doubles_invitation(_registration_id UUID)
RETURNS public.tournament_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reg public.tournament_registrations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_reg FROM public.tournament_registrations WHERE id = _registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inscripción no encontrada'; END IF;
  IF v_reg.player2_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Solo la pareja invitada puede rechazar';
  END IF;
  IF v_reg.status <> 'pendiente_pareja' THEN
    RAISE EXCEPTION 'La invitación ya no está pendiente';
  END IF;
  UPDATE public.tournament_registrations
    SET status = 'rechazada'
    WHERE id = _registration_id
    RETURNING * INTO v_reg;
  RETURN v_reg;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_from_category(_registration_id UUID)
RETURNS public.tournament_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reg public.tournament_registrations%ROWTYPE;
  v_category public.tournament_categories%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_reg FROM public.tournament_registrations WHERE id = _registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inscripción no encontrada'; END IF;
  IF v_reg.player1_user_id <> v_user_id AND v_reg.player2_user_id <> v_user_id
     AND NOT public.is_club_admin_of(v_user_id, v_reg.tenant_id) THEN
    RAISE EXCEPTION 'Solo los inscritos o el admin pueden retirarse';
  END IF;
  SELECT * INTO v_category FROM public.tournament_categories WHERE id = v_reg.category_id;
  IF v_category.bracket_generated_at IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede retirar: la llave ya fue generada';
  END IF;
  UPDATE public.tournament_registrations
    SET status = 'retirada', withdrawn_at = now()
    WHERE id = _registration_id
    RETURNING * INTO v_reg;
  RETURN v_reg;
END;
$$;

-- ============================================================================
-- BRACKET GENERATOR (por categoría, soporta seeding manual posicional)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_bracket(
  _category_id UUID,
  _seed_order UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_category public.tournament_categories%ROWTYPE;
  v_count INTEGER;
  v_bracket_size INTEGER;
  v_total_rounds INTEGER;
  v_regs UUID[];
  v_a UUID;
  v_b UUID;
  v_match_id UUID;
  v_next_id UUID;
  v_next_slot CHAR(1);
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_category FROM public.tournament_categories WHERE id = _category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La categoría no existe'; END IF;
  IF NOT public.is_club_admin_of(v_user_id, v_category.tenant_id) THEN
    RAISE EXCEPTION 'Solo administradores pueden generar la llave';
  END IF;
  IF v_category.bracket_generated_at IS NOT NULL THEN
    RAISE EXCEPTION 'La llave ya fue generada';
  END IF;

  IF _seed_order IS NOT NULL AND array_length(_seed_order, 1) > 0 THEN
    -- Validar que todos los IDs sean confirmados de la categoría
    IF EXISTS (
      SELECT 1 FROM unnest(_seed_order) WITH ORDINALITY AS s(id, ord)
      WHERE s.id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.tournament_registrations r
          WHERE r.id = s.id AND r.category_id = _category_id AND r.status = 'confirmada'
        )
    ) THEN
      RAISE EXCEPTION 'El orden de seeding contiene inscripciones inválidas';
    END IF;
    v_regs := _seed_order;
  ELSE
    SELECT ARRAY_AGG(id ORDER BY (seed IS NULL), seed NULLS LAST, registered_at)
    INTO v_regs
    FROM public.tournament_registrations
    WHERE category_id = _category_id AND status = 'confirmada';
  END IF;

  v_count := COALESCE(array_length(v_regs, 1), 0);
  IF v_count < 2 THEN RAISE EXCEPTION 'Se necesitan al menos 2 inscripciones confirmadas'; END IF;

  v_bracket_size := 2;
  WHILE v_bracket_size < v_count LOOP v_bracket_size := v_bracket_size * 2; END LOOP;
  v_total_rounds := CEIL(LOG(2, v_bracket_size))::INTEGER;

  WHILE COALESCE(array_length(v_regs, 1), 0) < v_bracket_size LOOP
    v_regs := array_append(v_regs, NULL::UUID);
  END LOOP;

  -- Crear matches de todas las rondas
  FOR r IN REVERSE 1..v_total_rounds LOOP
    DECLARE v_m INTEGER := v_bracket_size / (2 ^ (v_total_rounds - r + 1))::INTEGER;
    BEGIN
      FOR p IN 1..v_m LOOP
        INSERT INTO public.tournament_matches (
          tournament_id, category_id, tenant_id, round, bracket_position
        ) VALUES (
          v_category.tournament_id, _category_id, v_category.tenant_id, r, p
        );
      END LOOP;
    END;
  END LOOP;

  -- Conectar each match con su next_match
  UPDATE public.tournament_matches m
  SET next_match_id = nm.id,
      next_match_slot = CASE WHEN (m.bracket_position % 2) = 1 THEN 'a' ELSE 'b' END
  FROM public.tournament_matches nm
  WHERE m.category_id = _category_id
    AND nm.category_id = _category_id
    AND m.round > 1
    AND nm.round = m.round - 1
    AND nm.bracket_position = CEIL(m.bracket_position::NUMERIC / 2);

  -- Asignar R1 según orden recibido (posiciones 1..N en pares 1-2, 3-4, ...)
  -- Esto respeta seeding manual posicional con BYEs intercalados (modelo PDFs)
  FOR i IN 1..(v_bracket_size / 2) LOOP
    v_a := v_regs[(i - 1) * 2 + 1];
    v_b := v_regs[(i - 1) * 2 + 2];

    UPDATE public.tournament_matches
    SET registration_a_id = v_a,
        registration_b_id = v_b,
        status = CASE
          WHEN v_a IS NULL OR v_b IS NULL THEN 'walkover'
          ELSE 'pendiente'
        END,
        winner_registration_id = CASE
          WHEN v_a IS NOT NULL AND v_b IS NULL THEN v_a
          WHEN v_b IS NOT NULL AND v_a IS NULL THEN v_b
          ELSE NULL
        END,
        walkover = (v_a IS NULL OR v_b IS NULL)
    WHERE category_id = _category_id
      AND round = v_total_rounds
      AND bracket_position = i;
  END LOOP;

  -- Propagar walkovers automáticos al siguiente match
  FOR v_match_id, v_a, v_next_id, v_next_slot IN
    SELECT id, winner_registration_id, next_match_id, next_match_slot
    FROM public.tournament_matches
    WHERE category_id = _category_id
      AND round = v_total_rounds
      AND walkover = true
      AND winner_registration_id IS NOT NULL
      AND next_match_id IS NOT NULL
  LOOP
    UPDATE public.tournament_matches
    SET registration_a_id = CASE WHEN v_next_slot = 'a' THEN v_a ELSE registration_a_id END,
        registration_b_id = CASE WHEN v_next_slot = 'b' THEN v_a ELSE registration_b_id END
    WHERE id = v_next_id;
  END LOOP;

  UPDATE public.tournament_categories
  SET bracket_generated_at = now(), status = 'en_curso'
  WHERE id = _category_id;

  -- Si todas las categorías del torneo están en_curso o finalizado, marcar torneo en_curso
  UPDATE public.tournaments
  SET status = 'en_curso'
  WHERE id = v_category.tournament_id
    AND status IN ('borrador', 'inscripciones_abiertas', 'inscripciones_cerradas');

  RETURN v_total_rounds;
END;
$$;

-- ============================================================================
-- RESULTADOS (3 modos de validación)
-- ============================================================================

-- Aplicación efectiva del resultado y propagación
CREATE OR REPLACE FUNCTION public._apply_match_result(
  _match_id UUID,
  _winner_registration_id UUID,
  _score JSONB,
  _walkover BOOLEAN,
  _retired BOOLEAN
) RETURNS public.tournament_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_pending INTEGER;
BEGIN
  UPDATE public.tournament_matches
  SET winner_registration_id = _winner_registration_id,
      score = _score,
      walkover = _walkover,
      retired = _retired,
      status = CASE WHEN _walkover THEN 'walkover' ELSE 'jugado' END,
      played_at = COALESCE(played_at, now())
  WHERE id = _match_id
  RETURNING * INTO v_match;

  IF v_match.next_match_id IS NOT NULL THEN
    UPDATE public.tournament_matches
    SET registration_a_id = CASE WHEN v_match.next_match_slot = 'a' THEN _winner_registration_id ELSE registration_a_id END,
        registration_b_id = CASE WHEN v_match.next_match_slot = 'b' THEN _winner_registration_id ELSE registration_b_id END
    WHERE id = v_match.next_match_id;
  END IF;

  -- Si es la final de la categoría
  IF v_match.round = 1 THEN
    UPDATE public.tournament_categories SET status = 'finalizado' WHERE id = v_match.category_id;

    -- Si todas las categorías están finalizadas, marcar el torneo finalizado
    SELECT COUNT(*) INTO v_pending
    FROM public.tournament_categories
    WHERE tournament_id = v_match.tournament_id AND status <> 'finalizado';

    IF v_pending = 0 THEN
      UPDATE public.tournaments SET status = 'finalizado' WHERE id = v_match.tournament_id;
    END IF;
  END IF;

  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_match_result(
  _match_id UUID,
  _winner_registration_id UUID,
  _score JSONB DEFAULT NULL,
  _walkover BOOLEAN DEFAULT false,
  _retired BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_match public.tournament_matches%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_category public.tournament_categories%ROWTYPE;
  v_is_admin BOOLEAN;
  v_is_player BOOLEAN;
  v_proposal public.tournament_match_results%ROWTYPE;
  v_applied public.tournament_matches%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El partido no existe'; END IF;
  IF v_match.status IN ('jugado','walkover','cancelado') THEN
    RAISE EXCEPTION 'El partido ya tiene resultado';
  END IF;
  IF v_match.registration_a_id IS NULL OR v_match.registration_b_id IS NULL THEN
    RAISE EXCEPTION 'El partido aún no tiene contendientes definidos';
  END IF;
  IF _winner_registration_id NOT IN (v_match.registration_a_id, v_match.registration_b_id) THEN
    RAISE EXCEPTION 'El ganador debe ser uno de los dos contendientes';
  END IF;

  SELECT * INTO v_category FROM public.tournament_categories WHERE id = v_match.category_id;
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;

  v_is_admin := public.is_club_admin_of(v_user_id, v_match.tenant_id);
  v_is_player := public.is_match_player(v_user_id, _match_id);

  IF NOT (v_is_admin OR v_is_player) THEN
    RAISE EXCEPTION 'No tienes permiso para registrar este resultado';
  END IF;

  -- Cancelar propuesta pendiente previa
  UPDATE public.tournament_match_results
    SET status = 'rechazada', responded_at = now(), responded_by = v_user_id, reject_reason = 'Reemplazada'
    WHERE match_id = _match_id AND status = 'propuesto';

  -- Admin siempre puede aplicar directo
  IF v_is_admin THEN
    v_applied := public._apply_match_result(_match_id, _winner_registration_id, _score, _walkover, _retired);
    RETURN jsonb_build_object('mode','aplicado','match_id', v_applied.id);
  END IF;

  -- Modos para jugadores
  IF v_tournament.result_validation_mode = 'solo_admin' THEN
    RAISE EXCEPTION 'Solo el administrador puede registrar resultados en este torneo';
  END IF;

  -- jugadores_con_confirmacion o jugadores_con_aprobacion_admin → crear propuesta
  INSERT INTO public.tournament_match_results (
    match_id, tenant_id, proposed_by, winner_registration_id,
    score, walkover, retired
  ) VALUES (
    _match_id, v_match.tenant_id, v_user_id, _winner_registration_id,
    _score, _walkover, _retired
  ) RETURNING * INTO v_proposal;

  RETURN jsonb_build_object(
    'mode', CASE WHEN v_tournament.result_validation_mode = 'jugadores_con_confirmacion' THEN 'pendiente_rival' ELSE 'pendiente_admin' END,
    'proposal_id', v_proposal.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_match_result(_proposal_id UUID)
RETURNS public.tournament_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_proposal public.tournament_match_results%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_match public.tournament_matches%ROWTYPE;
  v_is_admin BOOLEAN;
  v_is_opponent BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_proposal FROM public.tournament_match_results WHERE id = _proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Propuesta no encontrada'; END IF;
  IF v_proposal.status <> 'propuesto' THEN RAISE EXCEPTION 'La propuesta no está pendiente'; END IF;

  SELECT * INTO v_match FROM public.tournament_matches WHERE id = v_proposal.match_id;
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;

  v_is_admin := public.is_club_admin_of(v_user_id, v_proposal.tenant_id);
  v_is_opponent := public.is_match_player(v_user_id, v_proposal.match_id) AND v_user_id <> v_proposal.proposed_by;

  IF v_tournament.result_validation_mode = 'jugadores_con_confirmacion' THEN
    IF NOT (v_is_admin OR v_is_opponent) THEN
      RAISE EXCEPTION 'Solo el rival o un admin pueden confirmar';
    END IF;
  ELSE -- jugadores_con_aprobacion_admin
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Solo el admin puede aprobar este resultado';
    END IF;
  END IF;

  UPDATE public.tournament_match_results
  SET status = 'confirmado', responded_by = v_user_id, responded_at = now()
  WHERE id = _proposal_id;

  RETURN public._apply_match_result(
    v_proposal.match_id, v_proposal.winner_registration_id,
    v_proposal.score, v_proposal.walkover, v_proposal.retired
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_match_result(_proposal_id UUID, _reason TEXT DEFAULT NULL)
RETURNS public.tournament_match_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_proposal public.tournament_match_results%ROWTYPE;
  v_is_admin BOOLEAN;
  v_is_opponent BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_proposal FROM public.tournament_match_results WHERE id = _proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Propuesta no encontrada'; END IF;
  IF v_proposal.status <> 'propuesto' THEN RAISE EXCEPTION 'La propuesta no está pendiente'; END IF;

  v_is_admin := public.is_club_admin_of(v_user_id, v_proposal.tenant_id);
  v_is_opponent := public.is_match_player(v_user_id, v_proposal.match_id) AND v_user_id <> v_proposal.proposed_by;
  IF NOT (v_is_admin OR v_is_opponent) THEN
    RAISE EXCEPTION 'No puedes rechazar esta propuesta';
  END IF;

  UPDATE public.tournament_match_results
  SET status = 'rechazada', responded_by = v_user_id, responded_at = now(), reject_reason = _reason
  WHERE id = _proposal_id
  RETURNING * INTO v_proposal;
  RETURN v_proposal;
END;
$$;

-- ============================================================================
-- PROGRAMACIÓN: schedule_match crea booking interno
-- ============================================================================

CREATE OR REPLACE FUNCTION public.schedule_match(
  _match_id UUID,
  _starts_at TIMESTAMPTZ,
  _court_id UUID
) RETURNS public.tournament_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_match public.tournament_matches%ROWTYPE;
  v_court public.courts%ROWTYPE;
  v_ends_at TIMESTAMPTZ;
  v_old_booking UUID;
  v_new_booking public.bookings%ROWTYPE;
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
  v_ends_at := _starts_at + (v_court.slot_minutes || ' minutes')::INTERVAL;

  -- Cancelar booking anterior si existía
  v_old_booking := v_match.booking_id;
  IF v_old_booking IS NOT NULL THEN
    UPDATE public.bookings
      SET status = 'cancelada', cancelled_at = now(), cancelled_by = v_user_id
      WHERE id = v_old_booking;
  END IF;

  -- Crear booking nuevo (bypass de reglas de socio; el EXCLUDE GIST sigue activo)
  BEGIN
    INSERT INTO public.bookings (
      tenant_id, court_id, user_id, starts_at, ends_at, notes
    ) VALUES (
      v_match.tenant_id, _court_id, v_user_id, _starts_at, v_ends_at,
      'Torneo: partido programado'
    ) RETURNING * INTO v_new_booking;
  EXCEPTION WHEN exclusion_violation THEN
    -- Restaurar el booking anterior si lo cancelamos
    IF v_old_booking IS NOT NULL THEN
      UPDATE public.bookings SET status = 'confirmada', cancelled_at = NULL, cancelled_by = NULL WHERE id = v_old_booking;
    END IF;
    RAISE EXCEPTION 'La cancha ya está reservada en ese horario';
  END;

  UPDATE public.tournament_matches
    SET scheduled_at = _starts_at,
        court_id = _court_id,
        booking_id = v_new_booking.id,
        status = CASE WHEN status = 'pendiente' THEN 'programado' ELSE status END
    WHERE id = _match_id
    RETURNING * INTO v_match;

  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.unschedule_match(_match_id UUID)
RETURNS public.tournament_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_match public.tournament_matches%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El partido no existe'; END IF;
  IF NOT public.is_club_admin_of(v_user_id, v_match.tenant_id) THEN
    RAISE EXCEPTION 'Solo administradores pueden desprogramar partidos';
  END IF;

  IF v_match.booking_id IS NOT NULL THEN
    UPDATE public.bookings
      SET status = 'cancelada', cancelled_at = now(), cancelled_by = v_user_id
      WHERE id = v_match.booking_id;
  END IF;

  UPDATE public.tournament_matches
    SET scheduled_at = NULL, court_id = NULL, booking_id = NULL,
        status = CASE WHEN status = 'programado' THEN 'pendiente' ELSE status END
    WHERE id = _match_id
    RETURNING * INTO v_match;
  RETURN v_match;
END;
$$;

-- ============================================================================
-- REAGENDAMIENTO entre jugadores
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_match_reschedule(
  _match_id UUID,
  _proposed_starts_at TIMESTAMPTZ,
  _proposed_court_id UUID
) RETURNS public.tournament_match_reschedule_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_match public.tournament_matches%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_court public.courts%ROWTYPE;
  v_request public.tournament_match_reschedule_requests%ROWTYPE;
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_ends_at TIMESTAMPTZ;
  v_conflict BOOLEAN;
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

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;
  IF NOT v_tournament.reschedule_enabled THEN
    RAISE EXCEPTION 'El reagendamiento por jugadores está deshabilitado en este torneo';
  END IF;

  -- Ventana válida: entre [scheduled_at - window, scheduled_at + window]
  v_window_start := v_match.scheduled_at - (v_tournament.reschedule_window_hours || ' hours')::INTERVAL;
  v_window_end := v_match.scheduled_at + (v_tournament.reschedule_window_hours || ' hours')::INTERVAL;

  IF _proposed_starts_at < v_window_start OR _proposed_starts_at > v_window_end THEN
    RAISE EXCEPTION 'El nuevo horario está fuera de la ventana permitida (±% horas)', v_tournament.reschedule_window_hours;
  END IF;
  IF _proposed_starts_at < now() + (v_tournament.reschedule_min_notice_hours || ' hours')::INTERVAL THEN
    RAISE EXCEPTION 'Debes proponer con al menos % horas de anticipación', v_tournament.reschedule_min_notice_hours;
  END IF;

  SELECT * INTO v_court FROM public.courts WHERE id = _proposed_court_id;
  IF NOT FOUND OR v_court.tenant_id <> v_match.tenant_id THEN
    RAISE EXCEPTION 'Cancha inválida';
  END IF;
  v_ends_at := _proposed_starts_at + (v_court.slot_minutes || ' minutes')::INTERVAL;

  -- Verificar disponibilidad (excluyendo el booking actual del match)
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

  -- Cancelar propuesta pendiente previa del mismo match
  UPDATE public.tournament_match_reschedule_requests
    SET status = 'cancelada', responded_by = v_user_id, responded_at = now()
    WHERE match_id = _match_id AND status = 'pendiente';

  INSERT INTO public.tournament_match_reschedule_requests (
    match_id, tenant_id, proposed_by, proposed_starts_at, proposed_court_id
  ) VALUES (
    _match_id, v_match.tenant_id, v_user_id, _proposed_starts_at, _proposed_court_id
  ) RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_match_reschedule(
  _request_id UUID,
  _accept BOOLEAN,
  _reason TEXT DEFAULT NULL
) RETURNS public.tournament_match_reschedule_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request public.tournament_match_reschedule_requests%ROWTYPE;
  v_match public.tournament_matches%ROWTYPE;
  v_court public.courts%ROWTYPE;
  v_ends_at TIMESTAMPTZ;
  v_is_admin BOOLEAN;
  v_is_opponent BOOLEAN;
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

  -- Aceptar: mover el match
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = v_request.match_id;
  SELECT * INTO v_court FROM public.courts WHERE id = v_request.proposed_court_id;
  v_ends_at := v_request.proposed_starts_at + (v_court.slot_minutes || ' minutes')::INTERVAL;

  -- Cancelar booking actual y crear nuevo (atómico)
  IF v_match.booking_id IS NOT NULL THEN
    UPDATE public.bookings
      SET status = 'cancelada', cancelled_at = now(), cancelled_by = v_user_id
      WHERE id = v_match.booking_id;
  END IF;

  DECLARE v_new_booking public.bookings%ROWTYPE;
  BEGIN
    INSERT INTO public.bookings (
      tenant_id, court_id, user_id, starts_at, ends_at, notes
    ) VALUES (
      v_match.tenant_id, v_request.proposed_court_id, v_user_id,
      v_request.proposed_starts_at, v_ends_at,
      'Torneo: partido reagendado'
    ) RETURNING * INTO v_new_booking;

    UPDATE public.tournament_matches
      SET scheduled_at = v_request.proposed_starts_at,
          court_id = v_request.proposed_court_id,
          booking_id = v_new_booking.id
      WHERE id = v_match.id;
  EXCEPTION WHEN exclusion_violation THEN
    -- Restaurar booking anterior
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
END;
$$;

-- ============================================================================
-- Permitir a SOCIOS cancelar bookings de torneo (vía RPC) — no por su lado
-- (El motor de bookings actual solo deja al admin cancelar bookings ajenas;
--  los bookings de torneo tienen user_id=admin, así que el socio no puede cancelarlos
--  directamente — bien.)
-- ============================================================================
