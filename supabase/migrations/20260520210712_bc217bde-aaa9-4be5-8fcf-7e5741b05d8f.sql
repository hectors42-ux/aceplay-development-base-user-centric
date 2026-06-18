CREATE OR REPLACE FUNCTION public.notify_match_invitation_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    '/ranking?tab=buscar&pTab=invitaciones&invTab=recibidas',
    NEW.id
  );
  RETURN NEW;
END;
$function$;