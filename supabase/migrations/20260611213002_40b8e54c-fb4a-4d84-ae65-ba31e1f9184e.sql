-- Restaurar cuerpo original; único cambio: 'tournament' -> 'tournament_match'
CREATE OR REPLACE FUNCTION public.emit_match_observation(_tournament_match_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_cat   public.tournament_categories%ROWTYPE;
  v_reg_a public.tournament_registrations%ROWTYPE;
  v_reg_b public.tournament_registrations%ROWTYPE;
  v_tenant_inst boolean;
  v_existing_id uuid;
  v_new_id uuid;
  v_winner char(1);
  v_profile_winner char(1);
  v_source_type text;
  v_side_a uuid[];
  v_side_b uuid[];
  v_winners uuid[];
  v_losers uuid[];
  v_sport_enum public.rating_sport;
  v_profile jsonb;
  v_is_americano boolean;
BEGIN
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _tournament_match_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_match.status::text <> 'jugado' THEN RETURN NULL; END IF;
  IF v_match.walkover THEN RETURN NULL; END IF;
  IF v_match.score IS NULL THEN RETURN NULL; END IF;

  v_is_americano := (v_match.phase = 'americano');

  IF v_is_americano THEN
    IF v_match.winner_side IS NULL THEN RETURN NULL; END IF;
    IF v_match.side_a_user_ids IS NULL OR v_match.side_b_user_ids IS NULL THEN RETURN NULL; END IF;
  ELSE
    IF v_match.winner_registration_id IS NULL THEN RETURN NULL; END IF;
    IF v_match.registration_a_id IS NULL OR v_match.registration_b_id IS NULL THEN RETURN NULL; END IF;
  END IF;

  SELECT id INTO v_existing_id
    FROM public.match_observation_outbox
   WHERE tournament_match_id = _tournament_match_id AND status = 'emitted'
   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = v_match.tournament_category_id;

  IF v_is_americano THEN
    v_side_a := v_match.side_a_user_ids;
    v_side_b := v_match.side_b_user_ids;
    v_winner := v_match.winner_side;
  ELSE
    SELECT * INTO v_reg_a FROM public.tournament_registrations WHERE id = v_match.registration_a_id;
    SELECT * INTO v_reg_b FROM public.tournament_registrations WHERE id = v_match.registration_b_id;
    v_side_a := ARRAY_REMOVE(ARRAY[v_reg_a.player1_user_id, v_reg_a.player2_user_id], NULL);
    v_side_b := ARRAY_REMOVE(ARRAY[v_reg_b.player1_user_id, v_reg_b.player2_user_id], NULL);
    IF v_match.winner_registration_id = v_reg_a.id THEN
      v_winner := 'a';
    ELSE
      v_winner := 'b';
    END IF;
  END IF;

  IF v_winner = 'a' THEN
    v_winners := v_side_a; v_losers := v_side_b;
  ELSE
    v_winners := v_side_b; v_losers := v_side_a;
  END IF;

  v_profile := CASE
    WHEN v_cat.config IS NOT NULL AND v_cat.config ? 'scoring'
      THEN v_cat.config->'scoring'
    ELSE NULL
  END;
  IF v_profile IS NOT NULL THEN
    v_profile_winner := public._compute_match_winner(v_match.score, v_profile);
    IF v_profile_winner IS NOT NULL AND v_profile_winner <> v_winner THEN
      RAISE NOTICE 'emit_match_observation: profile winner (%) difiere del registrado (%) en match %',
        v_profile_winner, v_winner, _tournament_match_id;
    END IF;
  END IF;

  v_source_type := CASE WHEN v_cat.preset_key = 'escalerilla' THEN 'escalerilla' ELSE 'tournament' END;

  SELECT is_institutional INTO v_tenant_inst FROM public.tenants WHERE id = v_match.tenant_id;

  INSERT INTO public.match_observation_outbox (
    tenant_id, tournament_match_id, sport, format, source_type, verified_source,
    side_a_players, side_b_players, match_winner, sets, played_at, status
  ) VALUES (
    v_match.tenant_id,
    _tournament_match_id,
    v_cat.sport::text,
    v_cat.modality::text,
    v_source_type,
    COALESCE(v_tenant_inst, false),
    v_side_a,
    v_side_b,
    v_winner,
    v_match.score,
    COALESCE(v_match.played_at, v_match.updated_at, now()),
    'emitted'
  ) RETURNING id INTO v_new_id;

  v_sport_enum := CASE v_cat.discipline::text
    WHEN 'tenis_singles' THEN 'tenis_singles'::public.rating_sport
    WHEN 'tenis_dobles'  THEN 'tenis_dobles'::public.rating_sport
    WHEN 'padel_dobles'  THEN 'padel'::public.rating_sport
    WHEN 'padel'         THEN 'padel'::public.rating_sport
    ELSE 'tenis_singles'::public.rating_sport
  END;

  IF array_length(v_winners,1) > 0 AND array_length(v_losers,1) > 0 THEN
    PERFORM public._apply_rating_for_match(
      v_winners, v_losers, v_sport_enum,
      'tournament_match'::public.rating_change_source,  -- FIX: valor válido del enum
      _tournament_match_id,
      NULL
    );
  END IF;

  RETURN v_new_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.emit_match_observation_impl(uuid);

-- Re-emitir observaciones para los partidos QA jugados sin observación
DO $$
DECLARE
  v_tenant uuid := public._qa_tenant_id();
  v_m record;
  v_ok int := 0;
  v_fail int := 0;
BEGIN
  IF v_tenant IS NULL THEN RETURN; END IF;
  FOR v_m IN
    SELECT tm.id
      FROM public.tournament_matches tm
      JOIN public.tournament_categories tc ON tc.id = tm.tournament_category_id
     WHERE tc.tenant_id = v_tenant
       AND tm.status = 'jugado'
       AND tm.score IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.match_observation_outbox o
          WHERE o.tournament_match_id = tm.id AND o.status = 'emitted'
       )
  LOOP
    BEGIN
      PERFORM public.emit_match_observation(v_m.id);
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
    END;
  END LOOP;
  RAISE NOTICE 're-emit ok=% fail=%', v_ok, v_fail;
END $$;