-- Diagnostic: try to manually generate bracket and surface the actual error
DO $$
DECLARE
  v_seeds uuid[];
  v_err text;
BEGIN
  SELECT array_agg(id ORDER BY registered_at) INTO v_seeds
  FROM public.tournament_registrations
  WHERE tournament_category_id='1c0594a0-dcd7-4fe7-b7df-0813d83db04b';
  
  BEGIN
    PERFORM public._qa_build_bracket('1c0594a0-dcd7-4fe7-b7df-0813d83db04b', v_seeds, 'main');
    RAISE NOTICE 'OK: % matches', (SELECT count(*) FROM public.tournament_matches WHERE tournament_category_id='1c0594a0-dcd7-4fe7-b7df-0813d83db04b');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = PG_EXCEPTION_CONTEXT;
    RAISE EXCEPTION 'DIAG: % | CTX: %', SQLERRM, v_err;
  END;
END $$;