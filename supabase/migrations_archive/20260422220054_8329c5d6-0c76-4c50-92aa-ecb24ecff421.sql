-- 1. Increase max_position_jump default and update existing ladders
ALTER TABLE public.ladders ALTER COLUMN max_position_jump SET DEFAULT 5;
UPDATE public.ladders SET max_position_jump = 5 WHERE max_position_jump < 5;

-- 2. Schedule proposals table
CREATE TABLE IF NOT EXISTS public.ladder_challenge_schedule_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.ladder_challenges(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  slot1_court_id UUID NOT NULL REFERENCES public.courts(id),
  slot1_starts_at TIMESTAMPTZ NOT NULL,
  slot2_court_id UUID REFERENCES public.courts(id),
  slot2_starts_at TIMESTAMPTZ,
  slot3_court_id UUID REFERENCES public.courts(id),
  slot3_starts_at TIMESTAMPTZ,
  selected_slot SMALLINT CHECK (selected_slot BETWEEN 1 AND 3),
  selected_at TIMESTAMPTZ,
  selected_by UUID,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','confirmada','expirada','cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lcsp_challenge ON public.ladder_challenge_schedule_proposals(challenge_id);
CREATE INDEX IF NOT EXISTS idx_lcsp_status ON public.ladder_challenge_schedule_proposals(status);

ALTER TABLE public.ladder_challenge_schedule_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Socios ven propuestas de horarios de su club"
ON public.ladder_challenge_schedule_proposals
FOR SELECT TO authenticated
USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "club_admin gestiona propuestas de horarios"
ON public.ladder_challenge_schedule_proposals
FOR ALL TO authenticated
USING (is_club_admin_of(auth.uid(), tenant_id))
WITH CHECK (is_club_admin_of(auth.uid(), tenant_id));

CREATE TRIGGER trg_lcsp_updated_at
BEFORE UPDATE ON public.ladder_challenge_schedule_proposals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RPC: propose slots (called by challenged player after accepting)
CREATE OR REPLACE FUNCTION public.propose_ladder_challenge_slots(
  _challenge_id UUID,
  _slots JSONB
)
RETURNS public.ladder_challenge_schedule_proposals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_challenge public.ladder_challenges%ROWTYPE;
  v_ladder public.ladders%ROWTYPE;
  v_proposal public.ladder_challenge_schedule_proposals%ROWTYPE;
  v_slot JSONB;
  v_court_id UUID;
  v_starts_at TIMESTAMPTZ;
  v_court public.courts%ROWTYPE;
  v_ends_at TIMESTAMPTZ;
  v_count INT := 0;
  v_max_at TIMESTAMPTZ;
  v_slot_courts UUID[] := ARRAY[]::UUID[];
  v_slot_starts TIMESTAMPTZ[] := ARRAY[]::TIMESTAMPTZ[];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_challenge FROM public.ladder_challenges WHERE id = _challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Desafío no encontrado'; END IF;

  IF v_user_id <> v_challenge.challenged_user_id THEN
    RAISE EXCEPTION 'Solo el desafiado puede proponer horarios';
  END IF;

  IF v_challenge.status <> 'aceptado' THEN
    RAISE EXCEPTION 'El desafío debe estar aceptado (estado actual: %)', v_challenge.status;
  END IF;

  SELECT * INTO v_ladder FROM public.ladders WHERE id = v_challenge.ladder_id;
  v_max_at := COALESCE(v_challenge.responded_at, now()) + (v_ladder.challenge_window_days || ' days')::INTERVAL;

  -- Cancel previous pending proposals for this challenge
  UPDATE public.ladder_challenge_schedule_proposals
    SET status = 'cancelada', updated_at = now()
    WHERE challenge_id = _challenge_id AND status = 'pendiente';

  IF jsonb_typeof(_slots) <> 'array' OR jsonb_array_length(_slots) < 1 OR jsonb_array_length(_slots) > 3 THEN
    RAISE EXCEPTION 'Debes proponer entre 1 y 3 horarios';
  END IF;

  FOR v_slot IN SELECT * FROM jsonb_array_elements(_slots) LOOP
    v_court_id := (v_slot->>'court_id')::UUID;
    v_starts_at := (v_slot->>'starts_at')::TIMESTAMPTZ;

    IF v_court_id IS NULL OR v_starts_at IS NULL THEN
      RAISE EXCEPTION 'Cada horario requiere court_id y starts_at';
    END IF;
    IF v_starts_at < now() THEN
      RAISE EXCEPTION 'No puedes proponer horarios en el pasado';
    END IF;
    IF v_starts_at > v_max_at THEN
      RAISE EXCEPTION 'El horario % excede la ventana de % días', v_starts_at, v_ladder.challenge_window_days;
    END IF;

    SELECT * INTO v_court FROM public.courts WHERE id = v_court_id;
    IF NOT FOUND OR v_court.tenant_id <> v_challenge.tenant_id OR NOT v_court.is_active THEN
      RAISE EXCEPTION 'Cancha inválida';
    END IF;

    v_ends_at := v_starts_at + (v_court.slot_minutes || ' minutes')::INTERVAL;

    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE court_id = v_court_id
        AND status = 'confirmada'
        AND tstzrange(starts_at, ends_at, '[)') && tstzrange(v_starts_at, v_ends_at, '[)')
    ) THEN
      RAISE EXCEPTION 'La cancha % no está disponible el %', v_court.name, v_starts_at;
    END IF;

    v_count := v_count + 1;
    v_slot_courts := array_append(v_slot_courts, v_court_id);
    v_slot_starts := array_append(v_slot_starts, v_starts_at);
  END LOOP;

  INSERT INTO public.ladder_challenge_schedule_proposals (
    challenge_id, tenant_id, proposed_by,
    slot1_court_id, slot1_starts_at,
    slot2_court_id, slot2_starts_at,
    slot3_court_id, slot3_starts_at,
    status
  ) VALUES (
    _challenge_id, v_challenge.tenant_id, v_user_id,
    v_slot_courts[1], v_slot_starts[1],
    CASE WHEN v_count >= 2 THEN v_slot_courts[2] END,
    CASE WHEN v_count >= 2 THEN v_slot_starts[2] END,
    CASE WHEN v_count >= 3 THEN v_slot_courts[3] END,
    CASE WHEN v_count >= 3 THEN v_slot_starts[3] END,
    'pendiente'
  ) RETURNING * INTO v_proposal;

  RETURN v_proposal;
