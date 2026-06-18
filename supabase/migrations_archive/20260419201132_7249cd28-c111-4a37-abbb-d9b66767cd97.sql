-- ============================================================================
-- S4: RPCs PRINCIPALES DEL LADDER
-- ============================================================================

-- ----------------------------------------------------------------------------
-- join_ladder: el socio entra al final de la pirámide
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_ladder(_ladder_id UUID)
RETURNS public.ladder_positions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_ladder public.ladders%ROWTYPE;
  v_dues public.dues_status;
  v_next_position INTEGER;
  v_position public.ladder_positions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_ladder FROM public.ladders WHERE id = _ladder_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La pirámide no existe'; END IF;
  IF NOT v_ladder.is_active THEN RAISE EXCEPTION 'La pirámide no está activa'; END IF;

  IF public.user_tenant_id(v_user_id) <> v_ladder.tenant_id THEN
    RAISE EXCEPTION 'No puedes unirte a pirámides de otro club';
  END IF;

  SELECT dues_status INTO v_dues FROM public.profiles WHERE user_id = v_user_id;
  IF v_dues IN ('moroso','suspendido') THEN
    RAISE EXCEPTION 'No puedes unirte: cuotas %', v_dues;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ladder_positions
    WHERE ladder_id = _ladder_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Ya estás inscrito en esta pirámide';
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1 INTO v_next_position
  FROM public.ladder_positions
  WHERE ladder_id = _ladder_id;

  INSERT INTO public.ladder_positions (
    ladder_id, tenant_id, user_id, position, status
  ) VALUES (
    _ladder_id, v_ladder.tenant_id, v_user_id, v_next_position, 'activo'
  ) RETURNING * INTO v_position;

  INSERT INTO public.ladder_history (
    ladder_id, tenant_id, user_id, position_before, position_after, reason, recorded_by
  ) VALUES (
    _ladder_id, v_ladder.tenant_id, v_user_id, NULL, v_next_position, 'ingreso', v_user_id
  );

  RETURN v_position;
END;
$$;

