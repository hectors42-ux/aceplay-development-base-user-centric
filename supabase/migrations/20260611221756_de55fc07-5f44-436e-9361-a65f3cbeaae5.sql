
-- ============================================================================
-- Protocolo demo: pruebas manuales auto-ejecutables sobre el tenant aceplay-demo
-- Crea jugadores bot + torneos en distintos estados, visibles para demouser/hector.
-- ============================================================================

-- ---------- helpers internos -------------------------------------------------

CREATE OR REPLACE FUNCTION public._demo_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.tenants WHERE slug = 'aceplay-demo';
$$;

CREATE OR REPLACE FUNCTION public._demo_admin_uid()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id FROM public.profiles p
   WHERE p.email = 'demouser@aceplay.cl'
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._demo_user_uid(_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id FROM public.profiles p WHERE p.email = _email LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._demo_impersonate(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', _uid::text, 'role', 'authenticated')::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._demo_make_user(_email text, _first text, _last text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_uid uuid;
  v_tenant uuid := public._demo_tenant_id();
BEGIN
  SELECT user_id INTO v_uid FROM public.profiles WHERE email = _email;
  IF v_uid IS NOT NULL THEN RETURN v_uid; END IF;

  v_uid := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    _email, crypt('demo-disabled-' || v_uid::text, gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    jsonb_build_object('display_name', _first || ' ' || _last),
    false, '', '', '', ''
  );

  INSERT INTO public.profiles (user_id, tenant_id, email, first_name, last_name, dues_status)
  VALUES (v_uid, v_tenant, _email, _first, _last, 'al_dia'::dues_status);

  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public._demo_random_score(_motor text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF _motor = 'americano_rotacion' THEN
    RETURN jsonb_build_object('games_a', 6, 'games_b', (random()*5)::int);
  END IF;
  RETURN jsonb_build_object(
    'sets', jsonb_build_array(
      jsonb_build_object('a', 6, 'b', (random()*4)::int),
      jsonb_build_object('a', 6, 'b', (random()*4)::int)
    )
  );
END;
$$;

-- ---------- jugadores bot ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.demo_seed_players(_n int DEFAULT 200)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_tenant uuid := public._demo_tenant_id();
  v_i int;
  v_uid uuid;
  v_email text;
  v_first text;
  v_last text;
  v_lvl numeric;
  v_sport rating_sport;
  v_created int := 0;
  v_first_pool text[] := ARRAY['Mateo','Sofía','Lucas','Valentina','Diego','Camila','Joaquín','Antonia','Tomás','Florencia','Benjamín','Catalina','Vicente','Javiera','Cristóbal','Fernanda','Maximiliano','Constanza','Agustín','Renata'];
  v_last_pool text[] := ARRAY['González','Muñoz','Rojas','Díaz','Pérez','Soto','Contreras','Silva','Martínez','Sepúlveda','Morales','Rodríguez','López','Vargas','Reyes','Castro','Álvarez','Espinoza','Fuentes','Gutiérrez'];
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Falta tenant aceplay-demo'; END IF;

  FOR v_i IN 1.._n LOOP
    v_email := 'demo-bot-' || lpad(v_i::text, 3, '0') || '@aceplay.test';
    v_first := v_first_pool[1 + (v_i % array_length(v_first_pool,1))];
    v_last  := v_last_pool[1 + ((v_i * 7) % array_length(v_last_pool,1))];

    SELECT user_id INTO v_uid FROM public.profiles WHERE email = v_email;
    IF v_uid IS NULL THEN
      v_uid := public._demo_make_user(v_email, v_first, v_last);
      v_created := v_created + 1;
    END IF;

    FOREACH v_sport IN ARRAY ARRAY['tenis_singles','tenis_dobles','padel']::rating_sport[] LOOP
      v_lvl := GREATEST(0.5, LEAST(6.5, 3.0 + (random() - 0.5) * 3.0));
      INSERT INTO public.player_ratings (user_id, tenant_id, sport, level, reliability, initial_level, matches_played, onboarding_completed_at)
      VALUES (v_uid, v_tenant, v_sport, v_lvl, 60, v_lvl, (random()*20)::int, now())
      ON CONFLICT (user_id, sport) DO NOTHING;
    END LOOP;
  END LOOP;

  RETURN v_created;
END;
$$;

-- ---------- canchas ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.demo_seed_courts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := public._demo_tenant_id();
  v_i int;
  v_surf court_surface;
BEGIN
  FOR v_i IN 1..4 LOOP
    v_surf := CASE WHEN v_i % 2 = 0 THEN 'arcilla'::court_surface ELSE 'dura'::court_surface END;
    INSERT INTO public.courts (tenant_id, name, surface, is_indoor, sort_order)
    VALUES (v_tenant, '[Demo] Cancha ' || v_i, v_surf, (v_i = 4), v_i)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ---------- torneo demo ------------------------------------------------------

CREATE OR REPLACE FUNCTION public._demo_seed_tournament(
  _label text,
  _motor text,
  _scheduling text DEFAULT 'admin',
  _state text DEFAULT 'en_curso',
  _participants int DEFAULT NULL,
  _organizer_email text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_tenant uuid := public._demo_tenant_id();
  v_admin uuid := public._demo_admin_uid();
  v_creator uuid;
  v_demouser uuid := public._demo_user_uid('demouser@aceplay.cl');
  v_hector uuid := public._demo_user_uid('hectors42@gmail.com');
  v_name text;
  v_tour_id uuid;
  v_cat_id uuid;
  v_n int;
  v_sport tournament_sport := 'tenis';
  v_modality tournament_modality := 'singles';
  v_discipline tournament_discipline := 'tenis_singles';
  v_motor competition_motor;
  v_player_ids uuid[];
  v_seeds uuid[];
  v_i int;
  v_match record;
  v_pct numeric;
  v_round_id uuid;
  v_round_num int;
  v_round_match record;
  v_status_initial tournament_status;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Falta tenant aceplay-demo'; END IF;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Falta demouser@aceplay.cl en el tenant demo'; END IF;

  v_creator := COALESCE(public._demo_user_uid(_organizer_email), v_admin);
  v_motor := _motor::competition_motor;

  IF _motor = 'americano_rotacion' THEN
    v_sport := 'padel'; v_modality := 'dobles'; v_discipline := 'padel_dobles';
    v_n := COALESCE(_participants, 8);
  ELSIF _motor = 'doble_eliminacion' OR _motor = 'consolacion' OR _motor = 'grupos_playoff' THEN
    v_n := COALESCE(_participants, 16);
  ELSIF _motor = 'round_robin' THEN
    v_n := COALESCE(_participants, 8);
  ELSE
    v_n := COALESCE(_participants, 8);
  END IF;

  v_name := '[Demo] ' || _label;

  SELECT id INTO v_tour_id FROM public.tournaments WHERE tenant_id = v_tenant AND name = v_name;
  IF v_tour_id IS NOT NULL THEN RETURN v_tour_id; END IF;

  v_status_initial := CASE _state
    WHEN 'abierto' THEN 'inscripciones_abiertas'::tournament_status
    WHEN 'congelado' THEN 'inscripciones_cerradas'::tournament_status
    ELSE 'inscripciones_abiertas'::tournament_status
  END;

  INSERT INTO public.tournaments (
    tenant_id, name, slug, description,
    registration_opens_at, registration_closes_at, starts_at, ends_at,
    status, created_by, default_config
  ) VALUES (
    v_tenant, v_name,
    'demo-' || lower(regexp_replace(_label, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text),1,6),
    'Torneo demo del protocolo de pruebas — ' || _label,
    now() - interval '7 days', now() + interval '14 days',
    now() + interval '1 day', now() + interval '21 days',
    v_status_initial, v_creator,
    jsonb_build_object('demo_protocol','v1','protocol_label',_label)
  ) RETURNING id INTO v_tour_id;

  INSERT INTO public.tournament_categories (
    tournament_id, tenant_id, name, category_label,
    gender, discipline, surface, max_participants, status,
    sport, modality, motor, scheduling,
    americano_rounds_target, config
  ) VALUES (
    v_tour_id, v_tenant, 'Open · ' || _label, 'Open',
    'mixto', v_discipline, 'arcilla', v_n,
    v_status_initial,
    v_sport, v_modality, v_motor, _scheduling,
    CASE WHEN _motor = 'americano_rotacion' THEN 3 ELSE NULL END,
    jsonb_build_object('demo_protocol','v1')
  ) RETURNING id INTO v_cat_id;

  -- Selecciona N jugadores bot, asegurando demouser/hector primero
  v_player_ids := ARRAY[]::uuid[];
  IF v_demouser IS NOT NULL THEN v_player_ids := array_append(v_player_ids, v_demouser); END IF;
  IF v_hector IS NOT NULL AND v_hector <> COALESCE(v_demouser, '00000000-0000-0000-0000-000000000000'::uuid)
     THEN v_player_ids := array_append(v_player_ids, v_hector); END IF;

  v_player_ids := v_player_ids || ARRAY(
    SELECT p.user_id FROM public.profiles p
     WHERE p.tenant_id = v_tenant
       AND p.email LIKE 'demo-bot-%@aceplay.test'
       AND p.user_id <> ALL(COALESCE(v_player_ids, ARRAY[]::uuid[]))
     ORDER BY p.email
     LIMIT GREATEST(v_n - array_length(v_player_ids,1), 0)
  );

  IF array_length(v_player_ids,1) < v_n THEN
    RAISE EXCEPTION 'Faltan jugadores demo (necesito %, hay %). Corre demo_seed_players() primero.',
      v_n, COALESCE(array_length(v_player_ids,1),0);
  END IF;

  IF v_modality = 'dobles' AND _motor <> 'americano_rotacion' THEN
    FOR v_i IN 1..(v_n/2) LOOP
      INSERT INTO public.tournament_registrations (
        tournament_id, tournament_category_id, tenant_id,
        player1_user_id, player2_user_id, status, confirmed_at
      ) VALUES (
        v_tour_id, v_cat_id, v_tenant,
        v_player_ids[(v_i-1)*2 + 1], v_player_ids[(v_i-1)*2 + 2],
        'confirmada'::registration_status, now()
      );
    END LOOP;
  ELSE
    FOR v_i IN 1..v_n LOOP
      INSERT INTO public.tournament_registrations (
        tournament_id, tournament_category_id, tenant_id,
        player1_user_id, status, confirmed_at
      ) VALUES (
        v_tour_id, v_cat_id, v_tenant,
        v_player_ids[v_i],
        'confirmada'::registration_status, now()
      );
    END LOOP;
  END IF;

  IF _state = 'abierto' THEN RETURN v_tour_id; END IF;

  PERFORM public._demo_impersonate(v_creator);

  IF _motor = 'eliminacion_simple' THEN
    SELECT array_agg(id ORDER BY registered_at) INTO v_seeds
      FROM public.tournament_registrations WHERE tournament_category_id = v_cat_id;
    PERFORM public.generate_bracket(v_cat_id, v_seeds);
  ELSIF _motor = 'consolacion' THEN
    SELECT array_agg(id ORDER BY registered_at) INTO v_seeds
      FROM public.tournament_registrations WHERE tournament_category_id = v_cat_id;
    PERFORM public.generate_consolation(v_cat_id, v_seeds);
  ELSIF _motor = 'doble_eliminacion' THEN
    SELECT array_agg(id ORDER BY registered_at) INTO v_seeds
      FROM public.tournament_registrations WHERE tournament_category_id = v_cat_id;
    PERFORM public.generate_double_elimination(v_cat_id, v_seeds);
  ELSIF _motor = 'round_robin' THEN
    PERFORM public.generate_round_robin(v_cat_id);
  ELSIF _motor = 'grupos_playoff' THEN
    SELECT array_agg(id ORDER BY registered_at) INTO v_seeds
      FROM public.tournament_registrations WHERE tournament_category_id = v_cat_id;
    PERFORM public.generate_groups(v_cat_id, GREATEST(2, v_n/4), v_seeds);
  ELSIF _motor = 'americano_rotacion' THEN
    FOR v_round_num IN 1..2 LOOP
      v_round_id := public.generate_americano_round(v_cat_id, v_round_num);
      FOR v_round_match IN
        SELECT id FROM public.tournament_matches WHERE americano_round_id = v_round_id
      LOOP
        UPDATE public.tournament_matches
           SET winner_side = CASE WHEN random() < 0.5 THEN 'a' ELSE 'b' END,
               score = public._demo_random_score(_motor),
               status = 'jugado'::match_status,
               played_at = now()
         WHERE id = v_round_match.id;
      END LOOP;
      UPDATE public.americano_rounds SET status = 'finalizada' WHERE id = v_round_id;
    END LOOP;
    UPDATE public.tournaments SET status = 'en_curso'::tournament_status WHERE id = v_tour_id;
    RETURN v_tour_id;
  END IF;

  IF _state = 'congelado' THEN
    UPDATE public.tournaments SET status = 'inscripciones_cerradas'::tournament_status WHERE id = v_tour_id;
    RETURN v_tour_id;
  END IF;

  UPDATE public.tournaments SET status = 'en_curso'::tournament_status WHERE id = v_tour_id;

  v_pct := CASE _state WHEN 'finalizado' THEN 1.0 ELSE 0.55 END;

  FOR v_match IN
    SELECT id FROM public.tournament_matches
     WHERE tournament_category_id = v_cat_id
       AND americano_round_id IS NULL
     ORDER BY round, bracket_position
  LOOP
    PERFORM 1 FROM public.tournament_matches WHERE id = v_match.id
      AND registration_a_id IS NOT NULL AND registration_b_id IS NOT NULL
      AND status = 'pendiente';
    IF NOT FOUND THEN CONTINUE; END IF;
    IF random() > v_pct THEN CONTINUE; END IF;

    DECLARE
      v_a uuid; v_b uuid; v_winner uuid;
    BEGIN
      SELECT registration_a_id, registration_b_id INTO v_a, v_b
        FROM public.tournament_matches WHERE id = v_match.id;
      IF v_a IS NULL OR v_b IS NULL THEN CONTINUE; END IF;
      v_winner := CASE WHEN random() < 0.5 THEN v_a ELSE v_b END;
      UPDATE public.tournament_matches
         SET winner_registration_id = v_winner,
             score = public._demo_random_score(_motor),
             status = 'jugado'::match_status,
             played_at = now()
       WHERE id = v_match.id;
    END;
  END LOOP;

  IF _state = 'finalizado' THEN
    UPDATE public.tournaments
       SET status = 'finalizado'::tournament_status,
           closed_at = now()
     WHERE id = v_tour_id;
  END IF;

  RETURN v_tour_id;
END;
$$;

-- ---------- wipe -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.demo_protocol_wipe(_wipe_bots boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_tenant uuid := public._demo_tenant_id();
  v_caller uuid := auth.uid();
  v_tours_deleted int := 0;
  v_bots_deleted int := 0;
  v_bot_ids uuid[];
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No existe tenant aceplay-demo'; END IF;

  -- Permiso: cualquier club_admin/super_admin puede limpiar
  IF v_caller IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_caller AND role IN ('club_admin'::app_role,'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado: requiere club_admin o super_admin';
  END IF;

  -- Borra torneos demo (cascadea matches, registrations, categories, groups, phases)
  WITH del AS (
    DELETE FROM public.tournaments
     WHERE tenant_id = v_tenant
       AND default_config->>'demo_protocol' = 'v1'
    RETURNING id
  )
  SELECT count(*) INTO v_tours_deleted FROM del;

  -- Limpia courts demo
  DELETE FROM public.courts
   WHERE tenant_id = v_tenant AND name LIKE '[Demo] %';

  IF _wipe_bots THEN
    SELECT array_agg(user_id) INTO v_bot_ids FROM public.profiles
     WHERE tenant_id = v_tenant AND email LIKE 'demo-bot-%@aceplay.test';
    IF v_bot_ids IS NOT NULL THEN
      DELETE FROM public.user_roles WHERE user_id = ANY(v_bot_ids);
      DELETE FROM public.player_ratings WHERE user_id = ANY(v_bot_ids);
      DELETE FROM public.profiles WHERE user_id = ANY(v_bot_ids);
      DELETE FROM auth.users WHERE id = ANY(v_bot_ids);
      v_bots_deleted := array_length(v_bot_ids,1);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'tournaments_deleted', v_tours_deleted,
    'bots_deleted', v_bots_deleted,
    'wiped_at', now()
  );
END;
$$;

-- ---------- seed orquestador -------------------------------------------------

CREATE OR REPLACE FUNCTION public.demo_protocol_seed()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_tenant uuid := public._demo_tenant_id();
  v_caller uuid := auth.uid();
  v_demouser uuid := public._demo_user_uid('demouser@aceplay.cl');
  v_created_bots int;
  v_result jsonb;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No existe tenant aceplay-demo'; END IF;

  IF v_caller IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_caller AND role IN ('club_admin'::app_role,'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado: requiere club_admin o super_admin';
  END IF;

  -- Limpia primero (idempotente)
  PERFORM public.demo_protocol_wipe(false);

  -- Bots + canchas
  v_created_bots := public.demo_seed_players(200);
  PERFORM public.demo_seed_courts();

  -- Torneos del protocolo (A–F)
  PERFORM public._demo_seed_tournament('Escalerilla mixta (A1·A2·E2)',  'round_robin',        'desafio_libre', 'en_curso', 8,  'demouser@aceplay.cl');
  PERFORM public._demo_seed_tournament('Pádel dobles (A3)',             'americano_rotacion', 'admin',         'en_curso', 8,  'demouser@aceplay.cl');
  PERFORM public._demo_seed_tournament('Eliminación 8 (B1·C1)',         'eliminacion_simple', 'admin',         'en_curso', 8,  NULL);
  PERFORM public._demo_seed_tournament('Cuadro congelado (B4)',         'eliminacion_simple', 'admin',         'congelado',8,  NULL);
  PERFORM public._demo_seed_tournament('Grupos + Playoff (D1)',         'grupos_playoff',     'admin',         'en_curso', 16, NULL);
  PERFORM public._demo_seed_tournament('Doble eliminación (D3)',        'doble_eliminacion',  'admin',         'en_curso', 16, NULL);
  PERFORM public._demo_seed_tournament('Consolación (D4)',              'consolacion',        'admin',         'en_curso', 16, NULL);
  PERFORM public._demo_seed_tournament('Escalerilla cerrada (E1)',      'round_robin',        'desafio_libre', 'finalizado',8, 'demouser@aceplay.cl');
  PERFORM public._demo_seed_tournament('Monstruo 64 (F1)',              'round_robin',        'desafio_libre', 'en_curso', 32, NULL);

  v_result := public.demo_protocol_status();
  v_result := v_result || jsonb_build_object('bots_created', v_created_bots);
  RETURN v_result;
END;
$$;

-- ---------- status -----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.demo_protocol_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := public._demo_tenant_id();
  v_tournaments jsonb;
  v_summary jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'tournament_id', t.id,
    'name',          t.name,
    'label',         t.default_config->>'protocol_label',
    'status',        t.status,
    'matches_total', (SELECT count(*) FROM public.tournament_matches m WHERE m.tournament_id = t.id),
    'matches_played',(SELECT count(*) FROM public.tournament_matches m WHERE m.tournament_id = t.id AND m.status = 'jugado'),
    'closed_at',     t.closed_at
  ) ORDER BY t.created_at)
  INTO v_tournaments
  FROM public.tournaments t
  WHERE t.tenant_id = v_tenant AND t.default_config->>'demo_protocol' = 'v1';

  SELECT jsonb_build_object(
    'tenant_slug', 'aceplay-demo',
    'bots_present',(SELECT count(*) FROM public.profiles WHERE tenant_id = v_tenant AND email LIKE 'demo-bot-%@aceplay.test'),
    'demo_tournaments',(SELECT count(*) FROM public.tournaments WHERE tenant_id = v_tenant AND default_config->>'demo_protocol'='v1'),
    'demo_matches',(SELECT count(*) FROM public.tournament_matches m JOIN public.tournaments t ON t.id=m.tournament_id WHERE t.tenant_id = v_tenant AND t.default_config->>'demo_protocol'='v1'),
    'tournaments', COALESCE(v_tournaments,'[]'::jsonb),
    'checked_at', now()
  )
  INTO v_summary;

  RETURN v_summary;
END;
$$;

-- ---------- grants -----------------------------------------------------------

REVOKE ALL ON FUNCTION public._demo_tenant_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._demo_admin_uid() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._demo_user_uid(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._demo_impersonate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._demo_make_user(text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._demo_random_score(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demo_seed_players(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demo_seed_courts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._demo_seed_tournament(text,text,text,text,int,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demo_protocol_seed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demo_protocol_wipe(boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demo_protocol_status() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.demo_protocol_seed()           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.demo_protocol_wipe(boolean)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.demo_protocol_status()         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.demo_seed_players(int)         TO service_role;
GRANT EXECUTE ON FUNCTION public.demo_seed_courts()             TO service_role;
GRANT EXECUTE ON FUNCTION public._demo_seed_tournament(text,text,text,text,int,text) TO service_role;
