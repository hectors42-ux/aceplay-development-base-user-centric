-- Rename columns
ALTER TABLE public.tournament_registrations RENAME COLUMN category_id TO tournament_category_id;
ALTER TABLE public.tournament_matches       RENAME COLUMN category_id TO tournament_category_id;

-- ===================== Funciones reescritas =====================

CREATE OR REPLACE FUNCTION public.register_to_category(_category_id uuid, _player2_user_id uuid DEFAULT NULL::uuid)
 RETURNS tournament_registrations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_tenant UUID;
  v_category public.tournament_categories%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_count INTEGER;
  v_registration public.tournament_registrations%ROWTYPE;
  v_initial_status public.registration_status;
  v_dues public.dues_status;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_category FROM public.tournament_categories WHERE id = _category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La categoría no existe'; END IF;

  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_category.tournament_id;

  v_user_tenant := public.user_tenant_id(v_user_id);
  IF v_user_tenant IS NULL OR v_user_tenant <> v_category.tenant_id THEN
    RAISE EXCEPTION 'No puedes inscribirte a torneos de otro club';
  END IF;

  SELECT dues_status INTO v_dues FROM public.profiles WHERE user_id = v_user_id;
  IF v_dues IN ('moroso','suspendido') THEN
    RAISE EXCEPTION 'No puedes inscribirte: cuotas %', v_dues;
  END IF;

  IF now() < v_tournament.registration_opens_at THEN
    RAISE EXCEPTION 'Las inscripciones aún no abren';
  END IF;
  IF now() > v_tournament.registration_closes_at THEN
    RAISE EXCEPTION 'Las inscripciones ya cerraron';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.tournament_registrations
  WHERE tournament_category_id = _category_id
    AND status IN ('confirmada','pendiente_admin','pendiente_pareja');
  IF v_count >= v_category.max_participants THEN
    RAISE EXCEPTION 'La categoría está llena';
  END IF;

  IF v_category.discipline = 'tenis_dobles' THEN
    IF _player2_user_id IS NULL THEN
      RAISE EXCEPTION 'Debes elegir una pareja para dobles';
    END IF;
    IF _player2_user_id = v_user_id THEN
      RAISE EXCEPTION 'La pareja debe ser otro socio';
    END IF;
    IF public.user_tenant_id(_player2_user_id) <> v_category.tenant_id THEN
      RAISE EXCEPTION 'La pareja debe ser socio del mismo club';
    END IF;
    v_initial_status := 'pendiente_pareja';
  ELSE
    IF _player2_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'No se acepta pareja en singles';
    END IF;
    v_initial_status := 'pendiente_admin';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tournament_registrations
    WHERE tournament_category_id = _category_id
      AND status NOT IN ('rechazada','retirada')
      AND (player1_user_id = v_user_id OR player2_user_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'Ya estás inscrito en esta categoría';
  END IF;

  INSERT INTO public.tournament_registrations (
    tournament_id, tournament_category_id, tenant_id,
    player1_user_id, player2_user_id, status
  ) VALUES (
    v_category.tournament_id, _category_id, v_category.tenant_id,
    v_user_id, _player2_user_id, v_initial_status
  ) RETURNING * INTO v_registration;

  RETURN v_registration;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_bracket(_category_id uuid, _seed_order uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_category public.tournament_categories%ROWTYPE;
  v_count INTEGER;
  v_bracket_size INTEGER;
  v_total_rounds INTEGER;
  v_regs UUID[];
  v_a UUID;
  v_b UUID;
  v_match_id UUID;
  v_next_id UUID;
  v_next_slot CHAR(1);
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_category FROM public.tournament_categories WHERE id = _category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La categoría no existe'; END IF;
  IF NOT public.is_club_admin_of(v_user_id, v_category.tenant_id) THEN
    RAISE EXCEPTION 'Solo administradores pueden generar la llave';
  END IF;
  IF v_category.bracket_generated_at IS NOT NULL THEN
    RAISE EXCEPTION 'La llave ya fue generada';
  END IF;

  IF _seed_order IS NOT NULL AND array_length(_seed_order, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(_seed_order) WITH ORDINALITY AS s(id, ord)
      WHERE s.id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.tournament_registrations r
          WHERE r.id = s.id AND r.tournament_category_id = _category_id AND r.status = 'confirmada'
        )
    ) THEN
      RAISE EXCEPTION 'El orden de seeding contiene inscripciones inválidas';
    END IF;
    v_regs := _seed_order;
  ELSE
    SELECT ARRAY_AGG(id ORDER BY (seed IS NULL), seed NULLS LAST, registered_at)
    INTO v_regs
    FROM public.tournament_registrations
    WHERE tournament_category_id = _category_id AND status = 'confirmada';
  END IF;

  v_count := COALESCE(array_length(v_regs, 1), 0);
  IF v_count < 2 THEN RAISE EXCEPTION 'Se necesitan al menos 2 inscripciones confirmadas'; END IF;

  v_bracket_size := 2;
  WHILE v_bracket_size < v_count LOOP v_bracket_size := v_bracket_size * 2; END LOOP;
  v_total_rounds := CEIL(LOG(2, v_bracket_size))::INTEGER;

  WHILE COALESCE(array_length(v_regs, 1), 0) < v_bracket_size LOOP
    v_regs := array_append(v_regs, NULL::UUID);
  END LOOP;

  FOR r IN REVERSE 1..v_total_rounds LOOP
    DECLARE v_m INTEGER := v_bracket_size / (2 ^ (v_total_rounds - r + 1))::INTEGER;
    BEGIN
      FOR p IN 1..v_m LOOP
        INSERT INTO public.tournament_matches (
          tournament_id, tournament_category_id, tenant_id, round, bracket_position
        ) VALUES (
          v_category.tournament_id, _category_id, v_category.tenant_id, r, p
        );
      END LOOP;
    END;
  END LOOP;

  UPDATE public.tournament_matches m
  SET next_match_id = nm.id,
      next_match_slot = CASE WHEN (m.bracket_position % 2) = 1 THEN 'a' ELSE 'b' END
  FROM public.tournament_matches nm
  WHERE m.tournament_category_id = _category_id
    AND nm.tournament_category_id = _category_id
    AND m.round > 1
    AND nm.round = m.round - 1
    AND nm.bracket_position = CEIL(m.bracket_position::NUMERIC / 2);

  FOR i IN 1..(v_bracket_size / 2) LOOP
    v_a := v_regs[(i - 1) * 2 + 1];
    v_b := v_regs[(i - 1) * 2 + 2];

    UPDATE public.tournament_matches
    SET registration_a_id = v_a,
        registration_b_id = v_b,
        status = (CASE
          WHEN v_a IS NULL OR v_b IS NULL THEN 'walkover'
          ELSE 'pendiente'
        END)::public.match_status,
        winner_registration_id = CASE
          WHEN v_a IS NOT NULL AND v_b IS NULL THEN v_a
          WHEN v_b IS NOT NULL AND v_a IS NULL THEN v_b
          ELSE NULL
        END,
        walkover = (v_a IS NULL OR v_b IS NULL)
    WHERE tournament_category_id = _category_id
      AND round = v_total_rounds
      AND bracket_position = i;
  END LOOP;

  FOR v_match_id, v_a, v_next_id, v_next_slot IN
    SELECT id, winner_registration_id, next_match_id, next_match_slot
    FROM public.tournament_matches
    WHERE tournament_category_id = _category_id
      AND round = v_total_rounds
      AND walkover = true
      AND winner_registration_id IS NOT NULL
      AND next_match_id IS NOT NULL
  LOOP
    UPDATE public.tournament_matches
    SET registration_a_id = CASE WHEN v_next_slot = 'a' THEN v_a ELSE registration_a_id END,
        registration_b_id = CASE WHEN v_next_slot = 'b' THEN v_a ELSE registration_b_id END
    WHERE id = v_next_id;
  END LOOP;

  UPDATE public.tournament_categories
  SET bracket_generated_at = now(), status = 'en_curso'
  WHERE id = _category_id;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public._apply_match_result(_match_id uuid, _winner_registration_id uuid, _score jsonb, _walkover boolean, _retired boolean)
 RETURNS tournament_matches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_pending INTEGER;
BEGIN
  UPDATE public.tournament_matches
  SET winner_registration_id = _winner_registration_id,
      score = _score,
      walkover = _walkover,
      retired = _retired,
      status = (CASE WHEN _walkover THEN 'walkover' ELSE 'jugado' END)::public.match_status,
      played_at = COALESCE(played_at, now())
  WHERE id = _match_id
  RETURNING * INTO v_match;

  IF v_match.next_match_id IS NOT NULL THEN
    UPDATE public.tournament_matches
    SET registration_a_id = CASE WHEN v_match.next_match_slot = 'a' THEN _winner_registration_id ELSE registration_a_id END,
        registration_b_id = CASE WHEN v_match.next_match_slot = 'b' THEN _winner_registration_id ELSE registration_b_id END
    WHERE id = v_match.next_match_id;
  END IF;

  IF v_match.round = 1 THEN
    UPDATE public.tournament_categories SET status = 'finalizado' WHERE id = v_match.tournament_category_id;

    SELECT COUNT(*) INTO v_pending
    FROM public.tournament_categories
    WHERE tournament_id = v_match.tournament_id AND status <> 'finalizado';

    IF v_pending = 0 THEN
      UPDATE public.tournaments SET status = 'finalizado' WHERE id = v_match.tournament_id;
    END IF;
  END IF;

  RETURN v_match;
END;
$function$;

CREATE OR REPLACE FUNCTION public._tg_rating_on_tournament_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cat public.tournament_categories%ROWTYPE;
  v_sport public.rating_sport;
  v_winner_reg public.tournament_registrations%ROWTYPE;
  v_loser_reg public.tournament_registrations%ROWTYPE;
  v_winners uuid[];
  v_losers uuid[];
BEGIN
  IF NEW.status <> 'jugado' THEN RETURN NEW; END IF;
  IF OLD.status = 'jugado' THEN RETURN NEW; END IF;
  IF NEW.walkover THEN RETURN NEW; END IF;
  IF NEW.winner_registration_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.registration_a_id IS NULL OR NEW.registration_b_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_cat FROM public.tournament_categories WHERE id = NEW.tournament_category_id;
  v_sport := CASE v_cat.discipline::text
    WHEN 'tenis_singles' THEN 'tenis_singles'::public.rating_sport
    WHEN 'tenis_dobles'  THEN 'tenis_dobles'::public.rating_sport
    ELSE 'tenis_singles'::public.rating_sport
  END;

  SELECT * INTO v_winner_reg FROM public.tournament_registrations
    WHERE id = NEW.winner_registration_id;

  IF v_winner_reg.id = NEW.registration_a_id THEN
    SELECT * INTO v_loser_reg FROM public.tournament_registrations
      WHERE id = NEW.registration_b_id;
  ELSE
    SELECT * INTO v_loser_reg FROM public.tournament_registrations
      WHERE id = NEW.registration_a_id;
  END IF;

  v_winners := ARRAY[v_winner_reg.player1_user_id]
    || CASE WHEN v_winner_reg.player2_user_id IS NOT NULL
            THEN ARRAY[v_winner_reg.player2_user_id]
            ELSE ARRAY[]::uuid[] END;
  v_losers := ARRAY[v_loser_reg.player1_user_id]
    || CASE WHEN v_loser_reg.player2_user_id IS NOT NULL
            THEN ARRAY[v_loser_reg.player2_user_id]
            ELSE ARRAY[]::uuid[] END;

  PERFORM public._apply_rating_for_match(
    v_winners,
    v_losers,
    v_sport,
    'tournament_match'::public.rating_change_source,
    NEW.id,
    'Tournament match result'
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_tournament_match_scheduled()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_should_notify boolean := false;
  v_tournament record;
  v_court_name text;
  v_player_a uuid;
  v_player_a2 uuid;
  v_player_b uuid;
  v_player_b2 uuid;
  v_when_text text;
  v_link text;
begin
  if tg_op = 'INSERT' then
    v_should_notify := new.scheduled_at is not null and new.status = 'programado';
  elsif tg_op = 'UPDATE' then
    v_should_notify := new.scheduled_at is not null
      and new.status = 'programado'
      and (
        old.scheduled_at is distinct from new.scheduled_at
        or old.court_id is distinct from new.court_id
        or old.status is distinct from new.status
      );
  end if;

  if not v_should_notify then
    return new;
  end if;

  select id, name, slug into v_tournament from public.tournaments where id = new.tournament_id;
  if v_tournament.id is null then
    return new;
  end if;

  if new.court_id is not null then
    select name into v_court_name from public.courts where id = new.court_id;
  end if;

  select player1_user_id, player2_user_id into v_player_a, v_player_a2
  from public.tournament_registrations where id = new.registration_a_id;
  select player1_user_id, player2_user_id into v_player_b, v_player_b2
  from public.tournament_registrations where id = new.registration_b_id;

  v_when_text := to_char(new.scheduled_at at time zone 'America/Santiago', 'DD/MM HH24:MI');
  v_link := '/torneos/' || v_tournament.slug || '/cat/' || new.tournament_category_id;

  insert into public.user_notifications (tenant_id, user_id, kind, title, description, link, ref_id)
  select new.tenant_id, uid, 'tournament_match_scheduled',
    'Tu próximo partido',
    'Programado para ' || v_when_text || coalesce(' · ' || v_court_name, '') || ' en "' || v_tournament.name || '".',
    v_link,
    new.id
  from unnest(array[v_player_a, v_player_a2, v_player_b, v_player_b2]) as uid
  where uid is not null
    and not exists (
      select 1 from public.user_notifications n
      where n.user_id = uid
        and n.kind = 'tournament_match_scheduled'
        and n.ref_id = new.id
        and n.created_at > now() - interval '5 minutes'
    );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_match_result(_match_id uuid, _winner_registration_id uuid, _score jsonb DEFAULT NULL::jsonb, _walkover boolean DEFAULT false, _retired boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_match public.tournament_matches%ROWTYPE;
  v_tournament public.tournaments%ROWTYPE;
  v_category public.tournament_categories%ROWTYPE;
  v_is_admin BOOLEAN;
  v_is_player BOOLEAN;
  v_proposal public.tournament_match_results%ROWTYPE;
  v_applied public.tournament_matches%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_match FROM public.tournament_matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El partido no existe'; END IF;
  IF v_match.status IN ('jugado','walkover','cancelado') THEN
    RAISE EXCEPTION 'El partido ya tiene resultado';
  END IF;
  IF v_match.registration_a_id IS NULL OR v_match.registration_b_id IS NULL THEN
    RAISE EXCEPTION 'El partido aún no tiene contendientes definidos';
  END IF;
  IF _winner_registration_id NOT IN (v_match.registration_a_id, v_match.registration_b_id) THEN
    RAISE EXCEPTION 'El ganador debe ser uno de los dos contendientes';
  END IF;

  SELECT * INTO v_category FROM public.tournament_categories WHERE id = v_match.tournament_category_id;
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = v_match.tournament_id;

  v_is_admin := public.is_club_admin_of(v_user_id, v_match.tenant_id);
  v_is_player := public.is_match_player(v_user_id, _match_id);

  IF NOT (v_is_admin OR v_is_player) THEN
    RAISE EXCEPTION 'No tienes permiso para registrar este resultado';
  END IF;

  UPDATE public.tournament_match_results
    SET status = 'rechazado', responded_at = now(), responded_by = v_user_id, reject_reason = 'Reemplazada'
    WHERE match_id = _match_id AND status = 'propuesto';

  IF v_is_admin THEN
    v_applied := public._apply_match_result(_match_id, _winner_registration_id, _score, _walkover, _retired);
    RETURN jsonb_build_object('mode','aplicado','match_id', v_applied.id);
  END IF;

  IF v_tournament.result_validation_mode = 'solo_admin' THEN
    RAISE EXCEPTION 'Solo el administrador puede registrar resultados en este torneo';
  END IF;

  INSERT INTO public.tournament_match_results (
    match_id, tenant_id, proposed_by, winner_registration_id,
    score, walkover, retired
  ) VALUES (
    _match_id, v_match.tenant_id, v_user_id, _winner_registration_id,
    _score, _walkover, _retired
  ) RETURNING * INTO v_proposal;

  RETURN jsonb_build_object(
    'mode', CASE WHEN v_tournament.result_validation_mode = 'jugadores_con_confirmacion' THEN 'pendiente_rival' ELSE 'pendiente_admin' END,
    'proposal_id', v_proposal.id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.withdraw_from_category(_registration_id uuid)
 RETURNS tournament_registrations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_reg public.tournament_registrations%ROWTYPE;
  v_category public.tournament_categories%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_reg FROM public.tournament_registrations WHERE id = _registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inscripción no encontrada'; END IF;
  IF v_reg.player1_user_id <> v_user_id AND v_reg.player2_user_id <> v_user_id
     AND NOT public.is_club_admin_of(v_user_id, v_reg.tenant_id) THEN
    RAISE EXCEPTION 'Solo los inscritos o el admin pueden retirarse';
  END IF;
  SELECT * INTO v_category FROM public.tournament_categories WHERE id = v_reg.tournament_category_id;
  IF v_category.bracket_generated_at IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede retirar: la llave ya fue generada';
  END IF;
  UPDATE public.tournament_registrations
    SET status = 'retirada', withdrawn_at = now()
    WHERE id = _registration_id
    RETURNING * INTO v_reg;
  RETURN v_reg;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notifications_feed()
 RETURNS TABLE(kind text, ref_id uuid, title text, description text, link text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;
  v_tenant_id := public.user_tenant_id(v_user_id);

  IF v_tenant_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 'club_announcement'::TEXT, a.id,
      a.title::TEXT,
      COALESCE(a.body, '')::TEXT,
      COALESCE(a.cta_url, '')::TEXT,
      a.starts_at
    FROM public.club_announcements a
    WHERE a.tenant_id = v_tenant_id
      AND a.is_published = true
      AND a.starts_at <= now()
      AND (a.ends_at IS NULL OR a.ends_at >= now());
  END IF;

  RETURN QUERY
  SELECT 'result_proposal'::TEXT, r.id,
    'Resultado por confirmar'::TEXT,
    ('Tu rival propuso un resultado en ' || COALESCE(t.name, 'un torneo'))::TEXT,
    ('/torneos/' || t.slug || '/cat/' || c.id || '?focus=match&match=' || m.id)::TEXT,
    r.created_at
  FROM public.tournament_match_results r
  JOIN public.tournament_matches m ON m.id = r.match_id
  JOIN public.tournament_categories c ON c.id = m.tournament_category_id
  JOIN public.tournaments t ON t.id = m.tournament_id
  WHERE r.status = 'propuesto' AND r.proposed_by <> v_user_id
    AND public.is_match_player(v_user_id, r.match_id);

  RETURN QUERY
  SELECT 'reschedule_request'::TEXT, rr.id,
    'Reagendamiento por responder'::TEXT,
    ('Te proponen mover un partido en ' || COALESCE(t.name, 'un torneo'))::TEXT,
    ('/torneos/' || t.slug || '/cat/' || c.id || '?focus=match&match=' || m.id)::TEXT,
    rr.created_at
  FROM public.tournament_match_reschedule_requests rr
  JOIN public.tournament_matches m ON m.id = rr.match_id
  JOIN public.tournament_categories c ON c.id = m.tournament_category_id
  JOIN public.tournaments t ON t.id = m.tournament_id
  WHERE rr.status = 'pendiente' AND rr.proposed_by <> v_user_id
    AND public.is_match_player(v_user_id, rr.match_id);

  RETURN QUERY
  SELECT 'doubles_invitation'::TEXT, reg.id,
    'Invitación de pareja'::TEXT,
    ('Te invitaron a jugar dobles en ' || COALESCE(t.name, 'un torneo'))::TEXT,
    ('/torneos/' || t.slug || '/cat/' || c.id || '?focus=invitations')::TEXT,
    reg.created_at
  FROM public.tournament_registrations reg
  JOIN public.tournament_categories c ON c.id = reg.tournament_category_id
  JOIN public.tournaments t ON t.id = reg.tournament_id
  WHERE reg.status = 'pendiente_pareja' AND reg.player2_user_id = v_user_id;

  IF v_tenant_id IS NOT NULL AND public.is_club_admin_of(v_user_id, v_tenant_id) THEN
    RETURN QUERY
    SELECT 'admin_registration'::TEXT, reg.id,
      'Inscripción por aprobar'::TEXT,
      ('Hay solicitudes en ' || COALESCE(t.name, 'un torneo'))::TEXT,
      ('/admin/torneos/' || t.id || '?focus=registrations')::TEXT,
      reg.created_at
    FROM public.tournament_registrations reg
    JOIN public.tournaments t ON t.id = reg.tournament_id
    WHERE reg.status = 'pendiente_admin' AND reg.tenant_id = v_tenant_id;
  END IF;

  RETURN QUERY
  SELECT 'ladder_challenge'::TEXT, lc.id,
    'Desafío recibido'::TEXT,
    ('Te retaron en ' || COALESCE(l.name, 'la pirámide'))::TEXT,
    '/ranking?tab=piramide'::TEXT,
    lc.proposed_at
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.status = 'propuesto' AND lc.challenged_user_id = v_user_id;

  RETURN QUERY
  SELECT 'ladder_challenge_accepted'::TEXT, lc.id,
    'Desafío aceptado'::TEXT,
    ('Coordina la cancha para tu desafío en ' || COALESCE(l.name, 'la pirámide'))::TEXT,
    '/ranking?tab=piramide'::TEXT,
    COALESCE(lc.responded_at, lc.updated_at)
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.status = 'aceptado'
    AND lc.scheduled_at IS NULL
    AND (lc.challenger_user_id = v_user_id OR lc.challenged_user_id = v_user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.ladder_challenge_schedule_proposals p
      WHERE p.challenge_id = lc.id AND p.status IN ('pendiente','confirmada')
    );

  RETURN QUERY
  SELECT 'ladder_propose_slots'::TEXT, lc.id,
    'Elige un horario'::TEXT,
    ('Tu rival propuso 3 horarios en ' || COALESCE(l.name, 'la pirámide'))::TEXT,
    '/ranking?tab=piramide'::TEXT,
    lcsp.proposed_at
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  JOIN public.ladder_challenge_schedule_proposals lcsp ON lcsp.challenge_id = lc.id AND lcsp.status='pendiente'
  WHERE lc.status = 'aceptado'
    AND lc.challenged_user_id = v_user_id
    AND lcsp.proposed_by = lc.challenger_user_id;

  RETURN QUERY
  SELECT 'result_to_load'::TEXT, lc.id,
    'Carga el resultado'::TEXT,
    ('Tu desafío en ' || COALESCE(l.name, 'la pirámide') || ' terminó. Sube el marcador.')::TEXT,
    '/ranking?tab=piramide&openResult=1'::TEXT,
    lc.scheduled_at + INTERVAL '2 hours'
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.status = 'aceptado'
    AND lc.result_proposed_at IS NULL
    AND lc.scheduled_at IS NOT NULL
    AND lc.scheduled_at + INTERVAL '2 hours' < now()
    AND (lc.challenger_user_id = v_user_id OR lc.challenged_user_id = v_user_id);

  RETURN QUERY
  SELECT 'result_to_load'::TEXT, mi.id,
    'Carga el resultado'::TEXT,
    'Tu partido terminó. Sube el marcador para actualizar tu rating.'::TEXT,
    ('/partner/match/' || mi.id || '?openResult=1')::TEXT,
    ((mi.selected_slot->>'starts_at')::timestamptz) + INTERVAL '2 hours'
  FROM public.match_invitations mi
  LEFT JOIN public.partner_match_results pr ON pr.invitation_id = mi.id
  WHERE mi.status = 'accepted'
    AND (mi.inviter_user_id = v_user_id OR mi.invitee_user_id = v_user_id)
    AND mi.selected_slot IS NOT NULL
    AND ((mi.selected_slot->>'starts_at')::timestamptz) + INTERVAL '2 hours' < now()
    AND (pr.invitation_id IS NULL OR pr.status = 'rechazado');

  RETURN QUERY
  SELECT 'result_to_load'::TEXT, m.id,
    'Carga el resultado'::TEXT,
    ('Tu partido en ' || COALESCE(t.name, 'el torneo') || ' terminó. Sube el marcador.')::TEXT,
    ('/torneos/' || t.slug || '/cat/' || c.id || '?focus=match&match=' || m.id || '&openResult=1')::TEXT,
    m.scheduled_at + INTERVAL '2 hours'
  FROM public.tournament_matches m
  JOIN public.tournament_categories c ON c.id = m.tournament_category_id
  JOIN public.tournaments t ON t.id = m.tournament_id
  LEFT JOIN public.tournament_match_results r
    ON r.match_id = m.id AND r.status IN ('propuesto','confirmado')
  WHERE m.scheduled_at IS NOT NULL
    AND m.scheduled_at + INTERVAL '2 hours' < now()
    AND m.winner_registration_id IS NULL
    AND m.walkover = false
    AND r.id IS NULL
    AND public.is_match_player(v_user_id, m.id);

  RETURN QUERY
  SELECT un.kind, un.ref_id, un.title, COALESCE(un.description,''), COALESCE(un.link,''), un.created_at
  FROM public.user_notifications un
  WHERE un.user_id = v_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_match_history(_user_id uuid, _limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_tenant uuid;
  v_target_tenant uuid;
  v_is_self boolean;
  v_effective_limit integer;
  v_played jsonb;
  v_pending_tournaments jsonb;
  v_pending_ladder jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT tenant_id INTO v_target_tenant FROM public.profiles WHERE user_id = _user_id LIMIT 1;
  IF v_target_tenant IS NULL THEN
    RETURN jsonb_build_object('played', '[]'::jsonb, 'pending_tournaments', '[]'::jsonb, 'pending_ladder', '[]'::jsonb);
  END IF;

  SELECT tenant_id INTO v_caller_tenant FROM public.profiles WHERE user_id = v_caller LIMIT 1;
  IF v_caller_tenant <> v_target_tenant AND NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_is_self := (v_caller = _user_id);
  v_effective_limit := CASE WHEN v_is_self THEN LEAST(GREATEST(_limit, 1), 50) ELSE 10 END;

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.recorded_at DESC), '[]'::jsonb)
    INTO v_played
  FROM (
    SELECT
      rh.id,
      rh.recorded_at,
      rh.delta,
      rh.level_after,
      rh.source::text AS source,
      rh.source_ref_id,
      CASE
        WHEN rh.source = 'ladder_challenge' THEN (
          SELECT CASE WHEN lc.challenger_user_id = _user_id THEN lc.challenged_user_id ELSE lc.challenger_user_id END
          FROM public.ladder_challenges lc WHERE lc.id = rh.source_ref_id
        )
        WHEN rh.source = 'tournament_match' THEN (
          SELECT CASE
            WHEN tr_a.player1_user_id = _user_id OR tr_a.player2_user_id = _user_id THEN COALESCE(tr_b.player1_user_id, tr_b.player2_user_id)
            ELSE COALESCE(tr_a.player1_user_id, tr_a.player2_user_id)
          END
          FROM public.tournament_matches tm
          LEFT JOIN public.tournament_registrations tr_a ON tr_a.id = tm.registration_a_id
          LEFT JOIN public.tournament_registrations tr_b ON tr_b.id = tm.registration_b_id
          WHERE tm.id = rh.source_ref_id
        )
        WHEN rh.source = 'open_match' THEN NULL
        ELSE NULL
      END AS opponent_id,
      CASE
        WHEN rh.source = 'ladder_challenge' THEN (
          SELECT lc.score FROM public.ladder_challenges lc WHERE lc.id = rh.source_ref_id
        )
        WHEN rh.source = 'tournament_match' THEN (
          SELECT to_jsonb(tmr.score) FROM public.tournament_match_results tmr
          WHERE tmr.match_id = rh.source_ref_id AND tmr.status = 'confirmado'
          ORDER BY tmr.responded_at DESC NULLS LAST LIMIT 1
        )
        ELSE NULL
      END AS score,
      (rh.delta > 0) AS won
    FROM public.rating_history rh
    WHERE rh.user_id = _user_id
      AND rh.tenant_id = v_target_tenant
    ORDER BY rh.recorded_at DESC
    LIMIT v_effective_limit
  ) x;

  IF v_is_self THEN
    SELECT COALESCE(jsonb_agg(row_to_json(y)::jsonb ORDER BY y.scheduled_at NULLS LAST, y.created_at DESC), '[]'::jsonb)
      INTO v_pending_tournaments
    FROM (
      SELECT
        tm.id AS match_id,
        tm.scheduled_at,
        tm.created_at,
        tm.round,
        tc.id AS category_id,
        tc.name AS category_name,
        t.slug AS tournament_slug,
        t.name AS tournament_name,
        CASE
          WHEN tr_a.player1_user_id = _user_id OR tr_a.player2_user_id = _user_id THEN (
            COALESCE((SELECT first_name||' '||last_name FROM public.profiles WHERE user_id = tr_b.player1_user_id), 'Jugador') ||
            CASE WHEN tr_b.player2_user_id IS NOT NULL THEN ' / '||COALESCE((SELECT first_name||' '||last_name FROM public.profiles WHERE user_id = tr_b.player2_user_id), '') ELSE '' END
          )
          ELSE (
            COALESCE((SELECT first_name||' '||last_name FROM public.profiles WHERE user_id = tr_a.player1_user_id), 'Jugador') ||
            CASE WHEN tr_a.player2_user_id IS NOT NULL THEN ' / '||COALESCE((SELECT first_name||' '||last_name FROM public.profiles WHERE user_id = tr_a.player2_user_id), '') ELSE '' END
          )
        END AS opponent_name,
        EXISTS (
          SELECT 1 FROM public.tournament_match_results tmr
          WHERE tmr.match_id = tm.id AND tmr.status = 'propuesto'
        ) AS has_pending_proposal,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.tournament_match_results tmr
            WHERE tmr.match_id = tm.id AND tmr.status = 'propuesto' AND tmr.proposed_by = _user_id
          ) THEN 'wait'
          WHEN EXISTS (
            SELECT 1 FROM public.tournament_match_results tmr
            WHERE tmr.match_id = tm.id AND tmr.status = 'propuesto' AND tmr.proposed_by <> _user_id
          ) THEN 'confirm'
          ELSE 'submit'
        END AS needs_action
      FROM public.tournament_matches tm
      JOIN public.tournament_categories tc ON tc.id = tm.tournament_category_id
      JOIN public.tournaments t ON t.id = tm.tournament_id
      LEFT JOIN public.tournament_registrations tr_a ON tr_a.id = tm.registration_a_id
      LEFT JOIN public.tournament_registrations tr_b ON tr_b.id = tm.registration_b_id
      WHERE tm.tenant_id = v_target_tenant
        AND tm.status IN ('pendiente', 'programado')
        AND tm.registration_a_id IS NOT NULL
        AND tm.registration_b_id IS NOT NULL
        AND (
          tr_a.player1_user_id = _user_id OR tr_a.player2_user_id = _user_id
          OR tr_b.player1_user_id = _user_id OR tr_b.player2_user_id = _user_id
        )
      ORDER BY tm.scheduled_at NULLS LAST, tm.created_at DESC
      LIMIT 30
    ) y;

    SELECT COALESCE(jsonb_agg(row_to_json(z)::jsonb ORDER BY z.scheduled_at NULLS LAST, z.created_at DESC), '[]'::jsonb)
      INTO v_pending_ladder
    FROM (
      SELECT
        lc.id AS challenge_id,
        lc.scheduled_at,
        lc.created_at,
        lc.status::text AS status,
        lc.result_proposed_by,
        lc.result_proposed_at,
        l.id AS ladder_id,
        l.name AS ladder_name,
        CASE WHEN lc.challenger_user_id = _user_id THEN lc.challenged_user_id ELSE lc.challenger_user_id END AS opponent_id,
        (
          SELECT first_name||' '||last_name FROM public.profiles
          WHERE user_id = CASE WHEN lc.challenger_user_id = _user_id THEN lc.challenged_user_id ELSE lc.challenger_user_id END
        ) AS opponent_name,
        CASE
          WHEN lc.result_proposed_by IS NOT NULL AND lc.result_proposed_by <> _user_id THEN 'confirm'
          WHEN lc.result_proposed_by IS NULL THEN 'submit'
          ELSE 'wait'
        END AS needs_action
      FROM public.ladder_challenges lc
      JOIN public.ladders l ON l.id = lc.ladder_id
      WHERE lc.tenant_id = v_target_tenant
        AND lc.status IN ('aceptado', 'programado')
        AND (lc.challenger_user_id = _user_id OR lc.challenged_user_id = _user_id)
      ORDER BY lc.scheduled_at NULLS LAST, lc.created_at DESC
      LIMIT 30
    ) z;
  ELSE
    v_pending_tournaments := '[]'::jsonb;
    v_pending_ladder := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'played', COALESCE(v_played, '[]'::jsonb),
    'pending_tournaments', COALESCE(v_pending_tournaments, '[]'::jsonb),
    'pending_ladder', COALESCE(v_pending_ladder, '[]'::jsonb),
    'is_self', v_is_self,
    'limit', v_effective_limit
  );
END;
$function$;