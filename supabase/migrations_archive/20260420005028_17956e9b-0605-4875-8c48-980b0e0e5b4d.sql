-- ============================================================
-- FASE A — Sistema de rating estilo Playtomic
-- ============================================================

-- 1) Enum para origen de cambios de rating
DO $$ BEGIN
  CREATE TYPE public.rating_change_source AS ENUM (
    'onboarding',
    'open_match',
    'ladder_challenge',
    'tournament_match',
    'admin_adjustment',
    'user_manual_lower',
    'ten_match_challenge'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Enum para sport (multi-disciplina). Reutilizamos tournament_discipline cuando se pueda;
--    pero conviene un enum propio simple para no acoplar.
DO $$ BEGIN
  CREATE TYPE public.rating_sport AS ENUM (
    'tenis_singles',
    'tenis_dobles',
    'padel',
    'pickleball'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Tabla player_ratings — un rating por (user_id, sport)
CREATE TABLE IF NOT EXISTS public.player_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  sport public.rating_sport NOT NULL DEFAULT 'tenis_singles',
  level numeric(3,2) NOT NULL DEFAULT 0.00 CHECK (level >= 0 AND level <= 7),
  reliability integer NOT NULL DEFAULT 15 CHECK (reliability >= 0 AND reliability <= 100),
  initial_level numeric(3,2),
  matches_played integer NOT NULL DEFAULT 0,
  competitive_matches integer NOT NULL DEFAULT 0,
  last_match_at timestamptz,
  last_change_delta numeric(3,2) NOT NULL DEFAULT 0,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, sport)
);

CREATE INDEX IF NOT EXISTS idx_player_ratings_tenant ON public.player_ratings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_player_ratings_user ON public.player_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_player_ratings_sport_level ON public.player_ratings(sport, level DESC);

-- 4) Tabla rating_history — un evento por cambio
CREATE TABLE IF NOT EXISTS public.rating_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  sport public.rating_sport NOT NULL,
  level_before numeric(3,2) NOT NULL,
  level_after numeric(3,2) NOT NULL,
  delta numeric(3,2) NOT NULL,
  reliability_before integer NOT NULL,
  reliability_after integer NOT NULL,
  source public.rating_change_source NOT NULL,
  source_ref_id uuid, -- ladder_challenge_id / tournament_match_id / open_match_id …
  notes text,
  recorded_by uuid,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rating_history_user ON public.rating_history(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_rating_history_tenant ON public.rating_history(tenant_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_rating_history_source ON public.rating_history(source, source_ref_id);

-- 5) Trigger updated_at en player_ratings (reusa update_updated_at_column si existe)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_player_ratings_updated_at ON public.player_ratings;
CREATE TRIGGER trg_player_ratings_updated_at
  BEFORE UPDATE ON public.player_ratings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6) RLS
ALTER TABLE public.player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;

-- player_ratings policies
DROP POLICY IF EXISTS "Socios ven ratings de su club" ON public.player_ratings;
CREATE POLICY "Socios ven ratings de su club"
  ON public.player_ratings FOR SELECT TO authenticated
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Usuario crea su propio rating" ON public.player_ratings;
CREATE POLICY "Usuario crea su propio rating"
  ON public.player_ratings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND tenant_id = public.user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Usuario actualiza su propio rating" ON public.player_ratings;
CREATE POLICY "Usuario actualiza su propio rating"
  ON public.player_ratings FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "club_admin gestiona ratings" ON public.player_ratings;
