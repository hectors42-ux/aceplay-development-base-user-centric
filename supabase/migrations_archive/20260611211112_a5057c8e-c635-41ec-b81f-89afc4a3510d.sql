
CREATE OR REPLACE FUNCTION public._qa_call_gen(_cat uuid, _seeds uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := public._qa_admin_uid();
  v_before bigint;
  v_after bigint;
  v_ret int;
BEGIN
  SELECT count(*) INTO v_before FROM public.tournament_matches WHERE tournament_category_id=_cat;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role','authenticated')::text, true);
  v_ret := public.generate_bracket(_cat, _seeds);
  SELECT count(*) INTO v_after FROM public.tournament_matches WHERE tournament_category_id=_cat;
  RETURN jsonb_build_object('ret', v_ret, 'before', v_before, 'after', v_after);
END $$;
REVOKE ALL ON FUNCTION public._qa_call_gen(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._qa_call_gen(uuid, uuid[]) TO service_role;
