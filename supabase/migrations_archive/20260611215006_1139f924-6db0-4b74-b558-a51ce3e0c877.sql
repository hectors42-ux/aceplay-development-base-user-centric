-- Helper para que la suite pgTAP pueda ejecutar SQL mutativo bajo SECURITY DEFINER.
-- Solo disponible para service_role; sandbox/postgres lo usan vía pgtap.
CREATE OR REPLACE FUNCTION public._qa_exec(_sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Salvaguarda: solo permitir mutaciones contra el tenant qa-sandbox.
  -- No es un parser SQL completo; sirve para evitar accidentes obvios.
  IF position('aceplay-demo' in _sql) > 0 OR position('stade-' in _sql) > 0 THEN
    RAISE EXCEPTION '_qa_exec: SQL parece tocar tenants reales (rechazado)';
  END IF;
  EXECUTE _sql;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._qa_exec(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._qa_exec(text) TO service_role;