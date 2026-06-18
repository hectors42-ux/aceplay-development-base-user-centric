DO $$
DECLARE
  v_old_id uuid := '00000000-0000-4000-8000-00000000d3a0';
  v_new_id uuid;
  v_tenant_id uuid;
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'demouser@aceplay.cl') INTO v_exists;

  IF NOT v_exists THEN
    v_new_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_new_id,
      'authenticated', 'authenticated',
      'demouser@aceplay.cl',
      crypt('ClaveDemoUser1234', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"Demo","last_name":"User"}'::jsonb,
      false, '', '', '', ''
    );

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_new_id::text, v_new_id,
      jsonb_build_object('sub', v_new_id::text, 'email', 'demouser@aceplay.cl', 'email_verified', true),
      'email', now(), now(), now()
    );

    IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_old_id) THEN
      UPDATE public.profiles SET user_id = v_new_id WHERE user_id = v_old_id;
      UPDATE public.user_roles SET user_id = v_new_id WHERE user_id = v_old_id;
      UPDATE public.player_ratings SET user_id = v_new_id WHERE user_id = v_old_id;
      UPDATE public.rating_history SET user_id = v_new_id WHERE user_id = v_old_id;
      UPDATE public.ladder_positions SET user_id = v_new_id WHERE user_id = v_old_id;
      UPDATE public.ladder_history SET user_id = v_new_id WHERE user_id = v_old_id;
      UPDATE public.ladder_challenges SET challenger_user_id = v_new_id WHERE challenger_user_id = v_old_id;
      UPDATE public.ladder_challenges SET challenged_user_id = v_new_id WHERE challenged_user_id = v_old_id;
      UPDATE public.ladder_challenges SET winner_user_id = v_new_id WHERE winner_user_id = v_old_id;
      UPDATE public.ladder_challenges SET loser_user_id = v_new_id WHERE loser_user_id = v_old_id;
      UPDATE public.bookings SET user_id = v_new_id WHERE user_id = v_old_id;
      UPDATE public.bookings SET partner_user_id = v_new_id WHERE partner_user_id = v_old_id;
      UPDATE public.coach_class_bookings SET student1_user_id = v_new_id WHERE student1_user_id = v_old_id;
      UPDATE public.coach_class_bookings SET student2_user_id = v_new_id WHERE student2_user_id = v_old_id;
    ELSE
      SELECT id INTO v_tenant_id FROM public.tenants ORDER BY created_at ASC LIMIT 1;
      INSERT INTO public.profiles (user_id, tenant_id, email, first_name, last_name, dues_status, accepted_terms_at, accepted_privacy_at)
      VALUES (v_new_id, v_tenant_id, 'demouser@aceplay.cl', 'Demo', 'User', 'al_dia', now(), now());
      INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (v_new_id, 'member', v_tenant_id);
    END IF;
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('ClaveDemoUser1234', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE email = 'demouser@aceplay.cl';
  END IF;
END $$;