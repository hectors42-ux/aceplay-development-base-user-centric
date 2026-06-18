
-- Make partner matchmaking sport-aware
DROP FUNCTION IF EXISTS public.get_partner_suggestions(integer);
DROP FUNCTION IF EXISTS public.compute_partner_fit_breakdown(uuid, uuid);

CREATE OR REPLACE FUNCTION public.compute_partner_fit_breakdown(
  _me uuid,
  _them uuid,
  _sport rating_sport DEFAULT 'tenis_singles'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := user_tenant_id(_me);
  v_my_level numeric; v_their_level numeric;
  v_my_matches int; v_their_matches int;
  v_my_last timestamptz; v_their_last timestamptz;
  v_my_birth date; v_their_birth date;
  v_my_years int; v_their_years int;
  v_my_surface text; v_their_surface text;
  v_overlap_minutes numeric := 0;
  v_common_slots int := 0;
  v_played_together int := 0;
  v_last_played timestamptz;
  v_my_wins int := 0; v_their_wins int := 0;
  v_surfaces_in_club int := 1;
  v_nivel int; v_horarios int; v_frecuencia int;
  v_historial int; v_edad int; v_superficie int;
  v_nivel_hint text; v_horarios_hint text; v_frec_hint text;
  v_hist_hint text; v_edad_hint text; v_sup_hint text;
  v_score numeric;
  v_w_sup numeric := 0.05; v_w_hist numeric := 0.20;
BEGIN
  SELECT pr.level, pr.matches_played, pr.last_match_at
    INTO v_my_level, v_my_matches, v_my_last
  FROM public.player_ratings pr
  WHERE pr.user_id = _me AND pr.sport = _sport
  ORDER BY pr.updated_at DESC NULLS LAST LIMIT 1;

  SELECT pr.level, pr.matches_played, pr.last_match_at
    INTO v_their_level, v_their_matches, v_their_last
  FROM public.player_ratings pr
  WHERE pr.user_id = _them AND pr.sport = _sport
  ORDER BY pr.updated_at DESC NULLS LAST LIMIT 1;

  SELECT birth_date, years_playing, favorite_surface::text
    INTO v_my_birth, v_my_years, v_my_surface
  FROM public.profiles WHERE user_id = _me LIMIT 1;

  SELECT birth_date, years_playing, favorite_surface::text
    INTO v_their_birth, v_their_years, v_their_surface
  FROM public.profiles WHERE user_id = _them LIMIT 1;

  -- Nivel: si falta rating en este deporte, neutral 50 "En calibración"
  IF v_my_level IS NULL OR v_their_level IS NULL THEN
    v_nivel := 50; v_nivel_hint := 'En calibración';
  ELSE
    v_nivel := GREATEST(0, LEAST(100, ROUND(100 - ABS(v_my_level - v_their_level) * 25)::int));
    v_nivel_hint := CASE WHEN v_nivel >= 80 THEN 'Excelente' WHEN v_nivel >= 60 THEN 'Compatible' ELSE 'Disparejo' END;
  END IF;

  -- Horarios
  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(a.ends_at, b.ends_at) - GREATEST(a.starts_at, b.starts_at))) / 60), 0),
         COUNT(*)
    INTO v_overlap_minutes, v_common_slots
  FROM public.user_availability a
  JOIN public.user_availability b
    ON a.weekday = b.weekday AND a.starts_at < b.ends_at AND b.starts_at < a.ends_at
  WHERE a.user_id = _me AND b.user_id = _them AND a.is_active AND b.is_active;
  v_horarios := LEAST(100, ROUND((v_overlap_minutes / 60.0) / 8.0 * 100)::int);
  v_horarios_hint := CASE WHEN v_common_slots >= 3 THEN 'Compatible' WHEN v_common_slots >= 1 THEN 'Parcial' ELSE 'Sin overlap' END;

  -- Frecuencia
  v_frecuencia := LEAST(100, ROUND(((COALESCE(v_my_matches,0) + COALESCE(v_their_matches,0)) / 2.0) * 5)::int);
  IF v_their_last IS NOT NULL AND v_their_last > now() - interval '14 days' THEN
    v_frec_hint := 'Muy activo';
  ELSIF v_their_last IS NOT NULL AND v_their_last > now() - interval '45 days' THEN
    v_frec_hint := 'Activo';
  ELSE
    v_frec_hint := 'Poco activo';
  END IF;

  -- Historial entre ellos (ladder)
  SELECT COUNT(*), MAX(played_at),
         COUNT(*) FILTER (WHERE winner_user_id = _me),
         COUNT(*) FILTER (WHERE winner_user_id = _them)
    INTO v_played_together, v_last_played, v_my_wins, v_their_wins
  FROM public.ladder_challenges
  WHERE tenant_id = v_tenant
    AND status = 'completado'
    AND played_at IS NOT NULL
    AND ((challenger_user_id = _me AND challenged_user_id = _them)
      OR (challenger_user_id = _them AND challenged_user_id = _me));

  IF v_played_together = 0 THEN
    v_historial := 40; v_hist_hint := 'Nuevo rival';
  ELSE
    DECLARE v_balance numeric;
    BEGIN
      v_balance := 100 - ABS(v_my_wins - v_their_wins)::numeric / GREATEST(v_played_together,1) * 100;
      v_historial := ROUND(LEAST(100, v_balance * 0.6 + LEAST(40, v_played_together * 10)))::int;
      IF v_last_played IS NOT NULL AND v_last_played < now() - interval '30 days' THEN
        v_historial := LEAST(100, v_historial + 15);
        v_hist_hint := 'Revancha';
      ELSIF v_played_together = 1 THEN
        v_hist_hint := '1 partido';
      ELSE
        v_hist_hint := v_played_together || ' partidos';
      END IF;
    END;
  END IF;

  -- Edad
  DECLARE v_age_diff int := 0; v_year_diff int := 0; v_age_score int := 70; v_year_score int := 70;
  BEGIN
    IF v_my_birth IS NOT NULL AND v_their_birth IS NOT NULL THEN
      v_age_diff := ABS(EXTRACT(YEAR FROM age(v_my_birth)) - EXTRACT(YEAR FROM age(v_their_birth)))::int;
      v_age_score := GREATEST(0, 100 - v_age_diff * 5);
    END IF;
    IF v_my_years IS NOT NULL AND v_their_years IS NOT NULL THEN
      v_year_diff := ABS(v_my_years - v_their_years);
      v_year_score := GREATEST(0, 100 - v_year_diff * 8);
    END IF;
    v_edad := ROUND((v_age_score + v_year_score) / 2.0)::int;
    v_edad_hint := CASE
      WHEN v_age_diff <= 5 THEN 'Generación cercana'
      WHEN v_age_diff <= 12 THEN 'Diferencia moderada'
      ELSE ABS(v_age_diff) || ' años'
    END;
  END;

  -- Superficie
  SELECT COUNT(DISTINCT surface) INTO v_surfaces_in_club FROM public.courts WHERE tenant_id = v_tenant AND is_active;
  IF v_surfaces_in_club <= 1 THEN
    v_superficie := NULL;
    v_sup_hint := 'Única superficie';
    v_w_sup := 0; v_w_hist := 0.25;
  ELSIF v_my_surface IS NULL OR v_their_surface IS NULL THEN
    v_superficie := 60; v_sup_hint := 'Sin preferencia';
  ELSIF v_my_surface = v_their_surface THEN
    v_superficie := 100; v_sup_hint := 'Misma (' || v_my_surface || ')';
  ELSE
    v_superficie := 40; v_sup_hint := 'Distinta';
  END IF;

  v_score := v_nivel * 0.30
           + v_horarios * 0.20
           + v_frecuencia * 0.15
           + v_historial * v_w_hist
           + v_edad * 0.10
           + COALESCE(v_superficie, 0) * v_w_sup;

  RETURN jsonb_build_object(
    'score', GREATEST(0, LEAST(100, ROUND(v_score)::int)),
    'nivel',       jsonb_build_object('value', v_nivel,      'hint', v_nivel_hint),
    'horarios',    jsonb_build_object('value', v_horarios,   'hint', v_horarios_hint),
    'frecuencia',  jsonb_build_object('value', v_frecuencia, 'hint', v_frec_hint),
    'historial',   jsonb_build_object('value', v_historial,  'hint', v_hist_hint),
    'edad',        jsonb_build_object('value', v_edad,       'hint', v_edad_hint),
    'superficie',  jsonb_build_object('value', v_superficie, 'hint', v_sup_hint)
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.compute_partner_fit_breakdown(uuid, uuid, rating_sport) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_partner_suggestions(
  _limit integer DEFAULT 12,
  _sport rating_sport DEFAULT 'tenis_singles'
)
RETURNS TABLE(
  user_id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  level numeric,
  level_diff numeric,
  compat_score integer,
  reasons text[],
  breakdown jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid := user_tenant_id(v_uid);
  v_my_level numeric;
BEGIN
  SELECT pr.level INTO v_my_level
  FROM public.player_ratings pr
  WHERE pr.user_id = v_uid AND pr.sport = _sport
  ORDER BY pr.updated_at DESC NULLS LAST LIMIT 1;

  RETURN QUERY
  WITH base AS (
    SELECT
      p.user_id, p.first_name, p.last_name, p.avatar_url,
      pr.level,
      CASE
        WHEN pr.level IS NULL OR v_my_level IS NULL THEN NULL
        ELSE ABS(pr.level - v_my_level)
      END AS level_diff,
      public.compute_partner_fit_breakdown(v_uid, p.user_id, _sport) AS bd
    FROM public.profiles p
    LEFT JOIN LATERAL (
      SELECT pr2.level FROM public.player_ratings pr2
      WHERE pr2.user_id = p.user_id AND pr2.sport = _sport
      ORDER BY pr2.updated_at DESC NULLS LAST LIMIT 1
    ) pr ON true
    WHERE p.tenant_id = v_tenant AND p.user_id <> v_uid
  )
  SELECT
    b.user_id, b.first_name, b.last_name, b.avatar_url,
    b.level, b.level_diff,
    (b.bd->>'score')::int AS compat_score,
    ARRAY[]::text[] AS reasons,
    b.bd AS breakdown
  FROM base b
  ORDER BY (b.bd->>'score')::int DESC NULLS LAST, b.level_diff ASC NULLS LAST
  LIMIT _limit;
END $function$;

GRANT EXECUTE ON FUNCTION public.get_partner_suggestions(integer, rating_sport) TO authenticated, service_role;
