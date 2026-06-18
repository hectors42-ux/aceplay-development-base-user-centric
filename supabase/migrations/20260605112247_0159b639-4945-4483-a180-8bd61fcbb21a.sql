CREATE OR REPLACE FUNCTION public.compute_partner_fit_breakdown(_me uuid, _them uuid, _sport rating_sport DEFAULT 'tenis_singles'::rating_sport)
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

  IF v_my_level IS NULL OR v_their_level IS NULL THEN
    v_nivel := 50; v_nivel_hint := 'En calibración';
  ELSE
    v_nivel := GREATEST(0, LEAST(100, ROUND(100 - ABS(v_my_level - v_their_level) * 25)::int));
    v_nivel_hint := CASE WHEN v_nivel >= 80 THEN 'Excelente' WHEN v_nivel >= 60 THEN 'Compatible' ELSE 'Disparejo' END;
  END IF;

  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(a.ends_at, b.ends_at) - GREATEST(a.starts_at, b.starts_at))) / 60), 0),
         COUNT(*)
    INTO v_overlap_minutes, v_common_slots
  FROM public.user_availability a
  JOIN public.user_availability b
    ON a.weekday = b.weekday AND a.starts_at < b.ends_at AND b.starts_at < a.ends_at
  WHERE a.user_id = _me AND b.user_id = _them AND a.is_active AND b.is_active;
  v_horarios := LEAST(100, ROUND((v_overlap_minutes / 60.0) / 8.0 * 100)::int);
  v_horarios_hint := CASE WHEN v_common_slots >= 3 THEN 'Compatible' WHEN v_common_slots >= 1 THEN 'Parcial' ELSE 'Sin overlap' END;

  v_frecuencia := LEAST(100, ROUND(((COALESCE(v_my_matches,0) + COALESCE(v_their_matches,0)) / 2.0) * 5)::int);
  IF v_their_last IS NOT NULL AND v_their_last > now() - interval '14 days' THEN
    v_frec_hint := 'Muy activo';
  ELSIF v_their_last IS NOT NULL AND v_their_last > now() - interval '45 days' THEN
    v_frec_hint := 'Activo';
  ELSE
    v_frec_hint := 'Poco activo';
  END IF;

  SELECT COUNT(*), MAX(played_at),
         COUNT(*) FILTER (WHERE winner_user_id = _me),
         COUNT(*) FILTER (WHERE winner_user_id = _them)
    INTO v_played_together, v_last_played, v_my_wins, v_their_wins
  FROM public.ladder_challenges
  WHERE tenant_id = v_tenant
    AND status = 'jugado'
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

  IF v_my_birth IS NOT NULL AND v_their_birth IS NOT NULL THEN
    v_edad := GREATEST(0, 100 - ABS(EXTRACT(YEAR FROM age(v_my_birth)) - EXTRACT(YEAR FROM age(v_their_birth)))::int * 3);
    v_edad_hint := CASE WHEN v_edad >= 80 THEN 'Misma generación' WHEN v_edad >= 50 THEN 'Cercana' ELSE 'Lejana' END;
  ELSE
    v_edad := 50; v_edad_hint := 'Sin dato';
  END IF;

  IF v_my_surface IS NOT NULL AND v_their_surface IS NOT NULL THEN
    v_superficie := CASE WHEN v_my_surface = v_their_surface THEN 100 ELSE 40 END;
    v_sup_hint := CASE WHEN v_my_surface = v_their_surface THEN 'Coincide' ELSE 'Distinta' END;
  ELSE
    v_superficie := 50; v_sup_hint := 'Sin dato';
  END IF;

  v_score := ROUND(
    v_nivel * 0.30 +
    v_horarios * 0.25 +
    v_frecuencia * 0.20 +
    v_historial * v_w_hist +
    v_edad * 0.05 +
    v_superficie * v_w_sup
  );

  RETURN jsonb_build_object(
    'score', v_score::int,
    'nivel', jsonb_build_object('value', v_nivel, 'hint', v_nivel_hint),
    'horarios', jsonb_build_object('value', v_horarios, 'hint', v_horarios_hint),
    'frecuencia', jsonb_build_object('value', v_frecuencia, 'hint', v_frec_hint),
    'historial', jsonb_build_object('value', v_historial, 'hint', v_hist_hint),
    'edad', jsonb_build_object('value', v_edad, 'hint', v_edad_hint),
    'superficie', jsonb_build_object('value', v_superficie, 'hint', v_sup_hint)
  );
END $function$;