
-- 1) Cualquiera de los 4 (retador, retado y sus compañeros) es "party" del desafío
CREATE OR REPLACE FUNCTION public.is_ladder_challenge_party(_challenge_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.ladder_challenges
    WHERE id = _challenge_id
      AND (
        challenger_user_id = _user_id
        OR challenged_user_id = _user_id
        OR challenger_partner_user_id = _user_id
        OR challenged_partner_user_id = _user_id
      )
  );
$function$;

-- 2) create_ladder_challenge_with_slots admite compañero del retador (obligatorio en padel_dobles)
CREATE OR REPLACE FUNCTION public.create_ladder_challenge_with_slots(
  _ladder_id uuid,
  _challenged_user_id uuid,
  _slots jsonb,
  _challenger_partner_user_id uuid DEFAULT NULL
)
RETURNS ladder_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_ladder public.ladders%ROWTYPE;
  v_challenger_pos public.ladder_positions%ROWTYPE;
  v_challenged_pos public.ladder_positions%ROWTYPE;
  v_partner_pos public.ladder_positions%ROWTYPE;
  v_dues public.dues_status;
  v_last_match TIMESTAMPTZ;
  v_challenge public.ladder_challenges%ROWTYPE;
  v_starts1 TIMESTAMPTZ;
  v_starts2 TIMESTAMPTZ;
  v_starts3 TIMESTAMPTZ;
  v_court1 UUID;
  v_court2 UUID;
  v_court3 UUID;
  v_min_at TIMESTAMPTZ;
  v_max_at TIMESTAMPTZ;
  v_is_padel boolean;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _challenged_user_id = v_user_id THEN
    RAISE EXCEPTION 'No puedes desafiarte a ti mismo';
  END IF;
  IF jsonb_typeof(_slots) <> 'array' OR jsonb_array_length(_slots) <> 3 THEN
    RAISE EXCEPTION 'Debes proponer exactamente 3 horarios';
  END IF;

  SELECT * INTO v_ladder FROM public.ladders WHERE id = _ladder_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La pirámide no existe'; END IF;
  IF NOT v_ladder.is_active THEN RAISE EXCEPTION 'La pirámide no está activa'; END IF;

  v_is_padel := (v_ladder.discipline::text = 'padel_dobles');

  -- Validar compañero del retador
  IF v_is_padel THEN
    IF _challenger_partner_user_id IS NULL THEN
      RAISE EXCEPTION 'Debes elegir un compañero para desafiar en pádel';
    END IF;
    IF _challenger_partner_user_id = v_user_id OR _challenger_partner_user_id = _challenged_user_id THEN
      RAISE EXCEPTION 'Tu compañero no puede ser tú mismo ni el rival';
    END IF;
    SELECT * INTO v_partner_pos FROM public.ladder_positions
      WHERE ladder_id = _ladder_id AND user_id = _challenger_partner_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Tu compañero no está inscrito en esta pirámide'; END IF;
    IF v_partner_pos.status <> 'activo' THEN
      RAISE EXCEPTION 'Tu compañero está % en la pirámide', v_partner_pos.status;
    END IF;
  ELSE
    -- Si la disciplina no es pádel, ignoramos cualquier compañero pasado por error.
    _challenger_partner_user_id := NULL;
  END IF;

  SELECT dues_status INTO v_dues FROM public.profiles WHERE user_id = v_user_id;
  IF v_dues IN ('moroso','suspendido') THEN
    RAISE EXCEPTION 'No puedes desafiar: cuotas %', v_dues;
  END IF;

  SELECT * INTO v_challenger_pos FROM public.ladder_positions
   WHERE ladder_id = _ladder_id AND user_id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No estás inscrito en esta pirámide'; END IF;
  IF v_challenger_pos.status <> 'activo' THEN
    RAISE EXCEPTION 'Tu posición está % en la pirámide', v_challenger_pos.status;
  END IF;

  SELECT * INTO v_challenged_pos FROM public.ladder_positions
   WHERE ladder_id = _ladder_id AND user_id = _challenged_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El rival no está inscrito en esta pirámide'; END IF;
  IF v_challenged_pos.status <> 'activo' THEN
    RAISE EXCEPTION 'El rival está % en la pirámide', v_challenged_pos.status;
  END IF;
  IF v_challenged_pos.position >= v_challenger_pos.position THEN
    RAISE EXCEPTION 'Solo puedes desafiar a jugadores en mejor posición';
  END IF;
  IF (v_challenger_pos.position - v_challenged_pos.position) > v_ladder.max_position_jump THEN
    RAISE EXCEPTION 'Máximo % puestos de salto.', v_ladder.max_position_jump;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ladder_challenges
    WHERE ladder_id = _ladder_id
      AND status IN ('propuesto','aceptado','programado')
      AND (
        (challenger_user_id = v_user_id AND challenged_user_id = _challenged_user_id)
        OR (challenger_user_id = _challenged_user_id AND challenged_user_id = v_user_id)
      )
  ) THEN
    RAISE EXCEPTION 'Ya existe un desafío activo entre ustedes';
  END IF;

  SELECT MAX(played_at) INTO v_last_match
  FROM public.ladder_challenges
  WHERE ladder_id = _ladder_id AND status='jugado' AND played_at IS NOT NULL
    AND (
      (challenger_user_id = v_user_id AND challenged_user_id = _challenged_user_id)
      OR (challenger_user_id = _challenged_user_id AND challenged_user_id = v_user_id)
    );
  IF v_last_match IS NOT NULL AND v_last_match > (now() - (v_ladder.cooldown_days || ' days')::interval) THEN
    RAISE EXCEPTION 'Debes esperar % días entre desafíos al mismo jugador', v_ladder.cooldown_days;
  END IF;

  v_starts1 := (_slots->0->>'starts_at')::timestamptz;
  v_court1  := NULLIF(_slots->0->>'court_id','')::uuid;
  v_starts2 := (_slots->1->>'starts_at')::timestamptz;
  v_court2  := NULLIF(_slots->1->>'court_id','')::uuid;
  v_starts3 := (_slots->2->>'starts_at')::timestamptz;
  v_court3  := NULLIF(_slots->2->>'court_id','')::uuid;

  v_min_at := now() + interval '1 hour';
  v_max_at := now() + (v_ladder.challenge_window_days || ' days')::interval;
  IF v_starts1 < v_min_at OR v_starts2 < v_min_at OR v_starts3 < v_min_at THEN
    RAISE EXCEPTION 'Los horarios deben ser al menos 1 hora en el futuro';
  END IF;
  IF v_starts1 > v_max_at OR v_starts2 > v_max_at OR v_starts3 > v_max_at THEN
    RAISE EXCEPTION 'Los horarios deben estar dentro de la ventana del desafío (% días)', v_ladder.challenge_window_days;
  END IF;
  IF v_starts1 = v_starts2 OR v_starts1 = v_starts3 OR v_starts2 = v_starts3 THEN
    RAISE EXCEPTION 'Los 3 horarios deben ser distintos';
  END IF;

  INSERT INTO public.ladder_challenges (
    tenant_id, ladder_id,
    challenger_user_id, challenged_user_id,
    challenger_position, challenged_position,
    challenger_partner_user_id,
    status, expires_at
  ) VALUES (
    v_ladder.tenant_id, _ladder_id,
    v_user_id, _challenged_user_id,
    v_challenger_pos.position, v_challenged_pos.position,
    _challenger_partner_user_id,
    'propuesto'::ladder_challenge_status,
    now() + (v_ladder.response_window_hours || ' hours')::interval
  )
  RETURNING * INTO v_challenge;

  INSERT INTO public.ladder_challenge_schedule_proposals (
    tenant_id, challenge_id, proposed_by,
    slot1_starts_at, slot1_court_id,
    slot2_starts_at, slot2_court_id,
    slot3_starts_at, slot3_court_id,
    status
  ) VALUES (
    v_ladder.tenant_id, v_challenge.id, v_user_id,
    v_starts1, v_court1,
    v_starts2, v_court2,
    v_starts3, v_court3,
    'pendiente'
  );

  RETURN v_challenge;
