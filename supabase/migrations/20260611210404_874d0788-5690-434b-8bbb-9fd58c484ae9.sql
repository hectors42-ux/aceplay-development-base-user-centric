
-- ============================================================================
-- PRD 12 — Seeding QA del motor de torneos
-- Todas las funciones aplican firewall de privacidad: nombres 100% sintéticos.
-- Acceso restringido a service_role.
-- ============================================================================

-- ---------- helpers internos --------------------------------------------------

CREATE OR REPLACE FUNCTION public._qa_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.tenants WHERE slug = 'qa-sandbox';
$$;

CREATE OR REPLACE FUNCTION public._qa_admin_uid()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id
    FROM public.profiles p
    JOIN public.tenants t ON t.id = p.tenant_id
   WHERE t.slug = 'qa-sandbox' AND p.email = 'qa-admin@aceplay.test'
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._qa_impersonate(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', _uid::text, 'role', 'authenticated')::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._qa_make_user(_email text, _display text, _is_admin boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_uid uuid;
  v_tenant uuid := public._qa_tenant_id();
BEGIN
  SELECT user_id INTO v_uid FROM public.profiles WHERE email = _email AND tenant_id = v_tenant;
  IF v_uid IS NOT NULL THEN RETURN v_uid; END IF;

  v_uid := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    _email, crypt('qa-disabled-' || v_uid::text, gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    jsonb_build_object('display_name', _display),
    false, '', '', '', ''
  );

  INSERT INTO public.profiles (
    user_id, tenant_id, email, first_name, last_name, dues_status
  ) VALUES (
    v_uid, v_tenant, _email,
    split_part(_display, ' ', 1),
    NULLIF(substring(_display from position(' ' in _display) + 1), ''),
    'al_dia'::dues_status
  );

  IF _is_admin THEN
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (v_uid, v_tenant, 'club_admin'::app_role)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (v_uid, v_tenant, 'super_admin'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public._qa_random_score(_motor text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_a int := 6;
  v_b int := (random() * 4)::int; -- 0..4
BEGIN
  IF _motor = 'americano_rotacion' THEN
    RETURN jsonb_build_object('games_a', 6, 'games_b', (random()*5)::int);
  END IF;
  RETURN jsonb_build_object(
    'sets', jsonb_build_array(
      jsonb_build_object('a', v_a, 'b', v_b),
      jsonb_build_object('a', v_a, 'b', (random()*4)::int)
    )
  );
END;
$$;

-- ---------- qa_reset ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.qa_reset(_slug text DEFAULT 'qa-sandbox')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_tenant uuid;
  v_user_ids uuid[];
BEGIN
  IF _slug IS DISTINCT FROM 'qa-sandbox' THEN
    RAISE EXCEPTION 'qa_reset SOLO opera sobre el tenant qa-sandbox (recibió %)', _slug;
  END IF;

  SELECT id INTO v_tenant FROM public.tenants WHERE slug = 'qa-sandbox';
  IF v_tenant IS NOT NULL THEN
    SELECT array_agg(user_id) INTO v_user_ids FROM public.profiles WHERE tenant_id = v_tenant;
    -- Borra rows que referencian auth.users sin cascade
    DELETE FROM public.user_roles WHERE tenant_id = v_tenant;
    -- Borra el tenant (cascadea profiles, courts, tournaments, etc.)
    DELETE FROM public.tenants WHERE id = v_tenant;
    -- Borra usuarios auth correspondientes
    IF v_user_ids IS NOT NULL THEN
      DELETE FROM auth.users WHERE id = ANY(v_user_ids);
    END IF;
  END IF;

  INSERT INTO public.tenants (slug, name, short_name, ladder_label)
  VALUES ('qa-sandbox', 'QA Sandbox', 'QA', 'Pirámide');
END;
$$;

-- ---------- qa_seed_players --------------------------------------------------

CREATE OR REPLACE FUNCTION public.qa_seed_players(_n int DEFAULT 200)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_tenant uuid := public._qa_tenant_id();
  v_i int;
  v_uid uuid;
  v_label text;
  v_email text;
  v_lvl numeric;
  v_sport rating_sport;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Falta tenant qa-sandbox. Corre qa_reset() primero.'; END IF;

  -- Asegura el admin sintético
  PERFORM public._qa_make_user('qa-admin@aceplay.test', 'QA Admin', true);

  FOR v_i IN 1.._n LOOP
    v_label := 'Jugador QA ' || lpad(v_i::text, 3, '0');
    v_email := 'qa' || lpad(v_i::text, 3, '0') || '@aceplay.test';
    v_uid := public._qa_make_user(v_email, v_label, false);

    -- Rating en 3 deportes con distribución realista (gauss recortado)
    FOREACH v_sport IN ARRAY ARRAY['tenis_singles','tenis_dobles','padel']::rating_sport[] LOOP
      v_lvl := GREATEST(0.5, LEAST(6.5, 3.0 + (random() - 0.5) * 3.0));
      INSERT INTO public.player_ratings (user_id, tenant_id, sport, level, reliability, initial_level, matches_played, onboarding_completed_at)
      VALUES (v_uid, v_tenant, v_sport, v_lvl, 60, v_lvl, (random()*20)::int, now())
      ON CONFLICT (user_id, sport) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

-- ---------- qa_seed_clubs ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.qa_seed_clubs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := public._qa_tenant_id();
  v_clubs text[] := ARRAY['Club Demo A','Club Demo B','Club Demo C'];
  v_club text;
  v_idx int := 0;
  v_surf court_surface;
  v_i int;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Falta tenant qa-sandbox'; END IF;

  FOREACH v_club IN ARRAY v_clubs LOOP
    v_idx := v_idx + 1;
    FOR v_i IN 1..3 LOOP
      v_surf := CASE WHEN ((v_idx + v_i) % 2) = 0 THEN 'arcilla'::court_surface ELSE 'dura'::court_surface END;
      INSERT INTO public.courts (tenant_id, name, surface, is_indoor, sort_order)
      VALUES (v_tenant, v_club || ' — Cancha ' || v_i, v_surf, (v_idx = 3), v_idx*10 + v_i)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

-- ---------- qa_seed_tournament ----------------------------------------------

CREATE OR REPLACE FUNCTION public.qa_seed_tournament(
  _motor text,
  _scheduling text DEFAULT 'admin',
  _state text DEFAULT 'en_curso',
  _participants int DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_tenant uuid := public._qa_tenant_id();
  v_admin uuid := public._qa_admin_uid();
  v_name text;
  v_tour_id uuid;
  v_cat_id uuid;
  v_n int;
  v_sport tournament_sport := 'tenis';
  v_modality tournament_modality := 'singles';
  v_discipline tournament_discipline := 'tenis_singles';
  v_motor competition_motor;
  v_regs uuid[];
  v_match_ids uuid[];
  v_player_ids uuid[];
  v_seeds uuid[];
  v_i int;
  v_match record;
  v_pct numeric;
  v_round_id uuid;
  v_round_num int;
  v_round_match record;
BEGIN
  IF v_tenant IS NULL OR v_admin IS NULL THEN
    RAISE EXCEPTION 'Falta tenant/admin QA. Corre qa_seed_players() primero.';
  END IF;

  v_motor := _motor::competition_motor;

  -- Defaults por motor
  IF _motor = 'americano_rotacion' THEN
    v_sport := 'padel'; v_modality := 'dobles'; v_discipline := 'padel_dobles';
    v_n := COALESCE(_participants, 8);
  ELSIF _motor = 'doble_eliminacion' OR _motor = 'consolacion' THEN
    v_n := COALESCE(_participants, 16);
  ELSIF _motor = 'round_robin' THEN
    v_n := COALESCE(_participants, 12);
  ELSIF _motor = 'grupos_playoff' THEN
    v_n := COALESCE(_participants, 16);
  ELSE
    v_n := COALESCE(_participants, 8);
  END IF;

  v_name := format('[QA] %s · %s · %s', _motor, _scheduling, _state);

  -- Idempotencia: si ya existe, devuelve el id
  SELECT id INTO v_tour_id FROM public.tournaments WHERE tenant_id = v_tenant AND name = v_name;
  IF v_tour_id IS NOT NULL THEN RETURN v_tour_id; END IF;

  INSERT INTO public.tournaments (
    tenant_id, name, slug, description,
    registration_opens_at, registration_closes_at, starts_at, ends_at,
    status, created_by, default_config
  ) VALUES (
    v_tenant, v_name,
    'qa-' || lower(regexp_replace(_motor || '-' || _scheduling || '-' || _state, '[^a-z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6),
    'Torneo QA sintético — motor ' || _motor,
    now() - interval '7 days', now() + interval '14 days',
    now() + interval '1 day', now() + interval '21 days',
    'inscripciones_abiertas'::tournament_status, v_admin, '{}'::jsonb
  ) RETURNING id INTO v_tour_id;

  INSERT INTO public.tournament_categories (
    tournament_id, tenant_id, name, category_label,
    gender, discipline, surface, max_participants, status,
    sport, modality, motor, scheduling,
    americano_rounds_target
  ) VALUES (
    v_tour_id, v_tenant, 'Open ' || _motor, 'Open',
    'mixto', v_discipline, 'arcilla', v_n,
    'inscripciones_abiertas'::tournament_status,
    v_sport, v_modality, v_motor, _scheduling,
    CASE WHEN _motor = 'americano_rotacion' THEN 4 ELSE NULL END
  ) RETURNING id INTO v_cat_id;

  -- Selecciona jugadores QA y los inscribe directamente como 'confirmada'
  SELECT array_agg(user_id) INTO v_player_ids
    FROM (
      SELECT p.user_id
        FROM public.profiles p
       WHERE p.tenant_id = v_tenant
         AND p.email LIKE 'qa%@aceplay.test'
         AND p.email <> 'qa-admin@aceplay.test'
       ORDER BY p.email
       LIMIT v_n
    ) s;

  IF v_player_ids IS NULL OR array_length(v_player_ids,1) < v_n THEN
    RAISE EXCEPTION 'Faltan jugadores QA (necesito %, hay %)', v_n, COALESCE(array_length(v_player_ids,1),0);
  END IF;

  -- Inscripciones (singles → solo player1; dobles no-americano → parejas)
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

  -- Estado 'abierto': nos detenemos aquí
  IF _state = 'abierto' THEN RETURN v_tour_id; END IF;

  -- Para generar fixture, impersonamos al admin QA
  PERFORM public._qa_impersonate(v_admin);

  -- Genera fixture según motor
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
    -- Genera 2 rondas, juega ambas
    FOR v_round_num IN 1..2 LOOP
      v_round_id := public.generate_americano_round(v_cat_id, v_round_num);
      -- juega todos los partidos de la ronda
      FOR v_round_match IN
        SELECT id FROM public.tournament_matches
         WHERE americano_round_id = v_round_id
      LOOP
        UPDATE public.tournament_matches
           SET winner_side = CASE WHEN random() < 0.5 THEN 'a' ELSE 'b' END,
               score = public._qa_random_score(_motor),
               status = 'jugado'::match_status,
               played_at = now()
         WHERE id = v_round_match.id;
      END LOOP;
      UPDATE public.americano_rounds SET status = 'finalizada' WHERE id = v_round_id;
    END LOOP;
    UPDATE public.tournaments SET status = 'en_curso'::tournament_status WHERE id = v_tour_id;
    RETURN v_tour_id;
  ELSE
    RAISE EXCEPTION 'Motor no soportado en qa_seed_tournament: %', _motor;
  END IF;

  -- Marca el torneo en curso
  UPDATE public.tournaments SET status = 'en_curso'::tournament_status WHERE id = v_tour_id;

  -- Reporta resultados sintéticos
  v_pct := CASE _state WHEN 'finalizado' THEN 1.0 ELSE 0.5 END;

  -- Para brackets con propagación (next_match_id), procesamos por orden de round+bracket_position
  FOR v_match IN
    SELECT id, registration_a_id, registration_b_id
      FROM public.tournament_matches
     WHERE tournament_category_id = v_cat_id
       AND americano_round_id IS NULL
     ORDER BY round, bracket_position
  LOOP
    -- refresh row (puede haber sido propagada)
    PERFORM 1 FROM public.tournament_matches WHERE id = v_match.id
      AND registration_a_id IS NOT NULL AND registration_b_id IS NOT NULL
      AND status = 'pendiente';
    IF NOT FOUND THEN CONTINUE; END IF;

    IF random() > v_pct THEN CONTINUE; END IF;

    -- Toma valores actuales (los slots pueden haber cambiado al propagar)
    DECLARE
      v_a uuid; v_b uuid; v_winner uuid;
    BEGIN
      SELECT registration_a_id, registration_b_id INTO v_a, v_b
        FROM public.tournament_matches WHERE id = v_match.id;
      IF v_a IS NULL OR v_b IS NULL THEN CONTINUE; END IF;
      v_winner := CASE WHEN random() < 0.5 THEN v_a ELSE v_b END;

      UPDATE public.tournament_matches
         SET winner_registration_id = v_winner,
             score = public._qa_random_score(_motor),
             status = 'jugado'::match_status,
             played_at = now()
       WHERE id = v_match.id;
    END;
  END LOOP;

  RETURN v_tour_id;
END;
$$;

-- ---------- qa_seed_all ------------------------------------------------------

CREATE OR REPLACE FUNCTION public.qa_seed_all()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  PERFORM public.qa_reset('qa-sandbox');
  PERFORM public.qa_seed_players(200);
  PERFORM public.qa_seed_clubs();

  PERFORM public.qa_seed_tournament('eliminacion_simple', 'admin',         'en_curso', 8);
  PERFORM public.qa_seed_tournament('consolacion',        'admin',         'en_curso', 16);
  PERFORM public.qa_seed_tournament('doble_eliminacion',  'admin',         'en_curso', 16);
  PERFORM public.qa_seed_tournament('round_robin',        'desafio_libre', 'en_curso', 8);
  PERFORM public.qa_seed_tournament('round_robin',        'fixture_auto',  'en_curso', 8);
  PERFORM public.qa_seed_tournament('grupos_playoff',     'admin',         'en_curso', 16);
  PERFORM public.qa_seed_tournament('americano_rotacion', 'admin',         'en_curso', 8);

  -- Torneo monstruo: round_robin 64 jugadores → 2016 partidos, ~30% jugado
  PERFORM public.qa_seed_tournament('round_robin', 'desafio_libre', 'en_curso', 64);
END;
$$;

-- ---------- permisos: SOLO service_role -------------------------------------

REVOKE ALL ON FUNCTION public.qa_reset(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qa_seed_players(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qa_seed_clubs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qa_seed_tournament(text, text, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qa_seed_all() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._qa_tenant_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._qa_admin_uid() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._qa_impersonate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._qa_make_user(text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._qa_random_score(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.qa_reset(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.qa_seed_players(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.qa_seed_clubs() TO service_role;
GRANT EXECUTE ON FUNCTION public.qa_seed_tournament(text, text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.qa_seed_all() TO service_role;
GRANT EXECUTE ON FUNCTION public._qa_tenant_id() TO service_role;
GRANT EXECUTE ON FUNCTION public._qa_admin_uid() TO service_role;
GRANT EXECUTE ON FUNCTION public._qa_impersonate(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._qa_make_user(text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public._qa_random_score(text) TO service_role;
