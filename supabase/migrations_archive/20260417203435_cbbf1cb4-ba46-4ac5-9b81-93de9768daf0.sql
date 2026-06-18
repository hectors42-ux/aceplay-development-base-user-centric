-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.tournament_discipline AS ENUM ('tenis_singles', 'tenis_dobles');
CREATE TYPE public.tournament_format AS ENUM ('eliminacion_simple');
CREATE TYPE public.tournament_status AS ENUM (
  'borrador', 'inscripciones_abiertas', 'inscripciones_cerradas',
  'en_curso', 'finalizado', 'cancelado'
);
CREATE TYPE public.seeding_method AS ENUM ('manual', 'ntrp', 'ranking_club');
CREATE TYPE public.registration_status AS ENUM (
  'pendiente_pareja', 'pendiente_admin', 'confirmada', 'rechazada', 'retirada'
);
CREATE TYPE public.match_status AS ENUM (
  'pendiente', 'programado', 'jugado', 'walkover', 'cancelado'
);

-- ============================================================
-- TABLA: tournaments
-- ============================================================
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  discipline public.tournament_discipline NOT NULL DEFAULT 'tenis_singles',
  format public.tournament_format NOT NULL DEFAULT 'eliminacion_simple',
  surface public.court_surface NOT NULL DEFAULT 'arcilla',
  category TEXT NOT NULL DEFAULT 'Open',
  max_participants INTEGER NOT NULL DEFAULT 16 CHECK (max_participants BETWEEN 2 AND 128),
  entry_fee_clp BIGINT NOT NULL DEFAULT 0 CHECK (entry_fee_clp >= 0),
  seeding_method public.seeding_method NOT NULL DEFAULT 'manual',
  registration_opens_at TIMESTAMPTZ NOT NULL,
  registration_closes_at TIMESTAMPTZ NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status public.tournament_status NOT NULL DEFAULT 'borrador',
  bracket_generated_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tournaments_dates_chk CHECK (
    registration_opens_at < registration_closes_at
    AND registration_closes_at <= starts_at
    AND starts_at <= ends_at
  ),
  CONSTRAINT tournaments_slug_tenant_unique UNIQUE (tenant_id, slug)
);
CREATE INDEX idx_tournaments_tenant_status ON public.tournaments(tenant_id, status);
CREATE INDEX idx_tournaments_starts_at ON public.tournaments(starts_at DESC);

CREATE TRIGGER trg_tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABLA: tournament_registrations
-- ============================================================
CREATE TABLE public.tournament_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  player1_user_id UUID NOT NULL,
  player2_user_id UUID,
  seed INTEGER,
  status public.registration_status NOT NULL DEFAULT 'pendiente_admin',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT registrations_p1_p2_distinct CHECK (player1_user_id <> player2_user_id),
  -- Un jugador no puede aparecer dos veces en el mismo torneo (como p1)
  CONSTRAINT registrations_unique_p1 UNIQUE (tournament_id, player1_user_id)
);
CREATE INDEX idx_registrations_tournament ON public.tournament_registrations(tournament_id, status);
CREATE INDEX idx_registrations_player1 ON public.tournament_registrations(player1_user_id);
CREATE INDEX idx_registrations_player2 ON public.tournament_registrations(player2_user_id) WHERE player2_user_id IS NOT NULL;

CREATE TRIGGER trg_registrations_updated_at
  BEFORE UPDATE ON public.tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABLA: tournament_matches
-- ============================================================
CREATE TABLE public.tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  round INTEGER NOT NULL CHECK (round >= 1),
  bracket_position INTEGER NOT NULL CHECK (bracket_position >= 1),
  registration_a_id UUID REFERENCES public.tournament_registrations(id) ON DELETE SET NULL,
  registration_b_id UUID REFERENCES public.tournament_registrations(id) ON DELETE SET NULL,
  winner_registration_id UUID REFERENCES public.tournament_registrations(id) ON DELETE SET NULL,
  next_match_id UUID REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
  next_match_slot CHAR(1) CHECK (next_match_slot IN ('a', 'b')),
  score JSONB,
  walkover BOOLEAN NOT NULL DEFAULT false,
  retired BOOLEAN NOT NULL DEFAULT false,
  scheduled_at TIMESTAMPTZ,
  court_id UUID REFERENCES public.courts(id) ON DELETE SET NULL,
  played_at TIMESTAMPTZ,
  status public.match_status NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT matches_unique_position UNIQUE (tournament_id, round, bracket_position)
);
CREATE INDEX idx_matches_tournament_round ON public.tournament_matches(tournament_id, round, bracket_position);
CREATE INDEX idx_matches_scheduled ON public.tournament_matches(scheduled_at) WHERE scheduled_at IS NOT NULL;

CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON public.tournament_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- tournaments
CREATE POLICY "Socios ven torneos de su club"
  ON public.tournaments FOR SELECT TO authenticated
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona torneos de su club"
  ON public.tournaments FOR ALL TO authenticated
  USING (public.is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

-- tournament_registrations
CREATE POLICY "Socios ven inscripciones de su club"
  ON public.tournament_registrations FOR SELECT TO authenticated
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona inscripciones de su club"
  ON public.tournament_registrations FOR ALL TO authenticated
  USING (public.is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

-- tournament_matches
CREATE POLICY "Socios ven partidos de su club"
  ON public.tournament_matches FOR SELECT TO authenticated
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona partidos de su club"
  ON public.tournament_matches FOR ALL TO authenticated
  USING (public.is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

-- ============================================================
-- FUNCIÓN: register_to_tournament
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_to_tournament(
  _tournament_id UUID,
  _player2_user_id UUID DEFAULT NULL
)
RETURNS public.tournament_registrations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tournament public.tournaments%ROWTYPE;
  v_user_tenant UUID;
  v_dues public.dues_status;
  v_p2_tenant UUID;
  v_count INTEGER;
  v_status public.registration_status;
  v_reg public.tournament_registrations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = _tournament_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El torneo no existe'; END IF;

  v_user_tenant := public.user_tenant_id(v_user_id);
  IF v_user_tenant IS NULL OR v_user_tenant <> v_tournament.tenant_id THEN
    RAISE EXCEPTION 'No puedes inscribirte en torneos de otro club';
  END IF;

  IF v_tournament.status <> 'inscripciones_abiertas' THEN
    RAISE EXCEPTION 'Las inscripciones no están abiertas';
  END IF;
  IF now() < v_tournament.registration_opens_at OR now() > v_tournament.registration_closes_at THEN
    RAISE EXCEPTION 'Estás fuera de la ventana de inscripción';
  END IF;

  SELECT dues_status INTO v_dues FROM public.profiles WHERE user_id = v_user_id;
  IF v_dues IS DISTINCT FROM 'al_dia' THEN
    RAISE EXCEPTION 'Debes estar al día con las cuotas para inscribirte';
  END IF;

  -- Validar pareja en dobles
  IF v_tournament.discipline = 'tenis_dobles' THEN
    IF _player2_user_id IS NULL THEN
      RAISE EXCEPTION 'Debes elegir una pareja para torneos de dobles';
    END IF;
    IF _player2_user_id = v_user_id THEN
      RAISE EXCEPTION 'No puedes ser tu propia pareja';
    END IF;
    SELECT tenant_id INTO v_p2_tenant FROM public.profiles WHERE user_id = _player2_user_id;
    IF v_p2_tenant IS DISTINCT FROM v_tournament.tenant_id THEN
      RAISE EXCEPTION 'Tu pareja debe ser socio del mismo club';
    END IF;
    -- Pareja no debe estar ya en el torneo
    IF EXISTS (
      SELECT 1 FROM public.tournament_registrations
      WHERE tournament_id = _tournament_id
        AND status NOT IN ('rechazada', 'retirada')
        AND (player1_user_id = _player2_user_id OR player2_user_id = _player2_user_id)
    ) THEN
      RAISE EXCEPTION 'Tu pareja ya está inscrita en este torneo';
    END IF;
    v_status := 'pendiente_pareja';
  ELSE
    IF _player2_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'Este torneo es de singles, no requiere pareja';
    END IF;
    v_status := 'pendiente_admin';
  END IF;

  -- Cupo
  SELECT COUNT(*) INTO v_count FROM public.tournament_registrations
  WHERE tournament_id = _tournament_id AND status NOT IN ('rechazada', 'retirada');
  IF v_count >= v_tournament.max_participants THEN
    RAISE EXCEPTION 'El torneo ya alcanzó el cupo máximo (%)', v_tournament.max_participants;
  END IF;

  INSERT INTO public.tournament_registrations (
    tournament_id, tenant_id, player1_user_id, player2_user_id, status
  ) VALUES (
    _tournament_id, v_tournament.tenant_id, v_user_id, _player2_user_id, v_status
  )
  RETURNING * INTO v_reg;

  RETURN v_reg;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Ya estás inscrito en este torneo';
END;
$$;

-- ============================================================
-- FUNCIÓN: accept_doubles_invitation
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_doubles_invitation(_registration_id UUID)
RETURNS public.tournament_registrations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reg public.tournament_registrations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_reg FROM public.tournament_registrations WHERE id = _registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La inscripción no existe'; END IF;
  IF v_reg.player2_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Solo la pareja invitada puede aceptar';
  END IF;
  IF v_reg.status <> 'pendiente_pareja' THEN
    RAISE EXCEPTION 'Esta invitación ya no está pendiente';
  END IF;
  UPDATE public.tournament_registrations
  SET status = 'pendiente_admin'
  WHERE id = _registration_id
  RETURNING * INTO v_reg;
  RETURN v_reg;
END;
$$;

-- ============================================================
-- FUNCIÓN: reject_doubles_invitation
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_doubles_invitation(_registration_id UUID)
RETURNS public.tournament_registrations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reg public.tournament_registrations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_reg FROM public.tournament_registrations WHERE id = _registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La inscripción no existe'; END IF;
  IF v_reg.player2_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Solo la pareja invitada puede rechazar';
  END IF;
  IF v_reg.status <> 'pendiente_pareja' THEN
    RAISE EXCEPTION 'Esta invitación ya no está pendiente';
  END IF;
  UPDATE public.tournament_registrations
  SET status = 'rechazada'
  WHERE id = _registration_id
  RETURNING * INTO v_reg;
  RETURN v_reg;
END;
$$;

-- ============================================================
-- FUNCIÓN: withdraw_from_tournament
-- ============================================================
CREATE OR REPLACE FUNCTION public.withdraw_from_tournament(_registration_id UUID)
RETURNS public.tournament_registrations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reg public.tournament_registrations%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_is_admin BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_reg FROM public.tournament_registrations WHERE id = _registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La inscripción no existe'; END IF;

  v_is_admin := public.is_club_admin_of(v_user_id, v_reg.tenant_id);
  IF v_reg.player1_user_id <> v_user_id AND v_reg.player2_user_id IS DISTINCT FROM v_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Solo puedes retirar tu propia inscripción';
  END IF;
  IF v_reg.status IN ('rechazada', 'retirada') THEN
    RAISE EXCEPTION 'Esta inscripción ya no está activa';
  END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_reg.tournament_id;
  IF v_tournament.status IN ('en_curso', 'finalizado') AND NOT v_is_admin THEN
    RAISE EXCEPTION 'No puedes retirarte una vez iniciado el torneo';
  END IF;

  UPDATE public.tournament_registrations
  SET status = 'retirada', withdrawn_at = now()
  WHERE id = _registration_id
  RETURNING * INTO v_reg;
  RETURN v_reg;
END;
$$;

-- ============================================================
-- FUNCIÓN: generate_bracket (eliminación simple)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_bracket(_tournament_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tournament public.tournaments%ROWTYPE;
  v_count INTEGER;
  v_bracket_size INTEGER;
  v_total_rounds INTEGER;
  v_round INTEGER;
  v_matches_in_round INTEGER;
  v_pos INTEGER;
  v_regs UUID[];
  v_seeded UUID[];
  v_match_id UUID;
  v_next_match_id UUID;
  v_a UUID;
  v_b UUID;
  v_round1_matches UUID[];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = _tournament_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El torneo no existe'; END IF;
  IF NOT public.is_club_admin_of(v_user_id, v_tournament.tenant_id) THEN
    RAISE EXCEPTION 'Solo administradores pueden generar la llave';
  END IF;
  IF v_tournament.bracket_generated_at IS NOT NULL THEN
    RAISE EXCEPTION 'La llave ya fue generada';
  END IF;

  -- Recolectar inscripciones confirmadas, ordenadas por seed (NULLs al final), luego por fecha de inscripción
  SELECT ARRAY_AGG(id ORDER BY (seed IS NULL), seed NULLS LAST, registered_at)
  INTO v_regs
  FROM public.tournament_registrations
  WHERE tournament_id = _tournament_id AND status = 'confirmada';

  v_count := COALESCE(array_length(v_regs, 1), 0);
  IF v_count < 2 THEN
    RAISE EXCEPTION 'Se necesitan al menos 2 inscripciones confirmadas';
  END IF;

  -- Tamaño de bracket = próxima potencia de 2
  v_bracket_size := 2;
  WHILE v_bracket_size < v_count LOOP v_bracket_size := v_bracket_size * 2; END LOOP;
  v_total_rounds := CEIL(LOG(2, v_bracket_size))::INTEGER;

  -- Rellenar con NULLs (byes) hasta v_bracket_size
  WHILE array_length(v_regs, 1) < v_bracket_size LOOP
    v_regs := array_append(v_regs, NULL::UUID);
  END LOOP;

  -- Crear matches de todas las rondas (sin asignar contendientes en R>1)
  -- round = v_total_rounds para R1, round = 1 para final
  -- Posiciones: 1..matches_in_round
  v_round1_matches := ARRAY[]::UUID[];
  v_round := v_total_rounds; -- ronda inicial
  v_matches_in_round := v_bracket_size / 2;

  -- Crear primero todas las rondas posteriores para tener IDs de "next_match"
  -- Empezamos desde la final (round=1) hacia atrás
  FOR r IN REVERSE 1..v_total_rounds LOOP
    DECLARE v_m INTEGER := v_bracket_size / (2 ^ (v_total_rounds - r + 1))::INTEGER;
    BEGIN
      FOR p IN 1..v_m LOOP
        INSERT INTO public.tournament_matches (
          tournament_id, tenant_id, round, bracket_position
        ) VALUES (
          _tournament_id, v_tournament.tenant_id, r, p
        );
      END LOOP;
    END;
  END LOOP;

  -- Conectar cada match con su "next_match" (excepto la final)
  UPDATE public.tournament_matches m
  SET next_match_id = nm.id,
      next_match_slot = CASE WHEN (m.bracket_position % 2) = 1 THEN 'a' ELSE 'b' END
  FROM public.tournament_matches nm
  WHERE m.tournament_id = _tournament_id
    AND nm.tournament_id = _tournament_id
    AND m.round > 1
    AND nm.round = m.round - 1
    AND nm.bracket_position = CEIL(m.bracket_position::NUMERIC / 2);

  -- Asignar inscripciones a R1 con seeding "estándar" (1 vs último, etc.)
  -- Seeding tipo: pos 1=seed1, pos 2=seedN, pos 3=seedN/2+1, pos 4=seedN/2, ... (simplificado: 1vsN, 2vsN-1)
  -- Para MVP usamos pareo simple: 1 vs N, 2 vs N-1, ...
  v_pos := 1;
  FOR i IN 1..(v_bracket_size / 2) LOOP
    v_a := v_regs[i];
    v_b := v_regs[v_bracket_size - i + 1];

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
    WHERE tournament_id = _tournament_id
      AND round = v_total_rounds
      AND bracket_position = i
    RETURNING id INTO v_match_id;
  END LOOP;

  -- Propagar walkovers automáticos al siguiente match
  FOR v_match_id, v_a, v_next_match_id IN
    SELECT id, winner_registration_id, next_match_id
    FROM public.tournament_matches
    WHERE tournament_id = _tournament_id
      AND round = v_total_rounds
      AND walkover = true
      AND winner_registration_id IS NOT NULL
      AND next_match_id IS NOT NULL
  LOOP
    UPDATE public.tournament_matches
    SET registration_a_id = CASE WHEN next_match_slot = 'a' THEN v_a ELSE registration_a_id END,
        registration_b_id = CASE WHEN next_match_slot = 'b' THEN v_a ELSE registration_b_id END
    FROM (SELECT next_match_slot FROM public.tournament_matches WHERE id = v_match_id) sub
    WHERE id = v_next_match_id;
  END LOOP;

  UPDATE public.tournaments
  SET bracket_generated_at = now(), status = 'en_curso'
  WHERE id = _tournament_id;

  RETURN v_total_rounds;
END;
$$;

-- ============================================================
-- FUNCIÓN: record_match_result
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_match_result(
  _match_id UUID,
  _winner_registration_id UUID,
  _score JSONB DEFAULT NULL,
  _walkover BOOLEAN DEFAULT false,
  _retired BOOLEAN DEFAULT false
)
RETURNS public.tournament_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_match public.tournament_matches%ROWTYPE;
  v_next public.tournament_matches%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_pending INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El partido no existe'; END IF;
  IF NOT public.is_club_admin_of(v_user_id, v_match.tenant_id) THEN
    RAISE EXCEPTION 'Solo administradores pueden registrar resultados';
  END IF;
  IF _winner_registration_id NOT IN (
    COALESCE(v_match.registration_a_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(v_match.registration_b_id, '00000000-0000-0000-0000-000000000000'::UUID)
  ) THEN
    RAISE EXCEPTION 'El ganador debe ser uno de los dos contendientes';
  END IF;

  UPDATE public.tournament_matches
  SET winner_registration_id = _winner_registration_id,
      score = _score,
      walkover = _walkover,
      retired = _retired,
      status = CASE WHEN _walkover THEN 'walkover' ELSE 'jugado' END,
      played_at = COALESCE(played_at, now())
  WHERE id = _match_id
  RETURNING * INTO v_match;

  -- Propagar al siguiente
  IF v_match.next_match_id IS NOT NULL THEN
    UPDATE public.tournament_matches
    SET registration_a_id = CASE WHEN v_match.next_match_slot = 'a' THEN _winner_registration_id ELSE registration_a_id END,
        registration_b_id = CASE WHEN v_match.next_match_slot = 'b' THEN _winner_registration_id ELSE registration_b_id END
    WHERE id = v_match.next_match_id;
  END IF;

  -- Si es la final (round=1), marcar torneo como finalizado
  IF v_match.round = 1 THEN
    UPDATE public.tournaments SET status = 'finalizado' WHERE id = v_match.tournament_id;
  END IF;

  RETURN v_match;
END;
$$;