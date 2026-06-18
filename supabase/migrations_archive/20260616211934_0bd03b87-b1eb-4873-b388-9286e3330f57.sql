
-- =====================================================================
-- Helper: siembra un torneo de Pádel Americano (grupos_playoff)
-- según docx "Formato Americano — Stade Français"
-- =====================================================================
CREATE OR REPLACE FUNCTION public._demo_seed_padel_grupos_playoff(
  _label text,
  _state text  -- 'inscripciones' | 'dia1' | 'dia2' | 'dia3' | 'finalizado'
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
  v_player_ids uuid[];
  v_seed_order uuid[] := ARRAY[]::uuid[];
  v_reg_ids    uuid[];
  v_i          int;
  v_total_grp  int;
  v_played     int := 0;
  v_target     int;
  v_match      record;
  v_status_initial tournament_status;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Falta tenant aceplay-demo'; END IF;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Falta demouser@aceplay.cl en tenant demo'; END IF;

  v_creator := v_admin;
  v_name := '[Demo Americano] ' || _label;

  -- Reusar si ya existe
  SELECT id INTO v_tour_id FROM public.tournaments
   WHERE tenant_id = v_tenant AND name = v_name;
  IF v_tour_id IS NOT NULL THEN RETURN v_tour_id; END IF;

  v_status_initial := 'inscripciones_abiertas'::tournament_status;

  -- Torneo
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

  -- Categoría única Open mixta (pádel dobles, grupos_playoff)
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

  -- Reglas: set único con punto de oro
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

  -- Sesiones (calendario 4 días)
  INSERT INTO public.tournament_sessions
    (tournament_id, tenant_id, name, starts_at, ends_at, block_label, status, created_by)
  VALUES
    (v_tour_id, v_tenant, 'D1 · Grupos parte 1', now() - interval '4 days' + interval '9 hours',  now() - interval '4 days' + interval '20 hours', 'Torneo', 'finalizada',  v_creator),
    (v_tour_id, v_tenant, 'D2 · Grupos parte 2', now() - interval '3 days' + interval '9 hours',  now() - interval '3 days' + interval '20 hours', 'Torneo', 'finalizada',  v_creator),
    (v_tour_id, v_tenant, 'D3 · Cuartos + Semis',now() - interval '1 day'  + interval '9 hours',  now() - interval '1 day'  + interval '20 hours', 'Torneo', 'planificada', v_creator),
    (v_tour_id, v_tenant, 'D4 · Gran Final',     now()                     + interval '9 hours',  now()                     + interval '14 hours','Torneo', 'planificada', v_creator);

  -- Jugadores: demouser + hector + 38 bots demo
  v_player_ids := ARRAY[v_demouser, v_hector]::uuid[];
  v_player_ids := v_player_ids || ARRAY(
    SELECT p.user_id FROM public.profiles p
     WHERE p.tenant_id = v_tenant
       AND p.email LIKE 'demo-bot-%@aceplay.test'
       AND p.user_id <> ALL(v_player_ids)
     ORDER BY p.email
     LIMIT v_n_players - array_length(v_player_ids,1)
  );

  IF array_length(v_player_ids,1) < v_n_players THEN
    RAISE EXCEPTION 'Faltan jugadores demo (necesito %, hay %)',
      v_n_players, COALESCE(array_length(v_player_ids,1),0);
  END IF;

  -- 20 inscripciones (parejas). La pareja 1 = demouser + hector → cabeza de grupo A.
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

  -- Si sólo queremos inscripciones, terminamos aquí.
  IF _state = 'inscripciones' THEN
    RETURN v_tour_id;
  END IF;

  -- Impersonar admin para pasar checks de is_tournament_manager
  PERFORM public._demo_impersonate(v_creator);

  -- Generar grupos (4 grupos x 5 parejas, snake seeding)
  v_seed_order := v_reg_ids;
  PERFORM public.generate_groups(v_cat_id, 4, v_seed_order);

  -- Marcar torneo en curso
  UPDATE public.tournaments SET status = 'en_curso'::tournament_status WHERE id = v_tour_id;
  UPDATE public.tournament_categories SET status = 'en_curso'::tournament_status WHERE id = v_cat_id;

  -- Score helper local: set único con punto de oro {sets:[{a:6,b:N}]}
  -- (lo construimos inline para no agregar otra función)

  -- DIA1: jugar ~50% partidos de grupos
  SELECT count(*) INTO v_total_grp FROM public.tournament_matches
   WHERE tournament_category_id = v_cat_id AND phase = 'grupos';

  IF _state = 'dia1' THEN
    v_target := v_total_grp / 2;
  ELSE
    v_target := v_total_grp;  -- dia2/dia3/finalizado: grupos completos
  END IF;

  v_played := 0;
  FOR v_match IN
    SELECT id, registration_a_id AS a, registration_b_id AS b
      FROM public.tournament_matches
     WHERE tournament_category_id = v_cat_id
       AND phase = 'grupos'
       AND status = 'pendiente'
       AND registration_a_id IS NOT NULL
       AND registration_b_id IS NOT NULL
     ORDER BY round, bracket_position
  LOOP
    EXIT WHEN v_played >= v_target;
    DECLARE
      v_winner uuid;
      v_a_games int := 6;
      v_b_games int := (random()*4)::int;
      v_score jsonb;
    BEGIN
      IF random() < 0.5 THEN
        v_winner := v_match.a;
        v_score := jsonb_build_object('sets', jsonb_build_array(
          jsonb_build_object('a', v_a_games, 'b', v_b_games)));
      ELSE
        v_winner := v_match.b;
        v_score := jsonb_build_object('sets', jsonb_build_array(
          jsonb_build_object('a', v_b_games, 'b', v_a_games)));
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

  IF _state = 'dia1' OR _state = 'dia2' THEN
    -- Dia2 deja los grupos completos pero sin playoff generado todavía.
    RETURN v_tour_id;
  END IF;

  -- DIA3 y FINALIZADO: avanzar a playoff
  PERFORM public.advance_groups_to_playoff(v_cat_id);

  -- Jugar cuartos completos
  FOR v_match IN
    SELECT id, registration_a_id AS a, registration_b_id AS b, round, next_match_id, next_match_slot
      FROM public.tournament_matches
     WHERE tournament_category_id = v_cat_id
       AND phase = 'playoff'
       AND round = (SELECT max(round) FROM public.tournament_matches WHERE tournament_category_id = v_cat_id AND phase = 'playoff')
       AND status = 'pendiente'
       AND registration_a_id IS NOT NULL
       AND registration_b_id IS NOT NULL
     ORDER BY bracket_position
  LOOP
    DECLARE
      v_winner uuid := CASE WHEN random() < 0.5 THEN v_match.a ELSE v_match.b END;
      v_b_games int := (random()*4)::int;
      v_score jsonb := jsonb_build_object('sets', jsonb_build_array(
        jsonb_build_object('a', 6, 'b', v_b_games)));
    BEGIN
      -- Sesgar pareja del demouser a ganar cuartos (siempre que esté en este match)
      IF v_match.a = v_reg_ids[1] OR v_match.b = v_reg_ids[1] THEN
        v_winner := v_reg_ids[1];
      END IF;
      UPDATE public.tournament_matches
         SET winner_registration_id = v_winner,
             score = v_score,
             status = 'jugado'::match_status,
             played_at = now() - interval '12 hours'
       WHERE id = v_match.id;
      -- Propagar al next match
      IF v_match.next_match_id IS NOT NULL THEN
        UPDATE public.tournament_matches
           SET registration_a_id = CASE WHEN v_match.next_match_slot = 'a' THEN v_winner ELSE registration_a_id END,
               registration_b_id = CASE WHEN v_match.next_match_slot = 'b' THEN v_winner ELSE registration_b_id END
         WHERE id = v_match.next_match_id;
      END IF;
    END;
  END LOOP;

  IF _state = 'dia3' THEN
    -- Jugar ~50% semis (solo 1 de 2)
    FOR v_match IN
      SELECT id, registration_a_id AS a, registration_b_id AS b, next_match_id, next_match_slot
        FROM public.tournament_matches
       WHERE tournament_category_id = v_cat_id
         AND phase = 'playoff'
         AND status = 'pendiente'
         AND registration_a_id IS NOT NULL
         AND registration_b_id IS NOT NULL
         AND round = 2  -- semis (final = 1)
       ORDER BY bracket_position
       LIMIT 1
    LOOP
      DECLARE
        v_winner uuid := CASE WHEN v_match.a = v_reg_ids[1] OR v_match.b = v_reg_ids[1]
                              THEN v_reg_ids[1]
                              ELSE CASE WHEN random() < 0.5 THEN v_match.a ELSE v_match.b END
                         END;
        v_score jsonb := jsonb_build_object('sets', jsonb_build_array(
          jsonb_build_object('a', 6, 'b', (random()*4)::int)));
      BEGIN
        UPDATE public.tournament_matches
           SET winner_registration_id = v_winner,
               score = v_score,
               status = 'jugado'::match_status,
               played_at = now() - interval '2 hours'
         WHERE id = v_match.id;
        IF v_match.next_match_id IS NOT NULL THEN
          UPDATE public.tournament_matches
             SET registration_a_id = CASE WHEN v_match.next_match_slot = 'a' THEN v_winner ELSE registration_a_id END,
                 registration_b_id = CASE WHEN v_match.next_match_slot = 'b' THEN v_winner ELSE registration_b_id END
           WHERE id = v_match.next_match_id;
        END IF;
      END;
    END LOOP;
    RETURN v_tour_id;
  END IF;

  -- FINALIZADO: jugar TODOS los partidos restantes (semis + final) y cerrar
  FOR v_match IN
    SELECT id, registration_a_id AS a, registration_b_id AS b, round, next_match_id, next_match_slot
      FROM public.tournament_matches
     WHERE tournament_category_id = v_cat_id
       AND phase = 'playoff'
       AND status = 'pendiente'
     ORDER BY round DESC, bracket_position
  LOOP
    IF v_match.a IS NULL OR v_match.b IS NULL THEN CONTINUE; END IF;
    DECLARE
      -- Pareja demouser siempre gana hasta la final, donde también gana (campeón)
      v_winner uuid := CASE WHEN v_match.a = v_reg_ids[1] OR v_match.b = v_reg_ids[1]
                            THEN v_reg_ids[1]
                            ELSE CASE WHEN random() < 0.5 THEN v_match.a ELSE v_match.b END
                       END;
      v_score jsonb := jsonb_build_object('sets', jsonb_build_array(
        jsonb_build_object('a', 6, 'b', (random()*4)::int)));
    BEGIN
      UPDATE public.tournament_matches
         SET winner_registration_id = v_winner,
             score = v_score,
             status = 'jugado'::match_status,
             played_at = now() - interval '1 hour'
       WHERE id = v_match.id;
      IF v_match.next_match_id IS NOT NULL THEN
        UPDATE public.tournament_matches
           SET registration_a_id = CASE WHEN v_match.next_match_slot = 'a' THEN v_winner ELSE registration_a_id END,
               registration_b_id = CASE WHEN v_match.next_match_slot = 'b' THEN v_winner ELSE registration_b_id END
         WHERE id = v_match.next_match_id;
      END IF;
    END;
  END LOOP;

  UPDATE public.tournaments
     SET status = 'finalizado'::tournament_status,
         closed_at = now()
   WHERE id = v_tour_id;
  UPDATE public.tournament_categories
     SET status = 'finalizado'::tournament_status
   WHERE id = v_cat_id;

  RETURN v_tour_id;
END;
$$;

REVOKE ALL ON FUNCTION public._demo_seed_padel_grupos_playoff(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._demo_seed_padel_grupos_playoff(text, text) TO service_role;


-- =====================================================================
-- Wrapper público: siembra los 5 escenarios del torneo Americano
-- =====================================================================
CREATE OR REPLACE FUNCTION public.demo_seed_padel_americano_protocolo()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_tenant uuid := public._demo_tenant_id();
  v_caller uuid := auth.uid();
  v_demouser uuid := public._demo_user_uid('demouser@aceplay.cl');
  v_bots_created int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_results jsonb := '[]'::jsonb;
  v_id uuid;
  v_recipe record;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No existe tenant aceplay-demo'; END IF;

  IF v_caller IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_caller AND role IN ('club_admin'::app_role,'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado: requiere club_admin o super_admin';
  END IF;

  -- Asegurar rol del demouser en tenant demo (necesario para vistas user-scoped)
  IF v_demouser IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (v_demouser, v_tenant, 'club_admin'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Borrar sólo los torneos previos de este spec
  DELETE FROM public.tournaments
   WHERE tenant_id = v_tenant
     AND default_config->>'spec' = 'americano-grupos-playoff';

  -- Asegurar 200 bots disponibles
  v_bots_created := public.demo_seed_players(200);

  FOR v_recipe IN
    SELECT * FROM (VALUES
      ('Inscripciones', 'inscripciones'),
      ('Día 1 · Grupos en juego', 'dia1'),
      ('Día 2 · Grupos completos', 'dia2'),
      ('Día 3 · Cuartos jugados', 'dia3'),
      ('Finalizado · Campeón decidido', 'finalizado')
    ) AS r(label, state)
  LOOP
    BEGIN
      v_id := public._demo_seed_padel_grupos_playoff(v_recipe.label, v_recipe.state);
      v_results := v_results || jsonb_build_object(
        'label', v_recipe.label, 'state', v_recipe.state, 'tournament_id', v_id
      );
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'label', v_recipe.label, 'state', v_recipe.state, 'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'spec','americano-grupos-playoff',
    'tenant_slug','aceplay-demo',
    'bots_present', v_bots_created,
    'tournaments', v_results,
    'errors', v_errors,
    'seeded_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.demo_seed_padel_americano_protocolo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demo_seed_padel_americano_protocolo() TO authenticated, service_role;
