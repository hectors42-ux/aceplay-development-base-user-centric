-- Fix: emit_match_observation usaba 'tournament' que no existe en el enum
-- rating_change_source (debe ser 'tournament_match'). Esto hacía fallar
-- la emisión cada vez que un partido jugado intentaba propagar rating.
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
  v_match := (SELECT t FROM public.tournament_matches t WHERE id = _tournament_match_id);
  IF v_match.id IS NULL THEN RETURN NULL; END IF;
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

  -- Conservar idempotencia: si ya hay una observation emitida, reusarla
  SELECT id INTO v_existing_id
    FROM public.match_observation_outbox
   WHERE tournament_match_id = _tournament_match_id AND status = 'emitted'
   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN RETURN v_existing_id; END IF;

  -- Re-ejecuta el cuerpo original cambiando SOLO el valor del enum
  -- en la llamada a _apply_rating_for_match.
  PERFORM public.emit_match_observation_impl(_tournament_match_id);
  RETURN _tournament_match_id;
END;
$function$;

-- Workaround simple: en vez de reescribir toda la lógica, definimos
-- la versión "impl" que ejecuta el insert con el enum correcto.
CREATE OR REPLACE FUNCTION public.emit_match_observation_impl(_tournament_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_cat   public.tournament_categories%ROWTYPE;
  v_reg_a public.tournament_registrations%ROWTYPE;
  v_reg_b public.tournament_registrations%ROWTYPE;
  v_new_id uuid;
  v_winner char(1);
  v_source_type text;
  v_side_a uuid[];
  v_side_b uuid[];
  v_winners uuid[];
  v_losers uuid[];
  v_sport_enum public.rating_sport;
  v_is_americano boolean;
BEGIN
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _tournament_match_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = v_match.tournament_category_id;

  v_is_americano := (v_match.phase = 'americano');

  IF v_is_americano THEN
    v_side_a := v_match.side_a_user_ids;
    v_side_b := v_match.side_b_user_ids;
    v_winner := v_match.winner_side;
  ELSE
    SELECT * INTO v_reg_a FROM public.tournament_registrations WHERE id = v_match.registration_a_id;
    SELECT * INTO v_reg_b FROM public.tournament_registrations WHERE id = v_match.registration_b_id;
    v_side_a := ARRAY[v_reg_a.player1_user_id] || (CASE WHEN v_reg_a.player2_user_id IS NOT NULL THEN ARRAY[v_reg_a.player2_user_id] ELSE ARRAY[]::uuid[] END);
    v_side_b := ARRAY[v_reg_b.player1_user_id] || (CASE WHEN v_reg_b.player2_user_id IS NOT NULL THEN ARRAY[v_reg_b.player2_user_id] ELSE ARRAY[]::uuid[] END);
    v_winner := CASE WHEN v_match.winner_registration_id = v_reg_a.id THEN 'a' ELSE 'b' END;
  END IF;

  v_winners := CASE WHEN v_winner='a' THEN v_side_a ELSE v_side_b END;
  v_losers  := CASE WHEN v_winner='a' THEN v_side_b ELSE v_side_a END;

  v_source_type := CASE WHEN v_cat.preset_key = 'escalerilla' THEN 'escalerilla' ELSE 'tournament' END;

  INSERT INTO public.match_observation_outbox (
    tenant_id, tournament_match_id, sport, format, source_type, verified_source,
    side_a_user_ids, side_b_user_ids, winner_side, score, status, payload
  ) VALUES (
    v_match.tenant_id, _tournament_match_id,
    v_cat.discipline::text, v_cat.modality::text, v_source_type, true,
    v_side_a, v_side_b, v_winner, v_match.score, 'emitted'::observation_status,
    jsonb_build_object('motor', v_cat.motor, 'round', v_match.round)
  ) RETURNING id INTO v_new_id;

  v_sport_enum := CASE v_cat.discipline
    WHEN 'tenis_singles' THEN 'tenis_singles'::public.rating_sport
    WHEN 'tenis_dobles'  THEN 'tenis_dobles'::public.rating_sport
    WHEN 'padel_dobles'  THEN 'padel'::public.rating_sport
    WHEN 'padel'         THEN 'padel'::public.rating_sport
    ELSE 'tenis_singles'::public.rating_sport
  END;

  IF array_length(v_winners,1) > 0 AND array_length(v_losers,1) > 0 THEN
    PERFORM public._apply_rating_for_match(
      v_winners, v_losers, v_sport_enum,
      'tournament_match'::public.rating_change_source,
      _tournament_match_id,
      NULL
    );
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.emit_match_observation_impl(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.emit_match_observation_impl(uuid) FROM PUBLIC;

-- Re-emit para los torneos QA ya jugados
DO $$
DECLARE
  v_tenant uuid := public._qa_tenant_id();
  v_m record;
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
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'emit fail %: %', v_m.id, SQLERRM;
    END;
  END LOOP;
END $$;