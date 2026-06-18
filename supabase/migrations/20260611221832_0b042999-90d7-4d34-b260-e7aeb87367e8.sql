
CREATE OR REPLACE FUNCTION public._demo_make_user(_email text, _first text, _last text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE
  v_uid uuid;
  v_tenant uuid := public._demo_tenant_id();
BEGIN
  SELECT user_id INTO v_uid FROM public.profiles WHERE email = _email;
  IF v_uid IS NOT NULL THEN RETURN v_uid; END IF;

  v_uid := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    _email, extensions.crypt('demo-disabled-' || v_uid::text, extensions.gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    jsonb_build_object('display_name', _first || ' ' || _last),
    false, '', '', '', ''
  );

  INSERT INTO public.profiles (user_id, tenant_id, email, first_name, last_name, dues_status)
  VALUES (v_uid, v_tenant, _email, _first, _last, 'al_dia'::dues_status);

  RETURN v_uid;
END;
$$;
