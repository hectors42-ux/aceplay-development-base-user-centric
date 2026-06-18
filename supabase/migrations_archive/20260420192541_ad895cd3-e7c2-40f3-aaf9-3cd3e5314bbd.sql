UPDATE auth.users
SET encrypted_password = crypt('AcePlay2026!', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'hectors42@gmail.com';