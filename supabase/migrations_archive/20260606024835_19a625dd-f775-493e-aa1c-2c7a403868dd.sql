
CREATE OR REPLACE FUNCTION public._bootstrap_vault_has_cron_secret()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_secret');
$$;

REVOKE ALL ON FUNCTION public._bootstrap_vault_has_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._bootstrap_vault_has_cron_secret() TO service_role;
