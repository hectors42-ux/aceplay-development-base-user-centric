-- ============================================================
-- Pirámide: nuevo flujo de desafío con propuesta de 3 horarios
-- y auto-asignación de cancha por superficie.
-- ============================================================

-- 1) Tabla de notificaciones persistentes (borrables por el usuario)
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  ref_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user
  ON public.user_notifications (user_id, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario ve sus notificaciones" ON public.user_notifications;
CREATE POLICY "Usuario ve sus notificaciones"
  ON public.user_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuario borra sus notificaciones" ON public.user_notifications;
CREATE POLICY "Usuario borra sus notificaciones"
  ON public.user_notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuario actualiza sus notificaciones" ON public.user_notifications;
CREATE POLICY "Usuario actualiza sus notificaciones"
  ON public.user_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- 2) Helper: encuentra una cancha libre del tenant + superficie
--    para una ventana [_starts_at, _starts_at + _duration_minutes)
CREATE OR REPLACE FUNCTION public.find_free_court_for_slot(
  _tenant_id UUID,
  _surface court_surface,
  _starts_at TIMESTAMPTZ,
  _duration_minutes INT DEFAULT 90
) RETURNS UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ends_at TIMESTAMPTZ := _starts_at + (_duration_minutes || ' minutes')::INTERVAL;
  v_court_id UUID;
BEGIN
  SELECT c.id INTO v_court_id
  FROM public.courts c
  WHERE c.tenant_id = _tenant_id
    AND c.is_active = true
    AND c.surface = _surface
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.court_id = c.id
        AND b.status <> 'cancelada'
        AND b.starts_at < v_ends_at
        AND b.ends_at > _starts_at
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.coach_class_bookings ccb
      WHERE ccb.court_id = c.id
        AND ccb.status NOT IN ('cancelada')
        AND ccb.starts_at < v_ends_at
        AND ccb.ends_at > _starts_at
    )
  ORDER BY c.sort_order ASC, c.name ASC
  LIMIT 1;

  RETURN v_court_id;
END;
$$;

-- 3) Crear desafío + propuesta de 3 horarios en un único paso, atómico.
CREATE OR REPLACE FUNCTION public.create_ladder_challenge_with_slots(
  _ladder_id UUID,
  _challenged_user_id UUID,
  _slots JSONB
) RETURNS public.ladder_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_ladder public.ladders%ROWTYPE;
  v_challenger_pos public.ladder_positions%ROWTYPE;
  v_challenged_pos public.ladder_positions%ROWTYPE;
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
  IF v_last_match IS NOT NULL
     AND v_last_match + (v_ladder.cooldown_days || ' days')::INTERVAL > now() THEN
    RAISE EXCEPTION 'Cooldown activo: espera % días entre desafíos al mismo rival',
      v_ladder.cooldown_days;
  END IF;

  -- Validar y asignar canchas a los 3 horarios
  v_min_at := now() + INTERVAL '1 hour';
  v_max_at := now() + (v_ladder.response_window_hours || ' hours')::INTERVAL
                    + (v_ladder.challenge_window_days || ' days')::INTERVAL;

  v_starts1 := (_slots->0->>'starts_at')::TIMESTAMPTZ;
  v_starts2 := (_slots->1->>'starts_at')::TIMESTAMPTZ;
  v_starts3 := (_slots->2->>'starts_at')::TIMESTAMPTZ;

  IF v_starts1 IS NULL OR v_starts2 IS NULL OR v_starts3 IS NULL THEN
    RAISE EXCEPTION 'Cada horario debe incluir starts_at';
  END IF;

  IF v_starts1 < v_min_at OR v_starts2 < v_min_at OR v_starts3 < v_min_at THEN
    RAISE EXCEPTION 'Los horarios deben ser al menos 1 hora en el futuro';
  END IF;
  IF v_starts1 > v_max_at OR v_starts2 > v_max_at OR v_starts3 > v_max_at THEN
    RAISE EXCEPTION 'Los horarios exceden la ventana permitida';
  END IF;

  v_court1 := public.find_free_court_for_slot(v_ladder.tenant_id, v_ladder.surface, v_starts1, 90);
  IF v_court1 IS NULL THEN RAISE EXCEPTION 'Sin cancha disponible para el horario 1'; END IF;
  v_court2 := public.find_free_court_for_slot(v_ladder.tenant_id, v_ladder.surface, v_starts2, 90);
  IF v_court2 IS NULL THEN RAISE EXCEPTION 'Sin cancha disponible para el horario 2'; END IF;
  v_court3 := public.find_free_court_for_slot(v_ladder.tenant_id, v_ladder.surface, v_starts3, 90);
  IF v_court3 IS NULL THEN RAISE EXCEPTION 'Sin cancha disponible para el horario 3'; END IF;

  -- Crear desafío directamente en estado 'aceptado' para que el rival pueda elegir slot.
  INSERT INTO public.ladder_challenges (
    ladder_id, tenant_id,
    challenger_user_id, challenged_user_id,
    challenger_position, challenged_position,
    status, expires_at
  ) VALUES (
    _ladder_id, v_ladder.tenant_id,
    v_user_id, _challenged_user_id,
    v_challenger_pos.position, v_challenged_pos.position,
    'aceptado',
    now() + (v_ladder.response_window_hours || ' hours')::INTERVAL
  ) RETURNING * INTO v_challenge;

  INSERT INTO public.ladder_challenge_schedule_proposals (
    challenge_id, tenant_id, proposed_by,
    slot1_court_id, slot1_starts_at,
    slot2_court_id, slot2_starts_at,
    slot3_court_id, slot3_starts_at,
    status
  ) VALUES (
    v_challenge.id, v_ladder.tenant_id, v_user_id,
    v_court1, v_starts1,
    v_court2, v_starts2,
    v_court3, v_starts3,
    'pendiente'
  );

  UPDATE public.ladder_positions
    SET last_challenged_at = now()
    WHERE id = v_challenger_pos.id;

  RETURN v_challenge;
