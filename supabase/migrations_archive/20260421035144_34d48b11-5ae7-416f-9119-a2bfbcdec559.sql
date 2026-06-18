
-- Crear usuario demo en auth.users con password "Clave DemoUser1234"
DO $$
DECLARE
  v_user_id uuid := '00000000-0000-4000-8000-00000000d3a0';
  v_tenant_id uuid := '2cf39ca1-1585-4ccb-81cc-f1225e8ef17b';
  v_email text := 'demouser@aceplay.cl';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token,
      email_change, email_change_token_new, recovery_token
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email,
      crypt('Clave DemoUser1234', gen_salt('bf')), now(), now(), now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('first_name','Demo','last_name','User'),
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', v_user_id::text, now(), now(), now());
  END IF;
END $$;
