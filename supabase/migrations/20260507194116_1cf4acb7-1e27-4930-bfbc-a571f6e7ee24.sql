
-- Triggers para crear notificaciones in-app cuando llegan/responden invitaciones de partner

CREATE OR REPLACE FUNCTION public.notify_match_invitation_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(first_name || ' ' || COALESCE(last_name,'')), ''), 'Un socio')
    INTO v_name FROM public.profiles WHERE user_id = NEW.inviter_user_id;

  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, description, link, ref_id)
  VALUES (
    NEW.tenant_id,
    NEW.invitee_user_id,
    'partner_invitation',
    'Invitación a jugar',
    v_name || ' te invitó a un partido',
    '/ranking?tab=buscar&invSub=invitaciones',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_match_invitation_response()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT;
  v_title TEXT;
  v_desc TEXT;
  v_kind TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(first_name || ' ' || COALESCE(last_name,'')), ''), 'El socio')
    INTO v_name FROM public.profiles WHERE user_id = NEW.invitee_user_id;

  IF NEW.status = 'accepted' THEN
    v_kind := 'partner_invitation_accepted';
    v_title := 'Invitación aceptada';
    v_desc := v_name || ' aceptó tu invitación';
  ELSIF NEW.status = 'rejected' THEN
    v_kind := 'partner_invitation_rejected';
    v_title := 'Invitación rechazada';
    v_desc := v_name || ' rechazó tu invitación';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, description, link, ref_id)
  VALUES (
    NEW.tenant_id,
    NEW.inviter_user_id,
    v_kind,
    v_title,
    v_desc,
    '/ranking?tab=buscar&invSub=invitaciones',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_match_invitation_created ON public.match_invitations;
CREATE TRIGGER trg_notify_match_invitation_created
  AFTER INSERT ON public.match_invitations
  FOR EACH ROW EXECUTE FUNCTION public.notify_match_invitation_created();

DROP TRIGGER IF EXISTS trg_notify_match_invitation_response ON public.match_invitations;
CREATE TRIGGER trg_notify_match_invitation_response
  AFTER UPDATE OF status ON public.match_invitations
  FOR EACH ROW EXECUTE FUNCTION public.notify_match_invitation_response();
