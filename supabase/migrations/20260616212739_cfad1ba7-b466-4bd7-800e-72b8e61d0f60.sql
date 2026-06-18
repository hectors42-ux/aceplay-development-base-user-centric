
CREATE OR REPLACE FUNCTION public._demo_seed_padel_grupos_playoff(
  _label text,
  _state text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_tenant     uuid := public._demo_tenant_id();
  v_admin      uuid := public._demo_admin_uid();
  v_demouser   uuid := public._demo_user_uid('demouser@aceplay.cl');
  v_hector     uuid := public._demo_user_uid('hectors42@gmail.com');
  v_creator    uuid;
  v_name       text;
  v_tour_id    uuid;
  v_cat_id     uuid;
  v_n_players  int := 40;
  v_n_pairs    int := 20;
  v_player_ids uuid[] := ARRAY[]::uuid[];
  v_seed_order uuid[] := ARRAY[]::uuid[];
  v_reg_ids    uuid[];
  v_i          int;
  v_total_grp  int;
  v_played     int := 0;
  v_target     int;
  v_match      record;
  v_status_initial tournament_status;

  -- Playoff manual
  v_grp_ids uuid[];
  v_top     uuid[];  -- [1A,2A,1B,2B,1C,2C,1D,2D]
  v_q_ids   uuid[];  -- ids de cuartos round 3
  v_s_ids   uuid[];  -- ids de semis round 2
  v_f_id    uuid;
  v_qi      uuid;
  v_id_tmp  uuid;
  v_pair    record;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Falta tenant aceplay-demo'; END IF;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Falta demouser@aceplay.cl en tenant demo'; END IF;

  v_creator := v_admin;
  v_name := '[Demo Americano] ' || _label;

  SELECT id INTO v_tour_id FROM public.tournaments
   WHERE tenant_id = v_tenant AND name = v_name;
  IF v_tour_id IS NOT NULL THEN RETURN v_tour_id; END IF;

  v_status_initial := 'inscripciones_abiertas'::tournament_status;

  INSERT INTO public.tournaments (
    tenant_id, name, slug, description,
    registration_opens_at, registration_closes_at, starts_at, ends_at,
    status, created_by, default_config
  ) VALUES (
    v_tenant, v_name,
    'demo-amer-' || lower(regexp_replace(_label,'[^a-zA-Z0-9]+','-','g')) || '-' || substr(md5(random()::text),1,6),
    'Torneo demo · Pádel Americano · Stade Français · ' || _label || E'\n\n'
    || E'Formato Mundial: fase de grupos (4 grupos · 5 parejas) + cuartos · semis · final.\n'
    || E'Scoring: set único con punto de oro (40-40 sin ventaja).\n'
    || E'Calendario: D1-D2 grupos, D3 cuartos+semis, D4 final.\n'
    || E'Sede: Stade Français.',
    now() - interval '14 days',
    now() - interval '5 days',
    now() - interval '4 days',
    now() + interval '1 day',
    v_status_initial, v_creator,
    jsonb_build_object(
      'demo_protocol','v1',
      'spec','americano-grupos-playoff',
      'protocol_label', _label,
      'venue','Stade Français',
      'calendar', jsonb_build_array(
        jsonb_build_object('day','D1','plays','Fase de grupos · 2 partidos por pareja'),
        jsonb_build_object('day','D2','plays','Fase de grupos · 2 partidos restantes'),
        jsonb_build_object('day','D3','plays','Cuartos de final y semifinales'),
        jsonb_build_object('day','D4','plays','Gran Final')
      )
    )
  ) RETURNING id INTO v_tour_id;

  INSERT INTO public.tournament_categories (
    tournament_id, tenant_id, name, category_label,
    gender, discipline, surface, max_participants, status,
    sport, modality, motor, scheduling,
    groups_count, qualifiers_per_group, config
  ) VALUES (
    v_tour_id, v_tenant, 'Open · Pádel Americano', 'Open',
    'mixto', 'padel_dobles', 'arcilla', v_n_players,
    v_status_initial,
    'padel', 'dobles', 'grupos_playoff', 'admin',
    4, 2,
    jsonb_build_object('demo_protocol','v1','spec','americano-grupos-playoff')
  ) RETURNING id INTO v_cat_id;

  INSERT INTO public.tournament_rules (
    tournament_id, version, is_current,
    key_rules_md, tiebreak_rules_md, player_guide_md, created_by
  ) VALUES (
    v_tour_id, 1, true,
    E'## Sistema de puntaje\n- Set único con **punto de oro**: en 40-40 el punto se define con una sola bola, sin ventaja.\n- Primero a 6 games gana el set; con 5-5 se juega el 11º game decisivo.',
    E'## Desempates de grupo\n1. Partidos ganados\n2. Sets ganados\n3. Games ganados\n4. Resultado directo',
    E'## Guía para jugadores\n- Llega 15 min antes de tu partido.\n- Cada pareja juega 4 partidos en fase de grupos (D1 y D2).\n- Top 2 de cada grupo clasifica a cuartos (D3) y avanza hacia la Gran Final (D4).',
    v_creator
  );

  INSERT INTO public.tournament_sessions
    (tournament_id, tenant_id, name, starts_at, ends_at, block_label, status, created_by)
  VALUES
    (v_tour_id, v_tenant, 'D1 · Grupos parte 1', now() - interval '4 days' + interval '9 hours',  now() - interval '4 days' + interval '20 hours', 'Torneo', 'finalizada',  v_creator),
    (v_tour_id, v_tenant, 'D2 · Grupos parte 2', now() - interval '3 days' + interval '9 hours',  now() - interval '3 days' + interval '20 hours', 'Torneo', 'finalizada',  v_creator),
    (v_tour_id, v_tenant, 'D3 · Cuartos + Semis',now() - interval '1 day'  + interval '9 hours',  now() - interval '1 day'  + interval '20 hours', 'Torneo', 'planificada', v_creator),
    (v_tour_id, v_tenant, 'D4 · Gran Final',     now()                     + interval '9 hours',  now()                     + interval '14 hours','Torneo', 'planificada', v_creator);

  IF v_demouser IS NOT NULL THEN v_player_ids := array_append(v_player_ids, v_demouser); END IF;
  IF v_hector IS NOT NULL AND v_hector <> v_demouser THEN
    v_player_ids := array_append(v_player_ids, v_hector);
  END IF;

  v_player_ids := v_player_ids || ARRAY(
    SELECT p.user_id FROM public.profiles p
     WHERE p.tenant_id = v_tenant
       AND p.email LIKE 'demo-bot-%@aceplay.test'
       AND NOT (p.user_id = ANY(v_player_ids))
     ORDER BY p.email
     LIMIT v_n_players - array_length(v_player_ids,1)
  );

  IF COALESCE(array_length(v_player_ids,1),0) < v_n_players THEN
    RAISE EXCEPTION 'Faltan jugadores demo (necesito %, hay %)',
      v_n_players, COALESCE(array_length(v_player_ids,1),0);
  END IF;

  v_reg_ids := ARRAY[]::uuid[];
  FOR v_i IN 1..v_n_pairs LOOP
    DECLARE v_reg uuid;
    BEGIN
      INSERT INTO public.tournament_registrations (
        tournament_id, tournament_category_id, tenant_id,
        player1_user_id, player2_user_id, status, confirmed_at, seed
      ) VALUES (
        v_tour_id, v_cat_id, v_tenant,
        v_player_ids[(v_i-1)*2 + 1], v_player_ids[(v_i-1)*2 + 2],
        'confirmada'::registration_status, now(), v_i
      ) RETURNING id INTO v_reg;
      v_reg_ids := array_append(v_reg_ids, v_reg);
    END;
  END LOOP;

  IF _state = 'inscripciones' THEN RETURN v_tour_id; END IF;

  PERFORM public._demo_impersonate(v_creator);

  v_seed_order := v_reg_ids;
  PERFORM public.generate_groups(v_cat_id, 4, v_seed_order);

  UPDATE public.tournaments SET status = 'en_curso'::tournament_status WHERE id = v_tour_id;
  UPDATE public.tournament_categories SET status = 'en_curso'::tournament_status WHERE id = v_cat_id;

  SELECT count(*) INTO v_total_grp FROM public.tournament_matches
   WHERE tournament_category_id = v_cat_id AND phase = 'grupos';

  IF _state = 'dia1' THEN v_target := v_total_grp / 2; ELSE v_target := v_total_grp; END IF;

  v_played := 0;
  FOR v_match IN
    SELECT id, registration_a_id AS a, registration_b_id AS b
      FROM public.tournament_matches
     WHERE tournament_category_id = v_cat_id
       AND phase = 'grupos' AND status = 'pendiente'
       AND registration_a_id IS NOT NULL AND registration_b_id IS NOT NULL
     ORDER BY round, bracket_position
  LOOP
    EXIT WHEN v_played >= v_target;
    DECLARE
      v_winner uuid;
      v_b_games int := (random()*4)::int;
      v_score jsonb;
    BEGIN
      IF random() < 0.5 THEN
        v_winner := v_match.a;
        v_score := jsonb_build_object('sets', jsonb_build_array(jsonb_build_object('a', 6, 'b', v_b_games)));
      ELSE
        v_winner := v_match.b;
        v_score := jsonb_build_object('sets', jsonb_build_array(jsonb_build_object('a', v_b_games, 'b', 6)));
      END IF;
      UPDATE public.tournament_matches
         SET winner_registration_id = v_winner,
             score = v_score,
             status = 'jugado'::match_status,
             played_at = now() - (random()*interval '2 days')
       WHERE id = v_match.id;
      v_played := v_played + 1;
    END;
  END LOOP;

  IF _state = 'dia1' OR _state = 'dia2' THEN RETURN v_tour_id; END IF;

  -- ============================================================
  -- PLAYOFF MANUAL: 8 clasificados (top2 x 4 grupos)
  -- Cruces: 1A-2B, 1B-2A, 1C-2D, 1D-2C
  -- Round 3 = cuartos (4 matches), Round 2 = semis (2), Round 1 = final (1)
  -- ============================================================

  -- IDs de los grupos en orden A,B,C,D
  SELECT array_agg(id ORDER BY sort_order) INTO v_grp_ids
    FROM public.tournament_groups WHERE tournament_category_id = v_cat_id;

  -- Top 2 por grupo (orden A1, A2, B1, B2, C1, C2, D1, D2)
  v_top := ARRAY[]::uuid[];
  FOR v_i IN 1..array_length(v_grp_ids,1) LOOP
    v_top := v_top || ARRAY(
      SELECT registration_id FROM public.round_robin_group_standings
       WHERE category_id = v_cat_id AND group_id = v_grp_ids[v_i]
       ORDER BY position LIMIT 2
    );
  END LOOP;

  -- Crear 4 cuartos (round 3, bp 1..4) con pairings
  v_q_ids := ARRAY[]::uuid[];
  FOR v_pair IN
    SELECT * FROM (VALUES
      (1, 1, 4),  -- bp=1: 1A vs 2B → indices 1 y 4
      (2, 3, 2),  -- bp=2: 1B vs 2A → indices 3 y 2
      (3, 5, 8),  -- bp=3: 1C vs 2D
      (4, 7, 6)   -- bp=4: 1D vs 2C
    ) AS p(bp, a_idx, b_idx)
  LOOP
    INSERT INTO public.tournament_matches (
      tournament_id, tournament_category_id, tenant_id,
      round, bracket_position, phase,
      registration_a_id, registration_b_id, status
    ) VALUES (
      v_tour_id, v_cat_id, v_tenant,
      3, v_pair.bp, 'playoff',
      v_top[v_pair.a_idx], v_top[v_pair.b_idx], 'pendiente'::match_status
    ) RETURNING id INTO v_id_tmp;
    v_q_ids := array_append(v_q_ids, v_id_tmp);
  END LOOP;

  -- Crear 2 semis (round 2, bp 1..2) vacías
  v_s_ids := ARRAY[]::uuid[];
  FOR v_i IN 1..2 LOOP
    INSERT INTO public.tournament_matches (
      tournament_id, tournament_category_id, tenant_id,
      round, bracket_position, phase, status
    ) VALUES (
      v_tour_id, v_cat_id, v_tenant,
      2, v_i, 'playoff', 'pendiente'::match_status
    ) RETURNING id INTO v_id_tmp;
    v_s_ids := array_append(v_s_ids, v_id_tmp);
  END LOOP;

  -- Final (round 1, bp 1)
  INSERT INTO public.tournament_matches (
    tournament_id, tournament_category_id, tenant_id,
    round, bracket_position, phase, status
  ) VALUES (
    v_tour_id, v_cat_id, v_tenant,
    1, 1, 'playoff', 'pendiente'::match_status
  ) RETURNING id INTO v_f_id;

  -- Linkear: cuartos bp1,2 → semi 1 (slot a,b); cuartos bp3,4 → semi 2; semis → final
  UPDATE public.tournament_matches SET next_match_id = v_s_ids[1], next_match_slot = 'a' WHERE id = v_q_ids[1];
  UPDATE public.tournament_matches SET next_match_id = v_s_ids[1], next_match_slot = 'b' WHERE id = v_q_ids[2];
  UPDATE public.tournament_matches SET next_match_id = v_s_ids[2], next_match_slot = 'a' WHERE id = v_q_ids[3];
  UPDATE public.tournament_matches SET next_match_id = v_s_ids[2], next_match_slot = 'b' WHERE id = v_q_ids[4];
  UPDATE public.tournament_matches SET next_match_id = v_f_id,    next_match_slot = 'a' WHERE id = v_s_ids[1];
  UPDATE public.tournament_matches SET next_match_id = v_f_id,    next_match_slot = 'b' WHERE id = v_s_ids[2];

  -- Jugar cuartos completos; pareja del demouser (v_reg_ids[1]) siempre gana si participa
  FOREACH v_qi IN ARRAY v_q_ids LOOP
    DECLARE
      v_a uuid; v_b uuid; v_winner uuid;
      v_next uuid; v_slot char(1);
      v_score jsonb := jsonb_build_object('sets', jsonb_build_array(jsonb_build_object('a', 6, 'b', (random()*4)::int)));
    BEGIN
      SELECT registration_a_id, registration_b_id, next_match_id, next_match_slot
        INTO v_a, v_b, v_next, v_slot
        FROM public.tournament_matches WHERE id = v_qi;
      IF v_a = v_reg_ids[1] OR v_b = v_reg_ids[1] THEN
        v_winner := v_reg_ids[1];
      ELSE
        v_winner := CASE WHEN random() < 0.5 THEN v_a ELSE v_b END;
      END IF;
      UPDATE public.tournament_matches
         SET winner_registration_id = v_winner,
             score = v_score,
             status = 'jugado'::match_status,
             played_at = now() - interval '12 hours'
       WHERE id = v_qi;
      IF v_next IS NOT NULL THEN
        UPDATE public.tournament_matches
           SET registration_a_id = CASE WHEN v_slot='a' THEN v_winner ELSE registration_a_id END,
               registration_b_id = CASE WHEN v_slot='b' THEN v_winner ELSE registration_b_id END
         WHERE id = v_next;
      END IF;
    END;
  END LOOP;

  IF _state = 'dia3' THEN
    -- jugar solo 1 semi de 2
    DECLARE
      v_a uuid; v_b uuid; v_winner uuid; v_next uuid; v_slot char(1);
      v_score jsonb := jsonb_build_object('sets', jsonb_build_array(jsonb_build_object('a', 6, 'b', (random()*4)::int)));
    BEGIN
      SELECT registration_a_id, registration_b_id, next_match_id, next_match_slot
        INTO v_a, v_b, v_next, v_slot
        FROM public.tournament_matches WHERE id = v_s_ids[1];
      IF v_a IS NOT NULL AND v_b IS NOT NULL THEN
        IF v_a = v_reg_ids[1] OR v_b = v_reg_ids[1] THEN v_winner := v_reg_ids[1];
        ELSE v_winner := CASE WHEN random() < 0.5 THEN v_a ELSE v_b END; END IF;
        UPDATE public.tournament_matches
           SET winner_registration_id = v_winner, score = v_score,
               status = 'jugado'::match_status, played_at = now() - interval '2 hours'
         WHERE id = v_s_ids[1];
        IF v_next IS NOT NULL THEN
          UPDATE public.tournament_matches
             SET registration_a_id = CASE WHEN v_slot='a' THEN v_winner ELSE registration_a_id END,
                 registration_b_id = CASE WHEN v_slot='b' THEN v_winner ELSE registration_b_id END
           WHERE id = v_next;
        END IF;
      END IF;
    END;
    RETURN v_tour_id;
  END IF;

  -- FINALIZADO: jugar ambas semis y la final, pareja demouser siempre gana
  FOR v_i IN 1..2 LOOP
    DECLARE
      v_a uuid; v_b uuid; v_winner uuid; v_next uuid; v_slot char(1);
      v_score jsonb := jsonb_build_object('sets', jsonb_build_array(jsonb_build_object('a', 6, 'b', (random()*4)::int)));
    BEGIN
      SELECT registration_a_id, registration_b_id, next_match_id, next_match_slot
        INTO v_a, v_b, v_next, v_slot
        FROM public.tournament_matches WHERE id = v_s_ids[v_i];
      IF v_a IS NULL OR v_b IS NULL THEN CONTINUE; END IF;
      IF v_a = v_reg_ids[1] OR v_b = v_reg_ids[1] THEN v_winner := v_reg_ids[1];
      ELSE v_winner := CASE WHEN random() < 0.5 THEN v_a ELSE v_b END; END IF;
      UPDATE public.tournament_matches
         SET winner_registration_id = v_winner, score = v_score,
             status = 'jugado'::match_status, played_at = now() - interval '2 hours'
       WHERE id = v_s_ids[v_i];
      IF v_next IS NOT NULL THEN
        UPDATE public.tournament_matches
           SET registration_a_id = CASE WHEN v_slot='a' THEN v_winner ELSE registration_a_id END,
               registration_b_id = CASE WHEN v_slot='b' THEN v_winner ELSE registration_b_id END
         WHERE id = v_next;
      END IF;
    END;
  END LOOP;

  -- Final
  DECLARE
    v_a uuid; v_b uuid; v_winner uuid;
    v_score jsonb := jsonb_build_object('sets', jsonb_build_array(jsonb_build_object('a', 6, 'b', (random()*4)::int)));
  BEGIN
    SELECT registration_a_id, registration_b_id INTO v_a, v_b
      FROM public.tournament_matches WHERE id = v_f_id;
    IF v_a IS NOT NULL AND v_b IS NOT NULL THEN
      IF v_a = v_reg_ids[1] OR v_b = v_reg_ids[1] THEN v_winner := v_reg_ids[1];
      ELSE v_winner := CASE WHEN random() < 0.5 THEN v_a ELSE v_b END; END IF;
      UPDATE public.tournament_matches
         SET winner_registration_id = v_winner, score = v_score,
             status = 'jugado'::match_status, played_at = now() - interval '1 hour'
       WHERE id = v_f_id;
    END IF;
  END;

  UPDATE public.tournaments SET status = 'finalizado'::tournament_status, closed_at = now() WHERE id = v_tour_id;
  UPDATE public.tournament_categories SET status = 'finalizado'::tournament_status WHERE id = v_cat_id;

  RETURN v_tour_id;
END;
$$;

REVOKE ALL ON FUNCTION public._demo_seed_padel_grupos_playoff(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._demo_seed_padel_grupos_playoff(text, text) TO service_role;
