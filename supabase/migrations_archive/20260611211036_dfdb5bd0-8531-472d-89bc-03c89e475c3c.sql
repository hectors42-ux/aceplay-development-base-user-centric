
CREATE OR REPLACE FUNCTION public._qa_test_insert(_cat uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_t uuid;
  v_tn uuid;
  v_before bigint;
  v_after bigint;
  v_inserted_id uuid;
BEGIN
  SELECT tournament_id, tenant_id INTO v_t, v_tn FROM public.tournament_categories WHERE id = _cat;
  SELECT count(*) INTO v_before FROM public.tournament_matches WHERE tournament_category_id = _cat;
  INSERT INTO public.tournament_matches (tournament_id, tournament_category_id, tenant_id, round, bracket_position)
  VALUES (v_t, _cat, v_tn, 1, 1) RETURNING id INTO v_inserted_id;
  SELECT count(*) INTO v_after FROM public.tournament_matches WHERE tournament_category_id = _cat;
  RETURN jsonb_build_object('before', v_before, 'after', v_after, 'inserted', v_inserted_id);
END $$;
REVOKE ALL ON FUNCTION public._qa_test_insert(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._qa_test_insert(uuid) TO service_role;
