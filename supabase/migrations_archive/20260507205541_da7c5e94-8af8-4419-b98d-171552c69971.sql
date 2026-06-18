
-- Trigger: notificar a ambos participantes cuando se vincula una reserva a la invitación
CREATE OR REPLACE FUNCTION public.notify_match_invitation_booking()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_when timestamptz;
  v_court text;
  v_desc text;
  v_link text;
BEGIN
  -- Solo cuando se asocia una reserva nueva
  IF NEW.booking_id IS NULL OR NEW.booking_id IS NOT DISTINCT FROM OLD.booking_id THEN
    RETURN NEW;
  END IF;

  SELECT b.starts_at, c.name
    INTO v_when, v_court
  FROM public.bookings b
  LEFT JOIN public.courts c ON c.id = b.court_id
  WHERE b.id = NEW.booking_id;

  v_desc := 'Cancha ' || COALESCE(v_court, 'asignada') || ' · ' ||
            to_char(v_when AT TIME ZONE 'America/Santiago', 'DD/MM HH24:MI') || ' h';
  v_link := '/partner/match/' || NEW.id;

  -- Notificar a ambos (cada uno verá la suya en el feed)
  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, description, link, ref_id)
  VALUES
    (NEW.tenant_id, NEW.inviter_user_id, 'partner_match_booked', 'Cancha confirmada', v_desc, v_link, NEW.id),
    (NEW.tenant_id, NEW.invitee_user_id, 'partner_match_booked', 'Cancha confirmada', v_desc, v_link, NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_match_invitation_booking ON public.match_invitations;
CREATE TRIGGER trg_notify_match_invitation_booking
  AFTER UPDATE OF booking_id ON public.match_invitations
  FOR EACH ROW EXECUTE FUNCTION public.notify_match_invitation_booking();

-- Trigger: notificar al partner cuando un match aceptado se cancela
CREATE OR REPLACE FUNCTION public.notify_match_invitation_cancelled()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_canceller_name text;
  v_recipient uuid;
BEGIN
  IF NEW.status = OLD.status OR NEW.status <> 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Avisar a ambas partes (cada una verá su notificación)
  FOR v_recipient IN SELECT unnest(ARRAY[NEW.inviter_user_id, NEW.invitee_user_id]) LOOP
    INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, description, link, ref_id)
    VALUES (
      NEW.tenant_id,
      v_recipient,
      'partner_match_cancelled',
      'Match cancelado',
      'El partido fue cancelado y la cancha quedó liberada',
      '/partner/match/' || NEW.id,
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_match_invitation_cancelled ON public.match_invitations;
CREATE TRIGGER trg_notify_match_invitation_cancelled
  AFTER UPDATE OF status ON public.match_invitations
  FOR EACH ROW EXECUTE FUNCTION public.notify_match_invitation_cancelled();