END;
$$;

-- 4. RPC: confirm slot (called by challenger)
CREATE OR REPLACE FUNCTION public.confirm_ladder_challenge_slot(
  _proposal_id UUID,
  _slot_index SMALLINT
)
RETURNS public.ladder_challenges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  IF v_user_id <> v_challenge.challenger_user_id THEN
    RAISE EXCEPTION 'Solo el desafiante puede confirmar el horario';
  END IF;

  IF _slot_index = 1 THEN v_court_id := v_proposal.slot1_court_id; v_starts_at := v_proposal.slot1_starts_at;
  ELSIF _slot_index = 2 THEN v_court_id := v_proposal.slot2_court_id; v_starts_at := v_proposal.slot2_starts_at;
  ELSE v_court_id := v_proposal.slot3_court_id; v_starts_at := v_proposal.slot3_starts_at;
  END IF;

  IF v_court_id IS NULL OR v_starts_at IS NULL THEN
    RAISE EXCEPTION 'Ese slot no existe en la propuesta';
  END IF;

  -- Schedule via existing RPC logic (inline reservation)
  v_result := public.schedule_ladder_match(v_proposal.challenge_id, v_court_id, v_starts_at);

  -- Mark partner on booking
  IF v_result.booking_id IS NOT NULL THEN
    UPDATE public.bookings
      SET partner_user_id = v_challenge.challenged_user_id,
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

