
CREATE OR REPLACE FUNCTION public._qa_diag_matches(_cat uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total', count(*),
    'by_bracket', jsonb_object_agg(coalesce(bracket,'null'), c)
  )
  FROM (
    SELECT bracket, count(*) AS c
    FROM public.tournament_matches
    WHERE tournament_category_id = _cat
    GROUP BY bracket
  ) s;
$$;
REVOKE ALL ON FUNCTION public._qa_diag_matches(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._qa_diag_matches(uuid) TO service_role;
