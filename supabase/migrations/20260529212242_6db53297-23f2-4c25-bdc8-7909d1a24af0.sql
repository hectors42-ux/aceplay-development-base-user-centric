CREATE OR REPLACE FUNCTION public._e2e_lookup_users_by_email(emails text[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id, u.email::text FROM auth.users u WHERE u.email = ANY(emails);
$$;

REVOKE ALL ON FUNCTION public._e2e_lookup_users_by_email(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._e2e_lookup_users_by_email(text[]) TO service_role;