END;
$function$;

-- 3) confirm_ladder_challenge_slot acepta compañero del retado (obligatorio en padel_dobles)
CREATE OR REPLACE FUNCTION public.confirm_ladder_challenge_slot(
  _proposal_id uuid,
  _slot_index smallint,
  _challenged_partner_user_id uuid DEFAULT NULL
)
RETURNS ladder_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_proposal public.ladder_challenge_schedule_proposals%ROWTYPE;
  v_challenge public.ladder_challenges%ROWTYPE;
  v_ladder public.ladders%ROWTYPE;
  v_starts_at timestamptz;
  v_court_id uuid;
  v_result public.ladder_challenges;
  v_is_padel boolean;
  v_partner_pos public.ladder_positions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_proposal FROM public.ladder_challenge_schedule_proposals WHERE id = _proposal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Propuesta no encontrada'; END IF;
  IF v_proposal.status <> 'pendiente' THEN RAISE EXCEPTION 'La propuesta ya fue procesada'; END IF;

  SELECT * INTO v_challenge FROM public.ladder_challenges WHERE id = v_proposal.challenge_id FOR UPDATE;
  IF v_user_id <> v_challenge.challenged_user_id THEN
    RAISE EXCEPTION 'Solo el rival puede elegir un horario';
  END IF;
  IF v_challenge.status NOT IN ('propuesto') THEN
    RAISE EXCEPTION 'El desafío ya no está pendiente de respuesta';
  END IF;

  SELECT * INTO v_ladder FROM public.ladders WHERE id = v_challenge.ladder_id;
  v_is_padel := (v_ladder.discipline::text = 'padel_dobles');

  IF v_is_padel THEN
    IF _challenged_partner_user_id IS NULL THEN
      RAISE EXCEPTION 'Debes elegir un compañero para aceptar el desafío de pádel';
    END IF;
    IF _challenged_partner_user_id IN (
      v_challenge.challenger_user_id,
      v_challenge.challenged_user_id,
      COALESCE(v_challenge.challenger_partner_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Tu compañero no puede ser otro jugador del desafío';
    END IF;
    SELECT * INTO v_partner_pos FROM public.ladder_positions
      WHERE ladder_id = v_challenge.ladder_id AND user_id = _challenged_partner_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Tu compañero no está inscrito en esta pirámide'; END IF;
    IF v_partner_pos.status <> 'activo' THEN
      RAISE EXCEPTION 'Tu compañero está % en la pirámide', v_partner_pos.status;
    END IF;

    UPDATE public.ladder_challenges
       SET challenged_partner_user_id = _challenged_partner_user_id,
           updated_at = now()
     WHERE id = v_challenge.id;
    v_challenge.challenged_partner_user_id := _challenged_partner_user_id;
  END IF;

  IF _slot_index = 1 THEN
    v_starts_at := v_proposal.slot1_starts_at;
    v_court_id  := v_proposal.slot1_court_id;
  ELSIF _slot_index = 2 THEN
    v_starts_at := v_proposal.slot2_starts_at;
    v_court_id  := v_proposal.slot2_court_id;
  ELSIF _slot_index = 3 THEN
    v_starts_at := v_proposal.slot3_starts_at;
    v_court_id  := v_proposal.slot3_court_id;
  ELSE
    RAISE EXCEPTION 'Slot inválido';
  END IF;

  IF v_starts_at IS NULL THEN RAISE EXCEPTION 'Ese slot no existe'; END IF;

  -- Verificar cancha sigue libre, sino reasignar
  IF v_court_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.court_id = v_court_id
      AND b.status = 'confirmada'
      AND b.starts_at < v_starts_at + interval '90 minutes'
      AND b.ends_at > v_starts_at
  ) THEN
    v_court_id := public.find_free_court_for_slot(
      v_challenge.tenant_id,
      (SELECT surface FROM public.ladders WHERE id = v_challenge.ladder_id),
      v_starts_at, 90
    );
    IF v_court_id IS NULL THEN
      RAISE EXCEPTION 'Esa cancha ya no está disponible y no hay otra libre';
    END IF;
  END IF;

  v_result := public.schedule_ladder_match(v_proposal.challenge_id, v_court_id, v_starts_at);

  IF v_result.booking_id IS NOT NULL THEN
    UPDATE public.bookings
       SET partner_user_id = CASE
             WHEN v_user_id = v_challenge.challenger_user_id THEN v_challenge.challenged_user_id
             ELSE v_challenge.challenger_user_id
           END,
           notes = CASE WHEN v_is_padel
             THEN 'Pirámide pádel: desafío programado (pareja vs pareja)'
             ELSE 'Pirámide: desafío programado'
           END
     WHERE id = v_result.booking_id;
  END IF;

  UPDATE public.ladder_challenge_schedule_proposals
     SET selected_slot = _slot_index,
         selected_at = now(),
         selected_by = v_user_id,
         status = 'confirmada',
         updated_at = now()
   WHERE id = _proposal_id;

  RETURN v_result;
END;
$function$;

-- 4) Trigger de rating: mapea padel_dobles y aplica ELO a las 2 parejas
CREATE OR REPLACE FUNCTION public._tg_rating_on_ladder_challenge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ladder public.ladders%ROWTYPE;
  v_sport public.rating_sport;
  v_winner_side_main uuid;
  v_loser_side_main uuid;
  v_winner_side_partner uuid;
  v_loser_side_partner uuid;
  v_winners uuid[];
  v_losers uuid[];
