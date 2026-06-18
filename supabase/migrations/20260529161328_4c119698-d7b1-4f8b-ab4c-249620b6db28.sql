CREATE OR REPLACE FUNCTION public.confirm_ladder_challenge_slot(_proposal_id uuid, _slot_index smallint, _challenged_partner_user_id uuid DEFAULT NULL::uuid)
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
  IF v_challenge.status NOT IN ('propuesto','aceptado') THEN
    RAISE EXCEPTION 'El desafío ya no está pendiente de respuesta (estado: %)', v_challenge.status;
  END IF;

  -- Transicionar a aceptado si aún está propuesto (UI puede saltar el respond explícito)
  IF v_challenge.status = 'propuesto' THEN
    UPDATE public.ladder_challenges
       SET status = 'aceptado', responded_at = now(), updated_at = now()
     WHERE id = v_challenge.id
     RETURNING * INTO v_challenge;
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