GRANT EXECUTE ON FUNCTION public.propose_ladder_challenge_slots(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_ladder_challenge_slot(UUID, SMALLINT) TO authenticated;

-- 5. Update notifications_feed to include new ladder events
CREATE OR REPLACE FUNCTION public.notifications_feed()
RETURNS TABLE(kind TEXT, ref_id UUID, title TEXT, description TEXT, link TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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

  -- Ladder: rival aceptó, debe proponer horarios (soy desafiante)
  RETURN QUERY
  SELECT 'ladder_challenge_accepted'::TEXT, lc.id,
    'Tu desafío fue aceptado'::TEXT,
    ('Esperando que tu rival proponga horarios en ' || COALESCE(l.name, 'la pirámide'))::TEXT,
    '/ranking?tab=piramide'::TEXT,
    lc.responded_at
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.status = 'aceptado' AND lc.challenger_user_id = v_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.ladder_challenge_schedule_proposals p
      WHERE p.challenge_id = lc.id AND p.status = 'pendiente'
    );

  -- Ladder: rival aceptó, debes proponer horarios (soy desafiado)
  RETURN QUERY
  SELECT 'ladder_propose_slots'::TEXT, lc.id,
    'Propón 3 horarios'::TEXT,
    ('Aceptaste el reto en ' || COALESCE(l.name, 'la pirámide') || ', propón horarios')::TEXT,
    '/ranking?tab=piramide'::TEXT,
    lc.responded_at
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.status = 'aceptado' AND lc.challenged_user_id = v_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.ladder_challenge_schedule_proposals p
      WHERE p.challenge_id = lc.id AND p.status IN ('pendiente','confirmada')
    );

  -- Ladder: el desafiado propuso horarios, soy desafiante y debo elegir
  RETURN QUERY
  SELECT 'ladder_slots_proposed'::TEXT, p.id,
    'Elige uno de los horarios'::TEXT,
    ('Tu rival propuso horarios en ' || COALESCE(l.name, 'la pirámide'))::TEXT,
    '/ranking?tab=piramide'::TEXT,
    p.proposed_at
  FROM public.ladder_challenge_schedule_proposals p
  JOIN public.ladder_challenges lc ON lc.id = p.challenge_id
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE p.status = 'pendiente' AND lc.challenger_user_id = v_user_id;

  -- Ladder: partido programado pero ya pasó, debe cargar resultado
  RETURN QUERY
  SELECT 'ladder_result_pending'::TEXT, lc.id,
    'Cargar resultado'::TEXT,
    ('El partido en ' || COALESCE(l.name, 'la pirámide') || ' ya se jugó')::TEXT,
    '/ranking?tab=piramide'::TEXT,
    lc.scheduled_at
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.status = 'programado'
    AND lc.scheduled_at IS NOT NULL
    AND lc.scheduled_at + INTERVAL '1 hour' < now()
    AND lc.winner_user_id IS NULL
    AND (lc.challenger_user_id = v_user_id OR lc.challenged_user_id = v_user_id);

  -- Ladder: rival propuso resultado, debo confirmarlo
  RETURN QUERY
  SELECT 'ladder_result'::TEXT, lc.id,
    'Confirmar resultado'::TEXT,
    ('Tu rival cargó un resultado en ' || COALESCE(l.name, 'la pirámide'))::TEXT,
    '/ranking?tab=piramide'::TEXT,
    lc.result_proposed_at
  FROM public.ladder_challenges lc
  JOIN public.ladders l ON l.id = lc.ladder_id
  WHERE lc.result_proposed_at IS NOT NULL
    AND lc.result_confirmed_at IS NULL
    AND lc.result_proposed_by IS NOT NULL
    AND lc.result_proposed_by <> v_user_id
    AND (lc.challenger_user_id = v_user_id OR lc.challenged_user_id = v_user_id);

  -- Booking partner (alguien me agregó como pareja)
  RETURN QUERY
  SELECT 'booking_partner'::TEXT, b.id,
    'Reserva con tu nombre'::TEXT,
    ('Te agregaron como pareja en una reserva')::TEXT,
    '/reservar'::TEXT,
    b.created_at
  FROM public.bookings b
  WHERE b.partner_user_id = v_user_id
    AND b.status = 'confirmada'
    AND b.starts_at > now() - INTERVAL '1 hour';

  -- Match acceptance (torneo)
  RETURN QUERY
  SELECT 'match_acceptance'::TEXT, m.id,
    'Confirma el partido'::TEXT,
    ('Tienes un partido programado en ' || COALESCE(t.name, 'un torneo'))::TEXT,
    ('/torneos/' || t.slug || '/cat/' || c.id || '?focus=match&match=' || m.id)::TEXT,
    m.scheduled_at
  FROM public.tournament_matches m
  JOIN public.tournament_categories c ON c.id = m.category_id
  JOIN public.tournaments t ON t.id = m.tournament_id
  WHERE m.scheduled_at IS NOT NULL
    AND m.status = 'pendiente'
    AND (
      (public.is_match_side_a(v_user_id, m.id) AND m.acceptance_a = 'pending')
      OR (public.is_match_side_b(v_user_id, m.id) AND m.acceptance_b = 'pending')
    );

  -- Class invitation (segundo alumno en clase compartida)
  RETURN QUERY
  SELECT 'class_invitation'::TEXT, cb.id,
    'Invitación a clase'::TEXT,
    ('Te invitaron a una clase compartida')::TEXT,
    '/clases'::TEXT,
    cb.created_at
  FROM public.coach_class_bookings cb
  WHERE cb.student2_user_id = v_user_id
    AND cb.status IN ('propuesta','confirmada')
    AND cb.starts_at > now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.notifications_feed() TO authenticated;