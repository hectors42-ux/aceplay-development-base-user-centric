DROP FUNCTION IF EXISTS public.recalculate_rating_after_match(uuid, numeric, boolean, public.rating_sport, public.rating_change_source, uuid, text);

CREATE OR REPLACE FUNCTION public.recalculate_rating_after_match(
  _user_id uuid,
  _opponent_level numeric,
  _won boolean,
  _sport public.rating_sport,
  _source public.rating_change_source,
  _source_ref_id uuid DEFAULT NULL::uuid,
  _notes text DEFAULT NULL::text,
  _k_multiplier numeric DEFAULT 1.0
)
RETURNS public.player_ratings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  IF v_rating.reliability < 30 THEN
    v_k := v_config.k_factor_low_reliability;
  ELSIF v_rating.reliability < 70 THEN
    v_k := v_config.k_factor_mid_reliability;
  ELSE
    v_k := v_config.k_factor_high_reliability;
  END IF;

  v_k := v_k * COALESCE(_k_multiplier, 1.0);

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