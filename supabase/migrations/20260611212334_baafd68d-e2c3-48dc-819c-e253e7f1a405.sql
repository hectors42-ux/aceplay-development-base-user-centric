DO $$
DECLARE
  v_cat_id uuid := '1c0594a0-dcd7-4fe7-b7df-0813d83db04b';
  v_seeds uuid[];
  v_cat public.tournament_categories%ROWTYPE;
  v_before int;
  v_after int;
  v_ret int;
BEGIN
  SELECT * INTO v_cat FROM public.tournament_categories WHERE id=v_cat_id;
  RAISE NOTICE 'cat tournament_id=% tenant_id=%', v_cat.tournament_id, v_cat.tenant_id;
  SELECT array_agg(id) INTO v_seeds FROM public.tournament_registrations WHERE tournament_category_id=v_cat_id;
  RAISE NOTICE 'seeds count=%', array_length(v_seeds,1);
  v_before := (SELECT count(*) FROM public.tournament_matches WHERE tournament_category_id=v_cat_id);
  RAISE NOTICE 'before=%', v_before;
  v_ret := public._qa_build_bracket(v_cat_id, v_seeds, 'main');
  v_after := (SELECT count(*) FROM public.tournament_matches WHERE tournament_category_id=v_cat_id);
  RAISE NOTICE 'ret=% after=%', v_ret, v_after;
  -- direct insert test
  INSERT INTO public.tournament_matches (tournament_id, tournament_category_id, tenant_id, round, bracket_position, bracket)
  VALUES (v_cat.tournament_id, v_cat_id, v_cat.tenant_id, 77, 77, 'main');
  RAISE NOTICE 'direct insert ok, total=%', (SELECT count(*) FROM public.tournament_matches WHERE tournament_category_id=v_cat_id);
END $$;