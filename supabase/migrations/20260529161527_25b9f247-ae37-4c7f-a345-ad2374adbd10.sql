CREATE OR REPLACE FUNCTION public._apply_rating_for_match(_winner_users uuid[], _loser_users uuid[], _sport rating_sport, _source rating_change_source, _source_ref_id uuid, _notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_winner_avg numeric;
  v_loser_avg numeric;
  v_uid uuid;
  v_tenant uuid;
  v_default_level numeric := 2.50;
BEGIN
  -- Asegurar fila player_ratings para todos los participantes (auto-seed)
  FOREACH v_uid IN ARRAY (_winner_users || _loser_users) LOOP
    SELECT tenant_id INTO v_tenant FROM public.profiles WHERE user_id = v_uid LIMIT 1;
    IF v_tenant IS NOT NULL THEN
      INSERT INTO public.player_ratings (user_id, tenant_id, sport, level, initial_level, reliability)
      VALUES (v_uid, v_tenant, _sport, v_default_level, v_default_level, 15)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Promedios
  SELECT COALESCE(AVG(pr.level), 0) INTO v_winner_avg
    FROM public.player_ratings pr
   WHERE pr.user_id = ANY(_winner_users) AND pr.sport = _sport;

  SELECT COALESCE(AVG(pr.level), 0) INTO v_loser_avg
    FROM public.player_ratings pr
   WHERE pr.user_id = ANY(_loser_users) AND pr.sport = _sport;

  -- Ganadores
  FOREACH v_uid IN ARRAY _winner_users LOOP
    IF EXISTS(SELECT 1 FROM public.player_ratings WHERE user_id = v_uid AND sport = _sport) THEN
      PERFORM public.recalculate_rating_after_match(
        v_uid, v_loser_avg, true, _sport, _source, _source_ref_id, _notes
      );
    END IF;
  END LOOP;

  -- Perdedores
  FOREACH v_uid IN ARRAY _loser_users LOOP
    IF EXISTS(SELECT 1 FROM public.player_ratings WHERE user_id = v_uid AND sport = _sport) THEN
      PERFORM public.recalculate_rating_after_match(
        v_uid, v_winner_avg, false, _sport, _source, _source_ref_id, _notes
      );
    END IF;
  END LOOP;
END;
$function$;