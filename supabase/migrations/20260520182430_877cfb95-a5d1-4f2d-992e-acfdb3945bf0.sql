CREATE OR REPLACE FUNCTION public.create_booking(
  _court_id uuid,
  _starts_at timestamptz,
  _partner_user_id uuid,
  _notes text DEFAULT NULL,
  _duration_minutes integer DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _court public.courts;
  _user_tenant uuid;
  _partner_tenant uuid;
  _ends_at timestamptz;
  _new public.bookings;
  _conflict_count int;
  _partner_conflict int;
  _rules public.booking_rules;
  _active_count int;
  _effective_duration int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF _partner_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes seleccionar un compañero/a para reservar';
  END IF;

  IF _partner_user_id = auth.uid() THEN
    RAISE EXCEPTION 'El compañero debe ser otro socio, no tú mismo';
  END IF;

  SELECT * INTO _court FROM public.courts WHERE id = _court_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cancha no encontrada o inactiva';
  END IF;

  SELECT tenant_id INTO _user_tenant FROM public.profiles WHERE user_id = auth.uid();
  SELECT tenant_id INTO _partner_tenant FROM public.profiles WHERE user_id = _partner_user_id;

  IF _user_tenant IS NULL OR _user_tenant <> _court.tenant_id THEN
    RAISE EXCEPTION 'No perteneces al club de esta cancha';
  END IF;

  IF _partner_tenant IS NULL OR _partner_tenant <> _user_tenant THEN
    RAISE EXCEPTION 'El compañero debe ser socio del mismo club';
  END IF;

  _effective_duration := COALESCE(_duration_minutes, _court.slot_minutes);
  IF _effective_duration NOT IN (60, 90, 120) THEN
    RAISE EXCEPTION 'Duración inválida: debe ser 60, 90 o 120 minutos';
  END IF;

  _ends_at := _starts_at + make_interval(mins => _effective_duration);

  IF _starts_at < now() THEN
    RAISE EXCEPTION 'No puedes reservar en el pasado';
  END IF;

  SELECT * INTO _rules FROM public.booking_rules WHERE tenant_id = _user_tenant;
  IF FOUND THEN
    IF _starts_at > now() + make_interval(days => _rules.max_advance_days) THEN
      RAISE EXCEPTION 'No puedes reservar con más de % días de anticipación', _rules.max_advance_days;
    END IF;

    SELECT count(*) INTO _active_count
      FROM public.bookings
      WHERE user_id = auth.uid()
        AND status = 'confirmada'
        AND ends_at > now()
        AND kind <> 'torneo';
    IF _active_count >= _rules.max_active_bookings THEN
      RAISE EXCEPTION 'Has alcanzado el máximo de reservas activas (%)', _rules.max_active_bookings;
    END IF;
  END IF;

  SELECT count(*) INTO _conflict_count
    FROM public.bookings
    WHERE court_id = _court_id
      AND status = 'confirmada'
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(_starts_at, _ends_at, '[)');
  IF _conflict_count > 0 THEN
    RAISE EXCEPTION 'Ese horario ya está ocupado en esta cancha';
  END IF;

  SELECT count(*) INTO _partner_conflict
    FROM public.bookings
    WHERE status = 'confirmada'
      AND (user_id = _partner_user_id OR partner_user_id = _partner_user_id)
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(_starts_at, _ends_at, '[)');
  IF _partner_conflict > 0 THEN
    RAISE EXCEPTION 'Tu compañero/a ya tiene una reserva en ese horario';
  END IF;

  BEGIN
    INSERT INTO public.bookings (
      tenant_id, court_id, user_id, partner_user_id, starts_at, ends_at, status, notes
    ) VALUES (
      _user_tenant, _court_id, auth.uid(), _partner_user_id, _starts_at, _ends_at, 'confirmada', _notes
    ) RETURNING * INTO _new;
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE EXCEPTION 'Ese horario ya fue tomado por otra persona, intenta con otro' USING ERRCODE = '23P01';
  END;

  RETURN _new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reschedule_partner_match(
  _invitation_id uuid,
  _new_court_id uuid,
  _new_starts_at timestamptz,
  _duration_minutes integer DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _inv public.match_invitations;
  _court public.courts;
  _old public.bookings;
  _ends_at timestamptz;
  _new public.bookings;
  _partner uuid;
  _eff_duration int;
  _conflict_count int;
  _partner_conflict int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO _inv FROM public.match_invitations WHERE id = _invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitación no encontrada';
  END IF;

  IF _inv.inviter_user_id <> auth.uid() AND _inv.invitee_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'No participas de esta invitación';
  END IF;

  IF _inv.status <> 'accepted' THEN
    RAISE EXCEPTION 'Solo se puede reprogramar un match aceptado';
  END IF;

  SELECT * INTO _court FROM public.courts WHERE id = _new_court_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cancha no encontrada o inactiva';
  END IF;

  IF _court.tenant_id <> _inv.tenant_id THEN
    RAISE EXCEPTION 'La cancha no pertenece al club';
  END IF;

  IF _new_starts_at < now() THEN
    RAISE EXCEPTION 'No puedes reprogramar al pasado';
  END IF;

  _eff_duration := COALESCE(_duration_minutes, 90);
  IF _eff_duration NOT IN (60, 90, 120) THEN
    RAISE EXCEPTION 'Duración inválida: debe ser 60, 90 o 120 minutos';
  END IF;
  _ends_at := _new_starts_at + make_interval(mins => _eff_duration);

  _partner := CASE WHEN _inv.inviter_user_id = auth.uid() THEN _inv.invitee_user_id ELSE _inv.inviter_user_id END;

  IF _inv.booking_id IS NOT NULL THEN
    UPDATE public.bookings
      SET status = 'cancelada', cancelled_at = now(), cancelled_by = auth.uid()
      WHERE id = _inv.booking_id AND status = 'confirmada'
      RETURNING * INTO _old;
  END IF;

  SELECT count(*) INTO _conflict_count
    FROM public.bookings
    WHERE court_id = _new_court_id
      AND status = 'confirmada'
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(_new_starts_at, _ends_at, '[)');
  IF _conflict_count > 0 THEN
    RAISE EXCEPTION 'Ese horario ya está ocupado en esta cancha';
  END IF;

  SELECT count(*) INTO _partner_conflict
    FROM public.bookings
    WHERE status = 'confirmada'
      AND (user_id = _partner OR partner_user_id = _partner)
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(_new_starts_at, _ends_at, '[)');
  IF _partner_conflict > 0 THEN
    RAISE EXCEPTION 'Tu compañero/a ya tiene una reserva en ese horario';
  END IF;

  BEGIN
    INSERT INTO public.bookings (
      tenant_id, court_id, user_id, partner_user_id, starts_at, ends_at, status, notes
    ) VALUES (
      _inv.tenant_id, _new_court_id, auth.uid(), _partner, _new_starts_at, _ends_at, 'confirmada',
      'Partner match (reprogramado): ' || COALESCE(_inv.message, '')
    ) RETURNING * INTO _new;
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE EXCEPTION 'Ese horario ya fue tomado por otra persona, intenta con otro' USING ERRCODE = '23P01';
  END;

  UPDATE public.match_invitations
    SET booking_id = _new.id,
        selected_slot = jsonb_build_object('starts_at', _new_starts_at, 'court_id', _new_court_id),
        updated_at = now()
    WHERE id = _invitation_id;

  RETURN _new;
END;
$function$;