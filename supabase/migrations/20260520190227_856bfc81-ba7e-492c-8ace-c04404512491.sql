CREATE OR REPLACE FUNCTION public.notify_match_invitation_response()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name TEXT;
  v_title TEXT;
  v_desc TEXT;
  v_kind TEXT;
  v_link TEXT;
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
    v_link := '/ranking?tab=buscar&pTab=invitaciones&invTab=enviadas';
  ELSIF NEW.status = 'rejected' THEN
    v_kind := 'partner_invitation_rejected';
    v_title := 'Invitación rechazada';
    v_desc := v_name || ' rechazó tu invitación';
    v_link := '/ranking?tab=buscar&pTab=invitaciones&invTab=enviadas';
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
    v_link,
    NEW.id
  );
  RETURN NEW;
END;
$function$;