END;
$$;

-- 4) Permitir que el RIVAL (challenged) confirme el slot (antes solo challenger).
CREATE OR REPLACE FUNCTION public.confirm_ladder_challenge_slot(
  _proposal_id UUID,
  _slot_index SMALLINT
) RETURNS public.ladder_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_proposal public.ladder_challenge_schedule_proposals%ROWTYPE;
  v_challenge public.ladder_challenges%ROWTYPE;
  v_court_id UUID;
  v_starts_at TIMESTAMPTZ;
  v_result public.ladder_challenges%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _slot_index NOT IN (1,2,3) THEN RAISE EXCEPTION 'Slot inválido'; END IF;

  SELECT * INTO v_proposal FROM public.ladder_challenge_schedule_proposals WHERE id = _proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Propuesta no encontrada'; END IF;
  IF v_proposal.status <> 'pendiente' THEN
    RAISE EXCEPTION 'La propuesta ya no está activa (estado: %)', v_proposal.status;
  END IF;

  SELECT * INTO v_challenge FROM public.ladder_challenges WHERE id = v_proposal.challenge_id;

  -- Quien NO propuso es quien debe elegir
  IF v_user_id = v_proposal.proposed_by THEN
    RAISE EXCEPTION 'Tu rival debe elegir el horario';
  END IF;
  IF v_user_id NOT IN (v_challenge.challenger_user_id, v_challenge.challenged_user_id) THEN
    RAISE EXCEPTION 'No participas en este desafío';
  END IF;

  IF _slot_index = 1 THEN v_court_id := v_proposal.slot1_court_id; v_starts_at := v_proposal.slot1_starts_at;
  ELSIF _slot_index = 2 THEN v_court_id := v_proposal.slot2_court_id; v_starts_at := v_proposal.slot2_starts_at;
  ELSE v_court_id := v_proposal.slot3_court_id; v_starts_at := v_proposal.slot3_starts_at;
  END IF;
  IF v_court_id IS NULL OR v_starts_at IS NULL THEN
    RAISE EXCEPTION 'Ese slot no existe en la propuesta';
  END IF;

  -- Re-chequear que la cancha siga libre justo antes de reservar.
  IF EXISTS (
    SELECT 1 FROM public.bookings b
     WHERE b.court_id = v_court_id
       AND b.status <> 'cancelada'
       AND b.starts_at < v_starts_at + INTERVAL '90 minutes'
       AND b.ends_at > v_starts_at
  ) THEN
    -- Reasignar a otra cancha si hay
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
           notes = 'Pirámide: desafío programado'
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
$$;

