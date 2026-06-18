-- Setup compartido para la suite pgTAP.
-- Reinicia el mundo QA antes de cada corrida para garantizar determinismo.
--
-- Uso: cada archivo de test hace \i supabase/tests/setup.sql al inicio.
-- pgTAP debe estar habilitado (CREATE EXTENSION pgtap).

CREATE EXTENSION IF NOT EXISTS pgtap;

-- Salvaguarda: jamás operamos contra otro tenant que no sea qa-sandbox.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug='qa-sandbox') THEN
    PERFORM public.qa_reset('qa-sandbox');
  END IF;
END $$;

SELECT public.qa_seed_all();