CREATE POLICY "club_admin gestiona ratings"
  ON public.player_ratings FOR ALL TO authenticated
  USING (public.is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

-- rating_history policies (lectura amplia, escritura solo via funciones SECURITY DEFINER + admin)
DROP POLICY IF EXISTS "Socios ven historial de ratings de su club" ON public.rating_history;
CREATE POLICY "Socios ven historial de ratings de su club"
  ON public.rating_history FOR SELECT TO authenticated
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "club_admin gestiona historial de ratings" ON public.rating_history;
CREATE POLICY "club_admin gestiona historial de ratings"
  ON public.rating_history FOR ALL TO authenticated
  USING (public.is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (public.is_club_admin_of(auth.uid(), tenant_id));

-- 7) Helper: ¿el usuario completó el cuestionario inicial? (cualquier sport)
CREATE OR REPLACE FUNCTION public.has_completed_rating_onboarding(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.player_ratings
    WHERE user_id = _user_id AND onboarding_completed_at IS NOT NULL
  );
$$;

-- 8) Helper: rating principal del usuario actual (tenis_singles por defecto)
CREATE OR REPLACE FUNCTION public.get_my_primary_rating()
RETURNS public.player_ratings LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.player_ratings
  WHERE user_id = auth.uid()
  ORDER BY (sport = 'tenis_singles') DESC, matches_played DESC
  LIMIT 1;
$$;

-- 9) RPC: completar onboarding y crear rating inicial
CREATE OR REPLACE FUNCTION public.complete_rating_onboarding(
  _sport public.rating_sport,
  _initial_level numeric,
  _initial_reliability integer DEFAULT 15
)
RETURNS public.player_ratings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _row public.player_ratings;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF _initial_level < 0 OR _initial_level > 7 THEN
    RAISE EXCEPTION 'Nivel inicial fuera de rango (0-7)';
  END IF;

  IF _initial_reliability < 0 OR _initial_reliability > 100 THEN
    RAISE EXCEPTION 'Fiabilidad fuera de rango (0-100)';
  END IF;

  _tenant_id := public.user_tenant_id(auth.uid());
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin club asignado';
  END IF;

  INSERT INTO public.player_ratings (
    tenant_id, user_id, sport, level, reliability, initial_level, onboarding_completed_at
  ) VALUES (
    _tenant_id, auth.uid(), _sport, _initial_level, _initial_reliability, _initial_level, now()
  )
  ON CONFLICT (user_id, sport) DO UPDATE
    SET level = EXCLUDED.level,
        reliability = EXCLUDED.reliability,
        initial_level = EXCLUDED.initial_level,
        onboarding_completed_at = COALESCE(public.player_ratings.onboarding_completed_at, now()),
        updated_at = now()
  RETURNING * INTO _row;

  INSERT INTO public.rating_history (
    tenant_id, user_id, sport,
    level_before, level_after, delta,
    reliability_before, reliability_after,
    source, recorded_by, notes
  ) VALUES (
    _tenant_id, auth.uid(), _sport,
    0, _initial_level, _initial_level,
    0, _initial_reliability,
    'onboarding', auth.uid(), 'Cuestionario de nivel inicial completado'
  );

  RETURN _row;
END $$;

-- 10) RPC: bajar nivel manualmente (Playtomic permite bajar, no subir)
CREATE OR REPLACE FUNCTION public.lower_my_rating(
  _sport public.rating_sport,
  _new_level numeric,
  _reason text DEFAULT NULL
)
RETURNS public.player_ratings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.player_ratings;
  _current public.player_ratings;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO _current FROM public.player_ratings
  WHERE user_id = auth.uid() AND sport = _sport;

  IF _current.id IS NULL THEN
    RAISE EXCEPTION 'No tienes rating para este deporte';
  END IF;

  IF _new_level >= _current.level THEN
    RAISE EXCEPTION 'Solo puedes bajar tu nivel manualmente';
  END IF;

  IF _new_level < 0 THEN
    RAISE EXCEPTION 'Nivel mínimo 0';
  END IF;

  UPDATE public.player_ratings
    SET level = _new_level,
        reliability = GREATEST(reliability - 20, 10), -- baja fiabilidad al ajustar manual
        last_change_delta = _new_level - _current.level,
        updated_at = now()
    WHERE id = _current.id
    RETURNING * INTO _row;

  INSERT INTO public.rating_history (
    tenant_id, user_id, sport,
    level_before, level_after, delta,
    reliability_before, reliability_after,
    source, recorded_by, notes
  ) VALUES (
    _row.tenant_id, auth.uid(), _sport,
    _current.level, _new_level, _new_level - _current.level,
    _current.reliability, _row.reliability,
    'user_manual_lower', auth.uid(), _reason
  );

  RETURN _row;
END $$;