-- 5) Expiración: borrar challenge + propuesta y notificar a ambos
CREATE OR REPLACE FUNCTION public.process_ladder_expirations_run()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ch RECORD;
  _challenger_name TEXT;
  _challenged_name TEXT;
  _ladder_name TEXT;
  _expired INT := 0;
BEGIN
  FOR _ch IN
    SELECT * FROM public.ladder_challenges
    WHERE status IN ('propuesto','aceptado')
      AND expires_at < now()
  LOOP
    SELECT (first_name || ' ' || last_name) INTO _challenger_name
      FROM public.profiles WHERE user_id = _ch.challenger_user_id;
    SELECT (first_name || ' ' || last_name) INTO _challenged_name
      FROM public.profiles WHERE user_id = _ch.challenged_user_id;
    SELECT name INTO _ladder_name FROM public.ladders WHERE id = _ch.ladder_id;

    INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, description, link, ref_id)
    VALUES
      (_ch.tenant_id, _ch.challenger_user_id, 'challenge_expired',
       'Tu desafío expiró',
       COALESCE(_challenged_name, 'Tu rival') || ' no respondió a tiempo en ' || COALESCE(_ladder_name, 'la pirámide'),
       '/ranking?tab=piramide', _ch.id),
      (_ch.tenant_id, _ch.challenged_user_id, 'challenge_expired',
       'Un desafío expiró',
       'No alcanzaste a responder el desafío de ' || COALESCE(_challenger_name, 'un jugador') || ' en ' || COALESCE(_ladder_name, 'la pirámide'),
       '/ranking?tab=piramide', _ch.id);

    DELETE FROM public.ladder_challenge_schedule_proposals WHERE challenge_id = _ch.id;
    DELETE FROM public.ladder_challenges WHERE id = _ch.id;

    _expired := _expired + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'expired_deleted', _expired,
    'ran_at', now()
  );
END;
$$;

-- 6) Extender notifications_feed para incluir las notificaciones persistentes
CREATE OR REPLACE FUNCTION public.notifications_feed()
RETURNS TABLE(kind text, ref_id uuid, title text, description text, link text, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;
  v_tenant_id := public.user_tenant_id(v_user_id);

  -- Resultados de torneo propuestos por el rival
  RETURN QUERY
  SELECT 'result_proposal'::TEXT, r.id,
    'Resultado por confirmar'::TEXT,
    ('Tu rival propuso un resultado en ' || COALESCE(t.name, 'un torneo'))::TEXT,
    ('/torneos/' || t.slug || '/cat/' || c.id || '?focus=match&match=' || m.id)::TEXT,
    r.created_at
  FROM public.tournament_match_results r
  JOIN public.tournament_matches m ON m.id = r.match_id
  JOIN public.tournament_categories c ON c.id = m.category_id
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
  JOIN public.tournament_categories c ON c.id = m.category_id
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
  JOIN public.tournament_categories c ON c.id = reg.category_id
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

  -- Ladder: desafío recibido (propuesto, soy el desafiado)
  RETURN QUERY
  SELECT 'ladder_challenge'::TEXT, lc.id,
    'Desafío recibido'::TEXT,
    ('Te retaron en ' || COALESCE(l.name, 'la pirámide'))::TEXT,
    '/ranking?tab=piramide'::TEXT,
    lc.proposed_at
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.status = 'propuesto' AND lc.challenged_user_id = v_user_id;

  -- Ladder: desafío aceptado, esperar elección de horario por mi parte (soy desafiado y propuesta pendiente)
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

  -- Notificaciones persistentes (incluye challenge_expired)
  RETURN QUERY
  SELECT un.kind, un.ref_id, un.title, COALESCE(un.description,''), COALESCE(un.link,''), un.created_at
  FROM public.user_notifications un
  WHERE un.user_id = v_user_id;
END;
$$;