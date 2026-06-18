
-- Idempotent vault upsert helper. Service-role only.
CREATE OR REPLACE FUNCTION public._bootstrap_vault_secret_upsert(_name text, _secret text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = _name;
  IF v_id IS NULL THEN
    SELECT vault.create_secret(_secret, _name) INTO v_id;
  ELSE
    PERFORM vault.update_secret(v_id, _secret, _name);
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._bootstrap_vault_secret_upsert(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._bootstrap_vault_secret_upsert(text, text) TO service_role;