-- ----------------------------------------------------------------------------
-- leave_ladder: el socio sale de la pirámide y se reordena
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leave_ladder(_ladder_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_ladder public.ladders%ROWTYPE;
  v_position public.ladder_positions%ROWTYPE;
  v_is_admin BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_ladder FROM public.ladders WHERE id = _ladder_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La pirámide no existe'; END IF;

  SELECT * INTO v_position
  FROM public.ladder_positions
  WHERE ladder_id = _ladder_id AND user_id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No estás inscrito en esta pirámide'; END IF;

  -- Verificar que no tenga desafíos activos
  IF EXISTS (
    SELECT 1 FROM public.ladder_challenges
    WHERE ladder_id = _ladder_id
      AND (challenger_user_id = v_user_id OR challenged_user_id = v_user_id)
      AND status IN ('propuesto','aceptado','programado')
  ) THEN
    RAISE EXCEPTION 'No puedes salir: tienes desafíos activos. Cancélalos primero.';
  END IF;

  -- Eliminar la posición y reordenar (constraint deferrable)
  DELETE FROM public.ladder_positions WHERE id = v_position.id;

  UPDATE public.ladder_positions
  SET position = position - 1
  WHERE ladder_id = _ladder_id AND position > v_position.position;

  INSERT INTO public.ladder_history (
    ladder_id, tenant_id, user_id, position_before, position_after, reason, recorded_by
  ) VALUES (
    _ladder_id, v_ladder.tenant_id, v_user_id, v_position.position, NULL, 'retiro', v_user_id
  );

  RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- create_ladder_challenge: el retador propone un desafío
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_ladder_challenge(
  _ladder_id UUID,
  _challenged_user_id UUID
)
RETURNS public.ladder_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_ladder public.ladders%ROWTYPE;
  v_challenger_pos public.ladder_positions%ROWTYPE;
  v_challenged_pos public.ladder_positions%ROWTYPE;
  v_dues public.dues_status;
  v_last_match TIMESTAMPTZ;
  v_challenge public.ladder_challenges%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _challenged_user_id = v_user_id THEN
    RAISE EXCEPTION 'No puedes desafiarte a ti mismo';
  END IF;

  SELECT * INTO v_ladder FROM public.ladders WHERE id = _ladder_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La pirámide no existe'; END IF;
  IF NOT v_ladder.is_active THEN RAISE EXCEPTION 'La pirámide no está activa'; END IF;

  -- Cuotas del retador
  SELECT dues_status INTO v_dues FROM public.profiles WHERE user_id = v_user_id;
  IF v_dues IN ('moroso','suspendido') THEN
    RAISE EXCEPTION 'No puedes desafiar: cuotas %', v_dues;
  END IF;

  -- Posiciones
  SELECT * INTO v_challenger_pos
  FROM public.ladder_positions
  WHERE ladder_id = _ladder_id AND user_id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No estás inscrito en esta pirámide'; END IF;
  IF v_challenger_pos.status <> 'activo' THEN
    RAISE EXCEPTION 'Tu posición está % en la pirámide', v_challenger_pos.status;
  END IF;

  SELECT * INTO v_challenged_pos
  FROM public.ladder_positions
  WHERE ladder_id = _ladder_id AND user_id = _challenged_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El rival no está inscrito en esta pirámide'; END IF;
  IF v_challenged_pos.status <> 'activo' THEN
    RAISE EXCEPTION 'El rival está % en la pirámide', v_challenged_pos.status;
  END IF;

  -- Solo se desafía hacia arriba (posición menor = mejor rank)
  IF v_challenged_pos.position >= v_challenger_pos.position THEN
    RAISE EXCEPTION 'Solo puedes desafiar a jugadores en mejor posición';
  END IF;

  -- Salto máximo permitido
  IF (v_challenger_pos.position - v_challenged_pos.position) > v_ladder.max_position_jump THEN
    RAISE EXCEPTION 'Máximo % puestos de salto. El rival está a % puestos arriba.',
      v_ladder.max_position_jump,
      (v_challenger_pos.position - v_challenged_pos.position);
  END IF;

  -- Sin desafíos activos entre el mismo par
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

  -- Cooldown: tiempo desde el último partido jugado entre el par
  SELECT MAX(played_at) INTO v_last_match
  FROM public.ladder_challenges
  WHERE ladder_id = _ladder_id
    AND status = 'jugado'
    AND played_at IS NOT NULL
    AND (
      (challenger_user_id = v_user_id AND challenged_user_id = _challenged_user_id)
      OR (challenger_user_id = _challenged_user_id AND challenged_user_id = v_user_id)
    );

  IF v_last_match IS NOT NULL
     AND v_last_match + (v_ladder.cooldown_days || ' days')::INTERVAL > now() THEN
    RAISE EXCEPTION 'Debes esperar % días entre desafíos al mismo rival. Disponible desde: %',
      v_ladder.cooldown_days,
      to_char(v_last_match + (v_ladder.cooldown_days || ' days')::INTERVAL, 'DD-MM-YYYY HH24:MI');
  END IF;

  INSERT INTO public.ladder_challenges (
    ladder_id, tenant_id,
    challenger_user_id, challenged_user_id,
    challenger_position, challenged_position,
    status, expires_at
  ) VALUES (
    _ladder_id, v_ladder.tenant_id,
    v_user_id, _challenged_user_id,
    v_challenger_pos.position, v_challenged_pos.position,
    'propuesto',
    now() + (v_ladder.response_window_hours || ' hours')::INTERVAL
  ) RETURNING * INTO v_challenge;

  -- Marcar último intento de desafío
  UPDATE public.ladder_positions
  SET last_challenged_at = now()
  WHERE id = v_challenger_pos.id;

  RETURN v_challenge;
END;
$$;

-- ----------------------------------------------------------------------------
-- respond_ladder_challenge: el desafiado acepta o rechaza
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_ladder_challenge(
  _challenge_id UUID,
  _accept BOOLEAN,
  _reason TEXT DEFAULT NULL
)
RETURNS public.ladder_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_challenge public.ladder_challenges%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_challenge FROM public.ladder_challenges WHERE id = _challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Desafío no encontrado'; END IF;
  IF v_challenge.challenged_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Solo el desafiado puede responder';
  END IF;
  IF v_challenge.status <> 'propuesto' THEN
    RAISE EXCEPTION 'El desafío ya no está pendiente (estado: %)', v_challenge.status;
  END IF;
  IF v_challenge.expires_at < now() THEN
    -- Marcar expirado en pasada
    UPDATE public.ladder_challenges
    SET status = 'expirado', responded_at = now()
    WHERE id = _challenge_id;
    RAISE EXCEPTION 'El desafío expiró';
  END IF;

  UPDATE public.ladder_challenges
  SET status = CASE WHEN _accept THEN 'aceptado'::ladder_challenge_status ELSE 'rechazado'::ladder_challenge_status END,
      responded_at = now(),
      reject_reason = CASE WHEN _accept THEN NULL ELSE _reason END
  WHERE id = _challenge_id
  RETURNING * INTO v_challenge;

  RETURN v_challenge;
END;
$$;

-- ----------------------------------------------------------------------------
-- schedule_ladder_match: programa el partido y crea el booking
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.schedule_ladder_match(
  _challenge_id UUID,
  _court_id UUID,
  _starts_at TIMESTAMPTZ
)
RETURNS public.ladder_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_challenge public.ladder_challenges%ROWTYPE;
  v_court public.courts%ROWTYPE;
  v_ends_at TIMESTAMPTZ;
  v_booking public.bookings%ROWTYPE;
  v_conflict BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_challenge FROM public.ladder_challenges WHERE id = _challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Desafío no encontrado'; END IF;

  IF v_user_id NOT IN (v_challenge.challenger_user_id, v_challenge.challenged_user_id)
     AND NOT public.is_club_admin_of(v_user_id, v_challenge.tenant_id) THEN
    RAISE EXCEPTION 'Solo los jugadores o un admin pueden programar';
  END IF;

  IF v_challenge.status NOT IN ('aceptado','programado') THEN
    RAISE EXCEPTION 'El desafío debe estar aceptado para programarse (estado: %)', v_challenge.status;
  END IF;

  IF _starts_at < now() THEN
    RAISE EXCEPTION 'No puedes programar en el pasado';
  END IF;

  SELECT * INTO v_court FROM public.courts WHERE id = _court_id;
  IF NOT FOUND OR v_court.tenant_id <> v_challenge.tenant_id THEN
    RAISE EXCEPTION 'Cancha inválida';
  END IF;
  IF NOT v_court.is_active THEN
    RAISE EXCEPTION 'La cancha no está activa';
  END IF;

  v_ends_at := _starts_at + (v_court.slot_minutes || ' minutes')::INTERVAL;

  -- Verificar disponibilidad (excluyendo el booking actual del challenge si existe)
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE court_id = _court_id
      AND status = 'confirmada'
      AND id <> COALESCE(v_challenge.booking_id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(_starts_at, v_ends_at, '[)')
  ) INTO v_conflict;
  IF v_conflict THEN
    RAISE EXCEPTION 'La cancha ya está reservada en ese horario';
  END IF;

  -- Cancelar booking previo si existe (reagendamiento)
  IF v_challenge.booking_id IS NOT NULL THEN
    UPDATE public.bookings
      SET status = 'cancelada', cancelled_at = now(), cancelled_by = v_user_id
      WHERE id = v_challenge.booking_id;
  END IF;

  BEGIN
    INSERT INTO public.bookings (
      tenant_id, court_id, user_id, starts_at, ends_at, notes
    ) VALUES (
      v_challenge.tenant_id, _court_id, v_user_id,
      _starts_at, v_ends_at,
      'Ladder: desafío programado'
    ) RETURNING * INTO v_booking;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'La cancha ya no está disponible';
  END;

  UPDATE public.ladder_challenges
  SET status = 'programado',
      scheduled_at = _starts_at,
      court_id = _court_id,
      booking_id = v_booking.id
  WHERE id = _challenge_id
  RETURNING * INTO v_challenge;

  RETURN v_challenge;
END;
$$;
