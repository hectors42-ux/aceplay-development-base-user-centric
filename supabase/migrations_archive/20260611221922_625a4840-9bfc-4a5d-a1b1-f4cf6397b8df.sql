
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
    now() - interval '14 days',
    now() - interval '2 days',
    now() - interval '1 day',
    now() + interval '14 days',
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
    RAISE EXCEPTION 'Faltan jugadores demo (necesito %, hay %).',
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
    SELECT array_agg(id ORDER BY registered_at) INTO v_seeds FROM public.tournament_registrations WHERE tournament_category_id = v_cat_id;
    PERFORM public.generate_bracket(v_cat_id, v_seeds);
  ELSIF _motor = 'consolacion' THEN
    SELECT array_agg(id ORDER BY registered_at) INTO v_seeds FROM public.tournament_registrations WHERE tournament_category_id = v_cat_id;
    PERFORM public.generate_consolation(v_cat_id, v_seeds);
  ELSIF _motor = 'doble_eliminacion' THEN
    SELECT array_agg(id ORDER BY registered_at) INTO v_seeds FROM public.tournament_registrations WHERE tournament_category_id = v_cat_id;
    PERFORM public.generate_double_elimination(v_cat_id, v_seeds);
  ELSIF _motor = 'round_robin' THEN
    PERFORM public.generate_round_robin(v_cat_id);
  ELSIF _motor = 'grupos_playoff' THEN
    SELECT array_agg(id ORDER BY registered_at) INTO v_seeds FROM public.tournament_registrations WHERE tournament_category_id = v_cat_id;
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
      SELECT registration_a_id, registration_b_id INTO v_a, v_b FROM public.tournament_matches WHERE id = v_match.id;
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
