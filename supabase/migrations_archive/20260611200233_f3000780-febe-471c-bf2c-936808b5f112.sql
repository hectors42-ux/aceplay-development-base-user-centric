
-- 1) Helper: ganador del partido según el perfil de scoring
CREATE OR REPLACE FUNCTION public._compute_match_winner(_score jsonb, _profile jsonb)
RETURNS char(1)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s jsonb;
  kind text;
  win_by text := COALESCE(_profile->>'win_by', 'sets');
  a int := 0;
  b int := 0;
  ga int := 0;
  gb int := 0;
  stb_a int := 0;
  stb_b int := 0;
  va int;
  vb int;
BEGIN
  IF _score IS NULL OR jsonb_typeof(_score) <> 'array' THEN
    RETURN NULL;
  END IF;

  FOR s IN SELECT * FROM jsonb_array_elements(_score) LOOP
    va := COALESCE((s->>'a')::int, 0);
    vb := COALESCE((s->>'b')::int, 0);
    kind := COALESCE(s->>'kind', 'set');
    IF kind = 'super_tb' THEN
      stb_a := stb_a + va;
      stb_b := stb_b + vb;
      IF va > vb THEN a := a + 1; ELSIF vb > va THEN b := b + 1; END IF;
    ELSE
      ga := ga + va;
      gb := gb + vb;
      IF va > vb THEN a := a + 1; ELSIF vb > va THEN b := b + 1; END IF;
    END IF;
  END LOOP;

  IF win_by = 'games' THEN
    -- juegos totales + tie-break decisorio cuenta como 1 game extra
    IF stb_a > stb_b THEN ga := ga + 1; ELSIF stb_b > stb_a THEN gb := gb + 1; END IF;
    IF ga = gb THEN RETURN NULL; END IF;
    RETURN CASE WHEN ga > gb THEN 'a' ELSE 'b' END;
  ELSE
    IF a = b THEN RETURN NULL; END IF;
    RETURN CASE WHEN a > b THEN 'a' ELSE 'b' END;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._compute_match_winner(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._compute_match_winner(jsonb, jsonb) TO authenticated, service_role;

-- 2) emit_match_observation: si la categoría tiene profile, validar contra él
CREATE OR REPLACE FUNCTION public.emit_match_observation(_tournament_match_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _tournament_match_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_match.status::text <> 'jugado' THEN RETURN NULL; END IF;
  IF v_match.walkover THEN RETURN NULL; END IF;
  IF v_match.winner_registration_id IS NULL THEN RETURN NULL; END IF;
  IF v_match.score IS NULL THEN RETURN NULL; END IF;
  IF v_match.registration_a_id IS NULL OR v_match.registration_b_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_existing_id
    FROM public.match_observation_outbox
   WHERE tournament_match_id = _tournament_match_id AND status = 'emitted'
   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = v_match.tournament_category_id;
  SELECT * INTO v_reg_a FROM public.tournament_registrations WHERE id = v_match.registration_a_id;
  SELECT * INTO v_reg_b FROM public.tournament_registrations WHERE id = v_match.registration_b_id;

  v_side_a := ARRAY_REMOVE(ARRAY[v_reg_a.player1_user_id, v_reg_a.player2_user_id], NULL);
  v_side_b := ARRAY_REMOVE(ARRAY[v_reg_b.player1_user_id, v_reg_b.player2_user_id], NULL);

  IF v_match.winner_registration_id = v_reg_a.id THEN
    v_winner := 'a'; v_winners := v_side_a; v_losers := v_side_b;
  ELSE
    v_winner := 'b'; v_winners := v_side_b; v_losers := v_side_a;
  END IF;

  -- PRD 8: verificar contra el perfil de scoring si existe
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
    WHEN 'padel'         THEN 'padel'::public.rating_sport
    ELSE 'tenis_singles'::public.rating_sport
  END;

  IF array_length(v_winners,1) > 0 AND array_length(v_losers,1) > 0 THEN
    PERFORM public._apply_rating_for_match(
      v_winners, v_losers, v_sport_enum,
      'tournament'::public.rating_change_source,
      _tournament_match_id,
      NULL
    );
  END IF;

  RETURN v_new_id;
END;
$$;
