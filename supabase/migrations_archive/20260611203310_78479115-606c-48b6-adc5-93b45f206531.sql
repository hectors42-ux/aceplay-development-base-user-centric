
-- =========================================================================
-- PRD 10 — Motor americano_rotacion: generator + standings + close + emit
-- =========================================================================

-- 1) Generador de la siguiente ronda
CREATE OR REPLACE FUNCTION public.generate_americano_round(
  _category_id uuid,
  _round_number int
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat public.tournament_categories%ROWTYPE;
  v_round_id uuid;
  v_players uuid[];
  v_remaining uuid[];
  v_bye uuid[];
  v_player_count int;
  v_tournament_id uuid;
  v_table_num int := 0;
  v_a1 uuid; v_a2 uuid; v_b1 uuid; v_b2 uuid;
  v_partner_count jsonb;
  v_pair_key text;
  v_other uuid;
  v_best_partner uuid;
  v_best_score int;
  v_score int;
BEGIN
  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = _category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;
  IF v_cat.motor::text <> 'americano_rotacion' THEN
    RAISE EXCEPTION 'Esta categoría no usa el motor americano_rotacion';
  END IF;

  -- Manager check
  SELECT tournament_id INTO v_tournament_id FROM public.tournament_categories WHERE id = _category_id;
  IF NOT public.is_tournament_manager(v_tournament_id) THEN
    RAISE EXCEPTION 'Solo el organizador puede generar rondas';
  END IF;

  -- Validar que la ronda no exista
  IF EXISTS (SELECT 1 FROM public.americano_rounds WHERE tournament_category_id = _category_id AND round_number = _round_number) THEN
    RAISE EXCEPTION 'La ronda % ya existe', _round_number;
  END IF;

  -- Validar ronda anterior finalizada (si existe)
  IF _round_number > 1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.americano_rounds
      WHERE tournament_category_id = _category_id
        AND round_number = _round_number - 1
        AND status = 'finalizada'
    ) THEN
      RAISE EXCEPTION 'La ronda anterior (%) no está finalizada', _round_number - 1;
    END IF;
  END IF;

  -- Jugadores inscritos confirmados (individual: solo player1)
  SELECT array_agg(player1_user_id ORDER BY random())
    INTO v_players
    FROM public.tournament_registrations
   WHERE tournament_category_id = _category_id
     AND status::text IN ('aprobada','confirmada','accepted','registered');

  IF v_players IS NULL OR array_length(v_players,1) < 4 THEN
    RAISE EXCEPTION 'Se necesitan al menos 4 jugadores inscritos';
  END IF;

  v_player_count := array_length(v_players,1);

  -- Historial de parejas previas (clave canónica "min|max")
  v_partner_count := '{}'::jsonb;
  IF _round_number > 1 THEN
    SELECT COALESCE(jsonb_object_agg(k, c), '{}'::jsonb) INTO v_partner_count
    FROM (
      SELECT k, COUNT(*)::int AS c
      FROM (
        SELECT CASE WHEN (side_a_user_ids[1])::text < (side_a_user_ids[2])::text
                    THEN (side_a_user_ids[1])::text || '|' || (side_a_user_ids[2])::text
                    ELSE (side_a_user_ids[2])::text || '|' || (side_a_user_ids[1])::text END AS k
          FROM public.tournament_matches
         WHERE tournament_category_id = _category_id
           AND phase = 'americano'
           AND array_length(side_a_user_ids,1) = 2
        UNION ALL
        SELECT CASE WHEN (side_b_user_ids[1])::text < (side_b_user_ids[2])::text
                    THEN (side_b_user_ids[1])::text || '|' || (side_b_user_ids[2])::text
                    ELSE (side_b_user_ids[2])::text || '|' || (side_b_user_ids[1])::text END AS k
          FROM public.tournament_matches
         WHERE tournament_category_id = _category_id
           AND phase = 'americano'
           AND array_length(side_b_user_ids,1) = 2
      ) s GROUP BY k
    ) t;
  END IF;

  -- Crear la ronda
  INSERT INTO public.americano_rounds (tenant_id, tournament_category_id, round_number, status)
  VALUES (v_cat.tenant_id, _category_id, _round_number, 'pendiente')
  RETURNING id INTO v_round_id;

  -- Bye: jugadores que sobran si v_player_count mod 4 != 0
  v_remaining := v_players;
  IF (v_player_count % 4) <> 0 THEN
    v_bye := v_remaining[v_player_count - (v_player_count % 4) + 1 : v_player_count];
    v_remaining := v_remaining[1 : v_player_count - (v_player_count % 4)];
    UPDATE public.americano_rounds SET bye_user_ids = v_bye WHERE id = v_round_id;
  END IF;

  -- Greedy: por cada mesa, elegir A1=primero del array; A2=quien menos veces fue compañero;
  -- B1=siguiente; B2=quien menos veces fue compañero de B1 entre los restantes.
  WHILE array_length(v_remaining,1) >= 4 LOOP
    v_table_num := v_table_num + 1;

    v_a1 := v_remaining[1];
    -- buscar mejor compañero para A1
    v_best_partner := NULL;
    v_best_score := NULL;
    FOREACH v_other IN ARRAY v_remaining[2:array_length(v_remaining,1)] LOOP
      v_pair_key := CASE WHEN v_a1::text < v_other::text
        THEN v_a1::text || '|' || v_other::text
        ELSE v_other::text || '|' || v_a1::text END;
      v_score := COALESCE((v_partner_count->>v_pair_key)::int, 0);
      IF v_best_score IS NULL OR v_score < v_best_score THEN
        v_best_score := v_score;
        v_best_partner := v_other;
      END IF;
    END LOOP;
    v_a2 := v_best_partner;
    v_remaining := array_remove(array_remove(v_remaining, v_a1), v_a2);

    v_b1 := v_remaining[1];
    v_best_partner := NULL;
    v_best_score := NULL;
    FOREACH v_other IN ARRAY v_remaining[2:array_length(v_remaining,1)] LOOP
      v_pair_key := CASE WHEN v_b1::text < v_other::text
        THEN v_b1::text || '|' || v_other::text
        ELSE v_other::text || '|' || v_b1::text END;
      v_score := COALESCE((v_partner_count->>v_pair_key)::int, 0);
      IF v_best_score IS NULL OR v_score < v_best_score THEN
        v_best_score := v_score;
        v_best_partner := v_other;
      END IF;
    END LOOP;
    v_b2 := v_best_partner;
    v_remaining := array_remove(array_remove(v_remaining, v_b1), v_b2);

    -- Insertar el partido
    INSERT INTO public.tournament_matches (
      tournament_id, tenant_id, tournament_category_id, round, bracket_position,
      phase, americano_round_id, side_a_user_ids, side_b_user_ids, status,
      acceptance_a, acceptance_b
    ) VALUES (
      v_cat.tournament_id, v_cat.tenant_id, _category_id, _round_number, v_table_num,
      'americano', v_round_id, ARRAY[v_a1, v_a2], ARRAY[v_b1, v_b2], 'pendiente'::match_status,
      'pendiente'::acceptance_status, 'pendiente'::acceptance_status
    );

    -- Actualizar historial en memoria
    v_pair_key := CASE WHEN v_a1::text < v_a2::text
      THEN v_a1::text || '|' || v_a2::text ELSE v_a2::text || '|' || v_a1::text END;
    v_partner_count := jsonb_set(v_partner_count, ARRAY[v_pair_key],
      to_jsonb(COALESCE((v_partner_count->>v_pair_key)::int,0) + 1));
    v_pair_key := CASE WHEN v_b1::text < v_b2::text
      THEN v_b1::text || '|' || v_b2::text ELSE v_b2::text || '|' || v_b1::text END;
    v_partner_count := jsonb_set(v_partner_count, ARRAY[v_pair_key],
      to_jsonb(COALESCE((v_partner_count->>v_pair_key)::int,0) + 1));
  END LOOP;

  RETURN v_round_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_americano_round(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_americano_round(uuid, int) TO authenticated, service_role;

-- 2) View: ranking individual por juegos ganados (acumulado)
CREATE OR REPLACE VIEW public.americano_individual_standings AS
WITH match_games AS (
  SELECT
    m.tournament_category_id,
    m.id AS match_id,
    m.side_a_user_ids,
    m.side_b_user_ids,
    m.winner_side,
    COALESCE((
      SELECT SUM((elem->>'a')::int)::int
      FROM jsonb_array_elements(m.score) elem
      WHERE (elem->>'kind') IS DISTINCT FROM 'super_tb'
    ), 0) AS games_a,
    COALESCE((
      SELECT SUM((elem->>'b')::int)::int
      FROM jsonb_array_elements(m.score) elem
      WHERE (elem->>'kind') IS DISTINCT FROM 'super_tb'
    ), 0) AS games_b
  FROM public.tournament_matches m
  WHERE m.phase = 'americano'
    AND m.status::text = 'jugado'
    AND m.score IS NOT NULL
),
player_rows AS (
  SELECT tournament_category_id, match_id, unnest(side_a_user_ids) AS user_id,
         games_a AS games_won, games_b AS games_against,
         CASE WHEN winner_side = 'a' THEN 1 ELSE 0 END AS won_int
  FROM match_games
  UNION ALL
  SELECT tournament_category_id, match_id, unnest(side_b_user_ids) AS user_id,
         games_b AS games_won, games_a AS games_against,
         CASE WHEN winner_side = 'b' THEN 1 ELSE 0 END AS won_int
  FROM match_games
)
SELECT
  tournament_category_id AS category_id,
  user_id,
  COUNT(DISTINCT match_id)::int       AS matches_played,
  SUM(won_int)::int                   AS matches_won,
  SUM(games_won)::int                 AS games_won,
  SUM(games_against)::int             AS games_against,
  (SUM(games_won) - SUM(games_against))::int AS games_diff,
  RANK() OVER (
    PARTITION BY tournament_category_id
    ORDER BY SUM(games_won) DESC, (SUM(games_won) - SUM(games_against)) DESC
  )::int AS position
FROM player_rows
GROUP BY tournament_category_id, user_id;

GRANT SELECT ON public.americano_individual_standings TO authenticated, anon;

-- 3) Cerrar competencia
CREATE OR REPLACE FUNCTION public.close_americano(_category_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat public.tournament_categories%ROWTYPE;
BEGIN
  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = _category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Categoría no encontrada'; END IF;
  IF NOT public.is_tournament_manager(v_cat.tournament_id) THEN
    RAISE EXCEPTION 'Solo el organizador puede cerrar la competencia';
  END IF;

  UPDATE public.tournament_categories
    SET status = 'finalizado'::tournament_status,
        updated_at = now()
  WHERE id = _category_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_americano(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_americano(uuid) TO authenticated, service_role;

-- 4) Ajustar emit_match_observation para soportar phase='americano'
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
      'tournament'::public.rating_change_source,
      _tournament_match_id,
      NULL
    );
  END IF;

  RETURN v_new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.emit_match_observation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emit_match_observation(uuid) TO authenticated, service_role;
