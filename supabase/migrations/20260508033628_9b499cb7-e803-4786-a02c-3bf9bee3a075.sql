
CREATE OR REPLACE FUNCTION public.get_partner_suggestions(_limit integer DEFAULT 12)
 RETURNS TABLE(user_id uuid, first_name text, last_name text, avatar_url text, level numeric, level_diff numeric, compat_score integer, reasons text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid := user_tenant_id(v_uid);
  v_my_level numeric;
BEGIN
  SELECT pr.level INTO v_my_level
  FROM public.player_ratings pr
  WHERE pr.user_id = v_uid AND pr.sport = 'tenis_singles'
  ORDER BY pr.updated_at DESC NULLS LAST
  LIMIT 1;

  RETURN QUERY
  SELECT
    p.user_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    pr.level,
    ABS(COALESCE(pr.level, 0) - COALESCE(v_my_level, 0)) AS level_diff,
    public.compute_partner_compatibility(v_uid, p.user_id) AS compat_score,
    ARRAY[]::text[] AS reasons
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT pr2.level
    FROM public.player_ratings pr2
    WHERE pr2.user_id = p.user_id AND pr2.sport = 'tenis_singles'
    ORDER BY pr2.updated_at DESC NULLS LAST
    LIMIT 1
  ) pr ON true
  WHERE p.tenant_id = v_tenant
    AND p.user_id <> v_uid
  ORDER BY compat_score DESC NULLS LAST, level_diff ASC NULLS LAST
  LIMIT _limit;
END $function$;
