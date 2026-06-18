-- Bug 3: 16 usuarios demo (@demo.aceplay.cl) creados por seed sin auth.identities.
-- Sin identity, GoTrue retorna 500 al intentar update password / sign-in.
-- Creamos la identity tipo 'email' que normalmente añade signUp().
INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  'email',
  u.id::text,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  now(),
  now(),
  now()
FROM auth.users u
WHERE u.email ILIKE '%@demo.aceplay.cl'
  AND NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id);