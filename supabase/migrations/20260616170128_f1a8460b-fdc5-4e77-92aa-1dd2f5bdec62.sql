CREATE OR REPLACE FUNCTION public.tournament_report_metrics(_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament record;
  v_cobrand record;
  v_confirmed int;
  v_total_slots int;
  v_category_count int;
  v_session_count int;
  v_court_count int;
  v_rounds_total int;
  v_matches_played int;
  v_matches_total int;
  v_operators int;
  v_share_opens int;
  v_share_downloads int;
  v_share_shares int;
  v_share_unique int;
  v_top_kinds jsonb;
  v_activate_clicks int;
  v_conversions int;
  v_ave_clp bigint;
  CPM_STORY constant numeric := 8.5;
  CPM_POST constant numeric := 12.0;
  REACH_PER_SHARE constant int := 180;
  USD_CLP constant numeric := 950;
BEGIN
  SELECT id, name, starts_at, ends_at, closed_at
    INTO v_tournament
    FROM public.tournaments
   WHERE id = _tournament_id;

  IF v_tournament.id IS NULL THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;

  IF NOT public.is_tournament_manager(_tournament_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_cobrand FROM public.tournament_cobrand WHERE tournament_id = _tournament_id;

  SELECT count(*) INTO v_confirmed
    FROM public.tournament_registrations tr
    JOIN public.tournament_categories tc ON tc.id = tr.tournament_category_id
   WHERE tc.tournament_id = _tournament_id
     AND tr.status = 'confirmada';

  SELECT count(*), coalesce(sum(max_pairs * 2), 0)
    INTO v_category_count, v_total_slots
    FROM public.tournament_categories
   WHERE tournament_id = _tournament_id;

  SELECT count(*) INTO v_session_count
    FROM public.tournament_sessions WHERE tournament_id = _tournament_id;

  SELECT count(*) INTO v_court_count
    FROM public.tournament_courts WHERE tournament_id = _tournament_id;

  SELECT count(DISTINCT round_number) INTO v_rounds_total
    FROM public.americano_rounds ar
    JOIN public.tournament_categories tc ON tc.id = ar.tournament_category_id
   WHERE tc.tournament_id = _tournament_id;

  SELECT
    count(*) FILTER (WHERE status = 'jugado'),
    count(*)
    INTO v_matches_played, v_matches_total
    FROM public.tournament_matches WHERE tournament_id = _tournament_id;

  SELECT count(*) INTO v_operators
    FROM public.tournament_operators WHERE tournament_id = _tournament_id;

  SELECT
    count(*) FILTER (WHERE event_name = 'share_card_opened'),
    count(*) FILTER (WHERE event_name = 'share_card_downloaded'),
    count(*) FILTER (WHERE event_name = 'share_card_shared'),
    count(DISTINCT user_id) FILTER (WHERE event_name = 'share_card_opened'),
    count(*) FILTER (WHERE event_name = 'activate_level_clicked'),
    count(*) FILTER (WHERE event_name = 'guest_to_member_converted')
    INTO v_share_opens, v_share_downloads, v_share_shares, v_share_unique, v_activate_clicks, v_conversions
    FROM public.analytics_events
   WHERE event_props->>'tournament_id' = _tournament_id::text;

  SELECT coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_top_kinds
    FROM (
      SELECT event_props->>'kind' AS kind, count(*) AS c
        FROM public.analytics_events
       WHERE event_props->>'tournament_id' = _tournament_id::text
         AND event_name IN ('share_card_opened','share_card_downloaded','share_card_shared')
         AND event_props->>'kind' IS NOT NULL
       GROUP BY event_props->>'kind'
       ORDER BY count(*) DESC
       LIMIT 5
    ) t;

  v_ave_clp := round(((v_share_shares::numeric * REACH_PER_SHARE) / 1000.0) * ((CPM_STORY + CPM_POST) / 2.0) * USD_CLP);

  RETURN jsonb_build_object(
    'tournament', jsonb_build_object(
      'id', v_tournament.id,
      'name', v_tournament.name,
      'starts_at', v_tournament.starts_at,
      'ends_at', v_tournament.ends_at,
      'closed_at', v_tournament.closed_at,
      'cobrand', CASE WHEN v_cobrand.tournament_id IS NULL THEN NULL ELSE jsonb_build_object(
        'display_name', v_cobrand.display_name,
        'brand_key', v_cobrand.brand_key,
        'primary_hex', v_cobrand.primary_hex,
        'accent_hex', v_cobrand.accent_hex,
        'logo_url', v_cobrand.logo_url
      ) END
    ),
    'participation', jsonb_build_object(
      'confirmed_players', v_confirmed,
      'total_slots', v_total_slots,
      'fill_rate', CASE WHEN v_total_slots > 0 THEN round((v_confirmed::numeric / v_total_slots) * 100, 1) ELSE 0 END,
      'category_count', v_category_count,
      'session_count', v_session_count,
      'court_count', v_court_count
    ),
    'play', jsonb_build_object(
      'rounds_total', v_rounds_total,
      'matches_played', v_matches_played,
      'matches_total', v_matches_total,
      'completion_rate', CASE WHEN v_matches_total > 0 THEN round((v_matches_played::numeric / v_matches_total) * 100, 1) ELSE 0 END
    ),
    'operators', jsonb_build_object('count', v_operators),
    'share', jsonb_build_object(
      'opens', v_share_opens,
      'downloads', v_share_downloads,
      'shares', v_share_shares,
      'unique_users', v_share_unique,
      'top_kinds', v_top_kinds
    ),
    'captacion', jsonb_build_object(
      'activate_clicks', v_activate_clicks,
      'conversions', v_conversions,
      'conversion_rate', CASE WHEN v_activate_clicks > 0 THEN round((v_conversions::numeric / v_activate_clicks) * 100, 1) ELSE 0 END
    ),
    'ave_clp', v_ave_clp,
    'snapshot_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tournament_report_metrics(uuid) TO authenticated;