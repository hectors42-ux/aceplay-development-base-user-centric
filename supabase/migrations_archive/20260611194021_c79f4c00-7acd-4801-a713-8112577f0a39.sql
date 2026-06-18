
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closing_summary jsonb;

CREATE OR REPLACE FUNCTION public._tournament_category_podium(_category_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cat record;
  _final record;
  _runner_up_id uuid;
  _semis jsonb;
  _matches_played int;
BEGIN
  SELECT id, name, bracket_generated_at INTO _cat
  FROM public.tournament_categories WHERE id = _category_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT count(*) INTO _matches_played
  FROM public.tournament_matches
  WHERE tournament_category_id = _category_id
    AND status IN ('jugado','walkover');

  IF _cat.bracket_generated_at IS NULL THEN
    RETURN jsonb_build_object(
      'id', _cat.id, 'name', _cat.name,
      'champion', NULL, 'runner_up', NULL, 'semis', '[]'::jsonb,
      'matches_played', _matches_played, 'has_bracket', false
    );
  END IF;

  SELECT * INTO _final
  FROM public.tournament_matches
  WHERE tournament_category_id = _category_id AND round = 1
  ORDER BY bracket_position
  LIMIT 1;

  IF _final.winner_registration_id IS NOT NULL THEN
    _runner_up_id := CASE
      WHEN _final.winner_registration_id = _final.registration_a_id THEN _final.registration_b_id
      ELSE _final.registration_a_id
    END;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('registration_id', loser_id)), '[]'::jsonb)
  INTO _semis
  FROM (
    SELECT CASE
      WHEN winner_registration_id = registration_a_id THEN registration_b_id
      WHEN winner_registration_id = registration_b_id THEN registration_a_id
      ELSE NULL
    END AS loser_id
    FROM public.tournament_matches
    WHERE tournament_category_id = _category_id AND round = 2
  ) s WHERE loser_id IS NOT NULL;

  RETURN jsonb_build_object(
    'id', _cat.id,
    'name', _cat.name,
    'champion', CASE WHEN _final.winner_registration_id IS NOT NULL
      THEN jsonb_build_object('registration_id', _final.winner_registration_id) ELSE NULL END,
    'runner_up', CASE WHEN _runner_up_id IS NOT NULL
      THEN jsonb_build_object('registration_id', _runner_up_id) ELSE NULL END,
    'semis', _semis,
    'matches_played', _matches_played,
    'has_bracket', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public._tournament_category_podium(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._tournament_category_podium(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.close_tournament(_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_mgr boolean;
  _t record;
  _pending int;
  _cats jsonb;
  _participants int;
  _matches int;
  _summary jsonb;
BEGIN
  SELECT public.is_tournament_manager(_tournament_id) INTO _is_mgr;
  IF NOT COALESCE(_is_mgr, false) THEN
    RAISE EXCEPTION 'forbidden: only tournament managers can close a tournament';
  END IF;

  SELECT * INTO _t FROM public.tournaments WHERE id = _tournament_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tournament not found'; END IF;
  IF _t.closed_at IS NOT NULL THEN RAISE EXCEPTION 'tournament already closed'; END IF;

  SELECT count(*) INTO _pending
  FROM public.tournament_matches m
  JOIN public.tournament_categories c ON c.id = m.tournament_category_id
  WHERE m.tournament_id = _tournament_id
    AND c.bracket_generated_at IS NOT NULL
    AND m.status NOT IN ('jugado','walkover')
    AND m.registration_a_id IS NOT NULL
    AND m.registration_b_id IS NOT NULL;

  IF _pending > 0 THEN
    RAISE EXCEPTION 'cannot close: % matches still pending', _pending;
  END IF;

  SELECT COALESCE(jsonb_agg(public._tournament_category_podium(c.id) ORDER BY c.sort_order), '[]'::jsonb)
  INTO _cats
  FROM public.tournament_categories c
  WHERE c.tournament_id = _tournament_id;

  SELECT count(*) INTO _participants FROM public.tournament_registrations
   WHERE tournament_id = _tournament_id AND status = 'confirmada';
  SELECT count(*) INTO _matches FROM public.tournament_matches
   WHERE tournament_id = _tournament_id AND status IN ('jugado','walkover');

  _summary := jsonb_build_object(
    'categories', _cats,
    'totals', jsonb_build_object('participants', _participants, 'matches_played', _matches),
    'closed_at', now()
  );

  UPDATE public.tournaments
     SET status = 'finalizado',
         closed_at = now(),
         closing_summary = _summary,
         updated_at = now()
   WHERE id = _tournament_id;

  RETURN _summary;
END;
$$;

REVOKE ALL ON FUNCTION public.close_tournament(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_tournament(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._tg_block_changes_when_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _closed timestamptz;
BEGIN
  SELECT closed_at INTO _closed FROM public.tournaments WHERE id = NEW.tournament_id;
  IF _closed IS NOT NULL THEN
    IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
      RAISE EXCEPTION 'tournament is closed; results are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS _tg_block_match_changes_when_closed ON public.tournament_matches;
CREATE TRIGGER _tg_block_match_changes_when_closed
BEFORE UPDATE OF score, winner_registration_id, status, walkover, retired
ON public.tournament_matches
FOR EACH ROW
WHEN (
  OLD.score IS DISTINCT FROM NEW.score
  OR OLD.winner_registration_id IS DISTINCT FROM NEW.winner_registration_id
  OR OLD.status IS DISTINCT FROM NEW.status
  OR OLD.walkover IS DISTINCT FROM NEW.walkover
  OR OLD.retired IS DISTINCT FROM NEW.retired
)
EXECUTE FUNCTION public._tg_block_changes_when_closed();

CREATE OR REPLACE VIEW public.organizer_history
WITH (security_invoker = on)
AS
SELECT
  t.id AS tournament_id,
  t.created_by AS organizer_user_id,
  t.tenant_id,
  t.name,
  t.slug,
  t.status,
  t.starts_at,
  t.ends_at,
  t.closed_at,
  t.closing_summary,
  (SELECT count(*) FROM public.tournament_registrations r
    WHERE r.tournament_id = t.id AND r.status = 'confirmada') AS participants_count,
  (SELECT count(*) FROM public.tournament_matches m
    WHERE m.tournament_id = t.id AND m.status IN ('jugado','walkover')) AS matches_played,
  (SELECT array_agg(DISTINCT c.sport::text)
     FROM public.tournament_categories c WHERE c.tournament_id = t.id) AS sports
FROM public.tournaments t;

GRANT SELECT ON public.organizer_history TO authenticated;

CREATE OR REPLACE VIEW public.organizer_reputation
WITH (security_invoker = on)
AS
WITH org_tourns AS (
  SELECT t.id, t.created_by, t.created_at, t.closed_at
  FROM public.tournaments t
)
SELECT
  ot.created_by AS organizer_user_id,
  count(*) FILTER (WHERE ot.closed_at IS NOT NULL) AS tournaments_closed,
  count(*) AS tournaments_total,
  COALESCE((
    SELECT count(*) FROM public.match_observation_outbox o
     WHERE o.status = 'emitted' AND o.verified_source = true
       AND o.tournament_match_id IN (
         SELECT m.id FROM public.tournament_matches m
          WHERE m.tournament_id IN (SELECT id FROM org_tourns ot2 WHERE ot2.created_by = ot.created_by)
       )
  ), 0) AS verified_matches,
  COALESCE((
    SELECT round(
      100.0 * count(*) FILTER (
        WHERE r.acceptance_a = 'accepted' AND r.acceptance_b = 'accepted'
      ) / NULLIF(count(*), 0)
    , 1)
    FROM public.tournament_matches r
    WHERE r.status = 'jugado'
      AND r.tournament_id IN (SELECT id FROM org_tourns ot2 WHERE ot2.created_by = ot.created_by)
  ), 0) AS confirmed_both_sides_pct,
  min(ot.created_at) AS first_tournament_at
FROM org_tourns ot
GROUP BY ot.created_by;

GRANT SELECT ON public.organizer_reputation TO authenticated;
