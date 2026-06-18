-- Tabla de configuración de rating por club
CREATE TABLE public.tenant_rating_config (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_c_max NUMERIC(3,2) NOT NULL DEFAULT 2.50,
  category_b_max NUMERIC(3,2) NOT NULL DEFAULT 4.00,
  category_a_min NUMERIC(3,2) NOT NULL DEFAULT 4.00,
  k_factor_low_reliability NUMERIC(3,2) NOT NULL DEFAULT 0.20,
  k_factor_mid_reliability NUMERIC(3,2) NOT NULL DEFAULT 0.10,
  k_factor_high_reliability NUMERIC(3,2) NOT NULL DEFAULT 0.05,
  reliability_gain_per_match INTEGER NOT NULL DEFAULT 4,
  reliability_decay_after_days INTEGER NOT NULL DEFAULT 30,
  reliability_decay_per_period INTEGER NOT NULL DEFAULT 5,
  min_reliability_for_category INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT category_thresholds_ordered CHECK (category_c_max <= category_b_max)
);

ALTER TABLE public.tenant_rating_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven config rating de su club"
  ON public.tenant_rating_config FOR SELECT
  TO authenticated
  USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona config rating"
  ON public.tenant_rating_config FOR ALL
  TO authenticated
  USING (is_club_admin_of(auth.uid(), tenant_id))
  WITH CHECK (is_club_admin_of(auth.uid(), tenant_id));

CREATE TRIGGER trg_tenant_rating_config_updated
  BEFORE UPDATE ON public.tenant_rating_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed config por defecto para todos los tenants existentes
INSERT INTO public.tenant_rating_config (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Función helper: derivar categoría A/B/C desde nivel
CREATE OR REPLACE FUNCTION public.get_player_category(_level NUMERIC, _tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c_max NUMERIC;
  b_max NUMERIC;
BEGIN
  SELECT category_c_max, category_b_max
    INTO c_max, b_max
  FROM public.tenant_rating_config
  WHERE tenant_id = _tenant_id;

  IF NOT FOUND THEN
    c_max := 2.50;
    b_max := 4.00;
  END IF;

  IF _level < c_max THEN
    RETURN 'C';
  ELSIF _level < b_max THEN
    RETURN 'B';
  ELSE
    RETURN 'A';
  END IF;
END;
$$;

-- Función Elo: calcula nuevo nivel y reliability tras un match
CREATE OR REPLACE FUNCTION public.recalculate_rating_after_match(
  _user_id UUID,
  _opponent_level NUMERIC,
  _won BOOLEAN,
  _sport rating_sport,
  _source rating_change_source,
  _source_ref_id UUID DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS public.player_ratings
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rating public.player_ratings;
  v_config public.tenant_rating_config;
  v_k NUMERIC;
  v_expected NUMERIC;
  v_actual NUMERIC;
  v_delta NUMERIC;
  v_new_level NUMERIC;
  v_new_reliability INTEGER;
  v_level_before NUMERIC;
  v_reliability_before INTEGER;
BEGIN
  SELECT * INTO v_rating
  FROM public.player_ratings
  WHERE user_id = _user_id AND sport = _sport
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player rating not found for user % sport %', _user_id, _sport;
  END IF;

  SELECT * INTO v_config
  FROM public.tenant_rating_config
  WHERE tenant_id = v_rating.tenant_id;

  IF NOT FOUND THEN
    v_config.k_factor_low_reliability := 0.20;
    v_config.k_factor_mid_reliability := 0.10;
    v_config.k_factor_high_reliability := 0.05;
    v_config.reliability_gain_per_match := 4;
  END IF;

  -- K dinámico según reliability
  IF v_rating.reliability < 30 THEN
    v_k := v_config.k_factor_low_reliability;
  ELSIF v_rating.reliability < 70 THEN
    v_k := v_config.k_factor_mid_reliability;
  ELSE
    v_k := v_config.k_factor_high_reliability;
  END IF;

  v_expected := 1.0 / (1.0 + power(10, (_opponent_level - v_rating.level) / 1.0));
  v_actual := CASE WHEN _won THEN 1.0 ELSE 0.0 END;
  v_delta := round((v_k * (v_actual - v_expected))::numeric, 4);

  v_level_before := v_rating.level;
  v_reliability_before := v_rating.reliability;

  v_new_level := GREATEST(0, LEAST(7, v_rating.level + v_delta));
  v_new_reliability := LEAST(100, v_rating.reliability + v_config.reliability_gain_per_match);

  UPDATE public.player_ratings
  SET level = v_new_level,
      reliability = v_new_reliability,
      matches_played = matches_played + 1,
      competitive_matches = competitive_matches + 1,
      last_match_at = now(),
      last_change_delta = v_delta,
      updated_at = now()
  WHERE id = v_rating.id
  RETURNING * INTO v_rating;

  INSERT INTO public.rating_history (
    tenant_id, user_id, sport,
    level_before, level_after, delta,
    reliability_before, reliability_after,
    source, source_ref_id, notes
  ) VALUES (
    v_rating.tenant_id, _user_id, _sport,
    v_level_before, v_new_level, v_delta,
    v_reliability_before, v_new_reliability,
    _source, _source_ref_id, _notes
  );

  RETURN v_rating;
END;
$$;

-- Helper: rating + categoría del usuario actual
CREATE OR REPLACE FUNCTION public.get_my_rating_with_category()
RETURNS TABLE (
  rating public.player_ratings,
  category TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rating public.player_ratings;
BEGIN
  SELECT * INTO v_rating
  FROM public.player_ratings
  WHERE user_id = auth.uid()
  ORDER BY matches_played DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v_rating, public.get_player_category(v_rating.level, v_rating.tenant_id);
END;
$$;