BEGIN
  IF NEW.status <> 'jugado' THEN RETURN NEW; END IF;
  IF OLD.status = 'jugado' THEN RETURN NEW; END IF;
  IF NEW.walkover THEN RETURN NEW; END IF;
  IF NEW.winner_user_id IS NULL OR NEW.loser_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_ladder FROM public.ladders WHERE id = NEW.ladder_id;
  v_sport := CASE v_ladder.discipline::text
    WHEN 'tenis_singles' THEN 'tenis_singles'::public.rating_sport
    WHEN 'tenis_dobles'  THEN 'tenis_dobles'::public.rating_sport
    WHEN 'padel_dobles'  THEN 'padel'::public.rating_sport
    ELSE 'tenis_singles'::public.rating_sport
  END;

  -- Determinar el lado ganador (challenger o challenged) y sus compañeros
  IF NEW.winner_user_id = NEW.challenger_user_id THEN
    v_winner_side_main := NEW.challenger_user_id;
    v_winner_side_partner := NEW.challenger_partner_user_id;
    v_loser_side_main := NEW.challenged_user_id;
    v_loser_side_partner := NEW.challenged_partner_user_id;
  ELSE
    v_winner_side_main := NEW.challenged_user_id;
    v_winner_side_partner := NEW.challenged_partner_user_id;
    v_loser_side_main := NEW.challenger_user_id;
    v_loser_side_partner := NEW.challenger_partner_user_id;
  END IF;

  v_winners := ARRAY[v_winner_side_main];
  IF v_winner_side_partner IS NOT NULL THEN
    v_winners := v_winners || v_winner_side_partner;
  END IF;
  v_losers := ARRAY[v_loser_side_main];
  IF v_loser_side_partner IS NOT NULL THEN
    v_losers := v_losers || v_loser_side_partner;
  END IF;

  PERFORM public._apply_rating_for_match(
    v_winners,
    v_losers,
    v_sport,
    'ladder_challenge'::public.rating_change_source,
    NEW.id,
    CASE WHEN array_length(v_winners,1) = 2 THEN 'Ladder padel result' ELSE 'Ladder challenge result' END
  );

  RETURN NEW;
