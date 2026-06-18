
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _default_tenant uuid := 'ad61e9b5-2107-4b44-b9d6-f87ebd41ec1d';
  _first text;
  _last text;
BEGIN
  _first := COALESCE(NULLIF(NEW.raw_user_meta_data->>'first_name',''), split_part(NEW.email,'@',1));
  _last  := COALESCE(NULLIF(NEW.raw_user_meta_data->>'last_name',''), '');

  INSERT INTO public.profiles (user_id, tenant_id, email, first_name, last_name)
  VALUES (NEW.id, _default_tenant, NEW.email, _first, _last)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill: crear perfil para usuarios auth.users que aún no lo tienen
INSERT INTO public.profiles (user_id, tenant_id, email, first_name, last_name)
SELECT
  u.id,
  'ad61e9b5-2107-4b44-b9d6-f87ebd41ec1d'::uuid,
  u.email,
  COALESCE(NULLIF(u.raw_user_meta_data->>'first_name',''), split_part(u.email,'@',1)),
  COALESCE(NULLIF(u.raw_user_meta_data->>'last_name',''), '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;
