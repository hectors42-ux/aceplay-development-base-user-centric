
CREATE OR REPLACE FUNCTION public.create_match_invitation(
  _invitee_user_id uuid,
  _slots jsonb,
  _message text DEFAULT NULL
)
RETURNS public.match_invitations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid := user_tenant_id(v_uid);
  v_invitee_tenant uuid;
  v_score int;
  v_existing public.match_invitations;
  v_new public.match_invitations;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _invitee_user_id = v_uid THEN RAISE EXCEPTION 'No puedes invitarte a ti mismo'; END IF;
  IF jsonb_typeof(_slots) <> 'array' OR jsonb_array_length(_slots) = 0 OR jsonb_array_length(_slots) > 3 THEN
    RAISE EXCEPTION 'Debes proponer entre 1 y 3 horarios';
  END IF;

  SELECT tenant_id INTO v_invitee_tenant FROM public.profiles WHERE user_id = _invitee_user_id;
  IF v_invitee_tenant IS NULL OR v_invitee_tenant <> v_tenant THEN
    RAISE EXCEPTION 'Socio no encontrado en tu club';
  END IF;

  SELECT * INTO v_existing
  FROM public.match_invitations
  WHERE inviter_user_id = _invitee_user_id
    AND invitee_user_id = v_uid
    AND status = 'pending'
    AND created_at > now() - interval '1 hour'
  ORDER BY created_at DESC LIMIT 1;

  v_score := public.compute_partner_compatibility(v_uid, _invitee_user_id);

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.match_invitations
       SET status = 'accepted',
           selected_slot = (_slots->0),
           responded_at = now()
     WHERE id = v_existing.id
     RETURNING * INTO v_existing;

    INSERT INTO public.user_notifications (user_id, tenant_id, kind, title, description, ref_id)
    VALUES
      (v_existing.inviter_user_id, v_tenant, 'partner_invitation_accepted', 'Hay Partner', 'Auto-match con socio', v_existing.id),
      (v_uid, v_tenant, 'partner_invitation_accepted', 'Hay Partner', 'Auto-match con socio', v_existing.id);

    RETURN v_existing;
  END IF;

  INSERT INTO public.match_invitations (
    tenant_id, inviter_user_id, invitee_user_id, proposed_slots, message, compat_score
  ) VALUES (
    v_tenant, v_uid, _invitee_user_id, _slots, _message, v_score
  ) RETURNING * INTO v_new;

  INSERT INTO public.user_notifications (user_id, tenant_id, kind, title, description, ref_id)
  VALUES (_invitee_user_id, v_tenant, 'partner_invitation_received', 'Nueva invitación de partido', COALESCE(_message,'Te invitaron a jugar'), v_new.id);

  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.respond_match_invitation(
  _invitation_id uuid,
  _selected_slot jsonb,
  _accept boolean
)
RETURNS public.match_invitations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.match_invitations;
BEGIN
  SELECT * INTO v_inv FROM public.match_invitations WHERE id = _invitation_id;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invitación no encontrada'; END IF;
  IF v_inv.invitee_user_id <> v_uid THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'Invitación ya procesada'; END IF;

  UPDATE public.match_invitations
     SET status = CASE WHEN _accept THEN 'accepted'::partner_invitation_status ELSE 'rejected'::partner_invitation_status END,
         selected_slot = CASE WHEN _accept THEN _selected_slot ELSE NULL END,
         responded_at = now()
   WHERE id = _invitation_id
   RETURNING * INTO v_inv;

  INSERT INTO public.user_notifications (user_id, tenant_id, kind, title, description, ref_id)
  VALUES (
    v_inv.inviter_user_id, v_inv.tenant_id,
    CASE WHEN _accept THEN 'partner_invitation_accepted' ELSE 'partner_invitation_rejected' END,
    CASE WHEN _accept THEN 'Aceptaron tu invitación' ELSE 'Rechazaron tu invitación' END,
    NULL, v_inv.id
  );

  RETURN v_inv;
END $$;

CREATE OR REPLACE FUNCTION public.expire_match_invitations()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM public.match_invitations
    WHERE status = 'pending' AND expires_at < now()
  LOOP
    UPDATE public.match_invitations SET status = 'expired' WHERE id = r.id;
    INSERT INTO public.user_notifications (user_id, tenant_id, kind, title, description, ref_id)
    VALUES
      (r.inviter_user_id, r.tenant_id, 'partner_invitation_expired', 'Invitación expirada', 'Tu invitación venció sin respuesta', r.id),
      (r.invitee_user_id, r.tenant_id, 'partner_invitation_expired', 'Invitación expirada', 'Una invitación pendiente venció', r.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.respond_match_open_post(
  _post_id uuid,
  _selected_slot jsonb,
  _message text DEFAULT NULL
)
RETURNS public.match_post_responses
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_post public.match_open_posts;
  v_resp public.match_post_responses;
BEGIN
  SELECT * INTO v_post FROM public.match_open_posts WHERE id = _post_id;
  IF v_post.id IS NULL OR v_post.status <> 'open' THEN RAISE EXCEPTION 'Post no disponible'; END IF;
  IF v_post.user_id = v_uid THEN RAISE EXCEPTION 'No puedes responder tu propio post'; END IF;

  INSERT INTO public.match_post_responses (tenant_id, post_id, responder_user_id, selected_slot, message)
  VALUES (v_post.tenant_id, _post_id, v_uid, _selected_slot, _message)
  RETURNING * INTO v_resp;

  INSERT INTO public.user_notifications (user_id, tenant_id, kind, title, description, ref_id)
  VALUES (v_post.user_id, v_post.tenant_id, 'partner_post_response', 'Respondieron tu Busco Partner', NULL, v_resp.id);

  RETURN v_resp;
END $$;
