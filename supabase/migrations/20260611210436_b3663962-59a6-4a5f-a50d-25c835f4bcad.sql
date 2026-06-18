
CREATE OR REPLACE FUNCTION public._qa_make_user(_email text, _display text, _is_admin boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_uid uuid;
  v_tenant uuid := public._qa_tenant_id();
BEGIN
  SELECT user_id INTO v_uid FROM public.profiles WHERE email = _email AND tenant_id = v_tenant;
  IF v_uid IS NOT NULL THEN RETURN v_uid; END IF;

  v_uid := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    _email, '!qa-disabled-' || v_uid::text,
    now(), now(), now(),
    jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    jsonb_build_object('display_name', _display),
    false, '', '', '', ''
  );

  INSERT INTO public.profiles (
    user_id, tenant_id, email, first_name, last_name, dues_status
  ) VALUES (
    v_uid, v_tenant, _email,
    split_part(_display, ' ', 1),
    NULLIF(substring(_display from position(' ' in _display) + 1), ''),
    'al_dia'::dues_status
  );

  IF _is_admin THEN
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (v_uid, v_tenant, 'club_admin'::app_role)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (v_uid, v_tenant, 'super_admin'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_uid;
END;
$$;