END;
$function$;

-- 5) submit_ladder_result: permitir que cualquiera de los 4 (pádel) reporte; ganador puede ser cualquier integrante (normalizamos al "main")
CREATE OR REPLACE FUNCTION public.submit_ladder_result(
  _challenge_id uuid,
  _winner_user_id uuid,
  _score jsonb DEFAULT NULL::jsonb,
  _retired boolean DEFAULT false,
  _walkover boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_challenge ladder_challenges%ROWTYPE;
  v_ladder ladders%ROWTYPE;
  v_user uuid := auth.uid();
  v_is_admin boolean;
  v_is_party boolean;
  v_now timestamptz := now();
  v_result jsonb;
  v_loser_user uuid;
  v_winner_main uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_challenge FROM ladder_challenges WHERE id = _challenge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Desafío no encontrado';
  END IF;

  IF v_challenge.status NOT IN ('aceptado', 'programado') THEN
    RAISE EXCEPTION 'El desafío no está en un estado válido para registrar resultado (estado: %)', v_challenge.status;
  END IF;

  -- Normalizar: el ganador puede llegar como compañero; lo mapeamos al "main" de su lado
  IF _winner_user_id IN (v_challenge.challenger_user_id, v_challenge.challenger_partner_user_id) THEN
    v_winner_main := v_challenge.challenger_user_id;
    v_loser_user  := v_challenge.challenged_user_id;
  ELSIF _winner_user_id IN (v_challenge.challenged_user_id, v_challenge.challenged_partner_user_id) THEN
    v_winner_main := v_challenge.challenged_user_id;
    v_loser_user  := v_challenge.challenger_user_id;
  ELSE
    RAISE EXCEPTION 'El ganador debe ser uno de los jugadores del desafío';
  END IF;

  SELECT * INTO v_ladder FROM ladders WHERE id = v_challenge.ladder_id;

  v_is_admin := is_club_admin_of(v_user, v_challenge.tenant_id);
  v_is_party := (v_user IN (
    v_challenge.challenger_user_id,
    v_challenge.challenged_user_id,
    COALESCE(v_challenge.challenger_partner_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(v_challenge.challenged_partner_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ));

  IF NOT v_is_admin AND NOT v_is_party THEN
    RAISE EXCEPTION 'No tienes permiso para registrar resultado en este desafío';
  END IF;

  -- Modo solo_admin
  IF v_ladder.result_validation_mode = 'solo_admin' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Solo un administrador puede registrar el resultado';
    END IF;

    UPDATE ladder_challenges
       SET winner_user_id = v_winner_main,
           loser_user_id = v_loser_user,
           score = _score,
           retired = _retired,
           walkover = _walkover,
           played_at = COALESCE(scheduled_at, v_now),
           status = 'jugado',
           result_confirmed_at = v_now,
           updated_at = v_now
     WHERE id = _challenge_id;

    PERFORM public._apply_ladder_result(_challenge_id);

    RETURN jsonb_build_object('status','jugado','requires_confirmation', false);
  END IF;

  -- Modo jugadores_con_confirmacion: el primero propone, el oponente confirma
  IF v_challenge.result_proposed_at IS NULL OR v_challenge.result_proposed_by IS NULL THEN
    UPDATE ladder_challenges
       SET winner_user_id = v_winner_main,
           loser_user_id = v_loser_user,
           score = _score,
           retired = _retired,
           walkover = _walkover,
           result_proposed_by = v_user,
           result_proposed_at = v_now,
           updated_at = v_now
     WHERE id = _challenge_id;

    RETURN jsonb_build_object('status','propuesto','requires_confirmation', true);
  END IF;

  -- Ya hay propuesta: el confirmador debe ser del lado opuesto al que propuso
  -- Si el actual usuario propuso, solo está actualizando (re-propose)
  IF v_challenge.result_proposed_by = v_user THEN
    UPDATE ladder_challenges
       SET winner_user_id = v_winner_main,
           loser_user_id = v_loser_user,
           score = _score,
           retired = _retired,
           walkover = _walkover,
           updated_at = v_now
     WHERE id = _challenge_id;
    RETURN jsonb_build_object('status','propuesto','requires_confirmation', true);
  END IF;

  -- Confirmación válida: actualiza y aplica
  UPDATE ladder_challenges
     SET winner_user_id = v_winner_main,
         loser_user_id = v_loser_user,
         score = _score,
         retired = _retired,
         walkover = _walkover,
         played_at = COALESCE(scheduled_at, v_now),
         status = 'jugado',
         result_confirmed_at = v_now,
         updated_at = v_now
   WHERE id = _challenge_id;

  PERFORM public._apply_ladder_result(_challenge_id);

  RETURN jsonb_build_object('status','jugado','requires_confirmation', false);
END;
$function$;
