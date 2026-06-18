DROP VIEW IF EXISTS public.round_robin_standings CASCADE;
DROP VIEW IF EXISTS public.americano_individual_standings CASCADE;

CREATE VIEW public.round_robin_standings AS
WITH played AS (
  SELECT
    tm.tournament_category_id,
    tm.tournament_group_id,
    tm.id AS match_id,
    tm.registration_a_id,
    tm.registration_b_id,
    tm.winner_registration_id,
    tm.score
  FROM public.tournament_matches tm
  WHERE tm.status = 'jugado'::public.match_status
    AND tm.registration_a_id IS NOT NULL
    AND tm.registration_b_id IS NOT NULL
),
sides AS (
  SELECT tournament_category_id, tournament_group_id, registration_a_id AS registration_id,
         (winner_registration_id = registration_a_id) AS won, score, 'a'::char AS side
  FROM played
  UNION ALL
  SELECT tournament_category_id, tournament_group_id, registration_b_id AS registration_id,
         (winner_registration_id = registration_b_id) AS won, score, 'b'::char AS side
  FROM played
),
acc AS (
  SELECT
    s.tournament_category_id,
    s.tournament_group_id,
    s.registration_id,
    s.won,
    COALESCE((
      SELECT SUM(CASE WHEN s.side='a' THEN COALESCE((e->>'a')::int,0) ELSE COALESCE((e->>'b')::int,0) END)
      FROM jsonb_array_elements(COALESCE(s.score->'sets', s.score)) AS e
      WHERE jsonb_typeof(COALESCE(s.score->'sets', s.score))='array'
    ),0) AS games_won,
    COALESCE((
      SELECT SUM(CASE WHEN s.side='a' THEN COALESCE((e->>'b')::int,0) ELSE COALESCE((e->>'a')::int,0) END)
      FROM jsonb_array_elements(COALESCE(s.score->'sets', s.score)) AS e
      WHERE jsonb_typeof(COALESCE(s.score->'sets', s.score))='array'
    ),0) AS games_lost,
    COALESCE((
      SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(s.score->'sets', s.score)) AS e
      WHERE jsonb_typeof(COALESCE(s.score->'sets', s.score))='array'
        AND ((s.side='a' AND COALESCE((e->>'a')::int,0) > COALESCE((e->>'b')::int,0))
          OR (s.side='b' AND COALESCE((e->>'b')::int,0) > COALESCE((e->>'a')::int,0)))
    ),0) AS sets_won,
    COALESCE((
      SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(s.score->'sets', s.score)) AS e
      WHERE jsonb_typeof(COALESCE(s.score->'sets', s.score))='array'
        AND ((s.side='a' AND COALESCE((e->>'a')::int,0) < COALESCE((e->>'b')::int,0))
          OR (s.side='b' AND COALESCE((e->>'b')::int,0) < COALESCE((e->>'a')::int,0)))
    ),0) AS sets_lost
  FROM sides s
)
SELECT
  a.tournament_category_id,
  a.tournament_group_id,
  a.registration_id,
  COUNT(*) FILTER (WHERE a.won)            AS matches_won,
  COUNT(*) FILTER (WHERE NOT a.won)        AS matches_lost,
  COUNT(*)                                  AS matches_played,
  COALESCE(SUM(a.sets_won),0)::int          AS sets_won,
  COALESCE(SUM(a.sets_lost),0)::int         AS sets_lost,
  COALESCE(SUM(a.games_won),0)::int         AS games_won,
  COALESCE(SUM(a.games_lost),0)::int        AS games_lost,
  (
    COUNT(*) FILTER (WHERE a.won) * COALESCE((tc.tiebreaker_weights->>'matches')::numeric,1)
    + COALESCE(SUM(a.sets_won),0)  * COALESCE((tc.tiebreaker_weights->>'sets')::numeric,0.1)
    + COALESCE(SUM(a.games_won),0) * COALESCE((tc.tiebreaker_weights->>'games')::numeric,0.01)
  )::numeric AS total_points
FROM acc a
JOIN public.tournament_categories tc ON tc.id = a.tournament_category_id
GROUP BY a.tournament_category_id, a.tournament_group_id, a.registration_id, tc.tiebreaker_weights;

CREATE VIEW public.americano_individual_standings AS
WITH match_sides AS (
  SELECT tm.tournament_category_id, tm.id AS match_id,
         tm.side_a_user_ids, tm.side_b_user_ids, tm.winner_side, tm.score
  FROM public.tournament_matches tm
  WHERE tm.phase = 'americano' AND tm.status='jugado'::public.match_status
    AND tm.side_a_user_ids IS NOT NULL AND tm.side_b_user_ids IS NOT NULL
),
per_user AS (
  SELECT ms.tournament_category_id, uid AS user_id, (ms.winner_side='a') AS won,
    COALESCE((SELECT SUM(COALESCE((e->>'a')::int,0)) FROM jsonb_array_elements(COALESCE(ms.score->'sets', ms.score)) e
              WHERE jsonb_typeof(COALESCE(ms.score->'sets', ms.score))='array'),0) AS games_won,
    COALESCE((SELECT SUM(COALESCE((e->>'b')::int,0)) FROM jsonb_array_elements(COALESCE(ms.score->'sets', ms.score)) e
              WHERE jsonb_typeof(COALESCE(ms.score->'sets', ms.score))='array'),0) AS games_lost
  FROM match_sides ms CROSS JOIN LATERAL unnest(ms.side_a_user_ids) AS uid
  UNION ALL
  SELECT ms.tournament_category_id, uid, (ms.winner_side='b'),
    COALESCE((SELECT SUM(COALESCE((e->>'b')::int,0)) FROM jsonb_array_elements(COALESCE(ms.score->'sets', ms.score)) e
              WHERE jsonb_typeof(COALESCE(ms.score->'sets', ms.score))='array'),0),
    COALESCE((SELECT SUM(COALESCE((e->>'a')::int,0)) FROM jsonb_array_elements(COALESCE(ms.score->'sets', ms.score)) e
              WHERE jsonb_typeof(COALESCE(ms.score->'sets', ms.score))='array'),0)
  FROM match_sides ms CROSS JOIN LATERAL unnest(ms.side_b_user_ids) AS uid
)
SELECT tournament_category_id, user_id,
  COUNT(*) AS matches_played,
  COUNT(*) FILTER (WHERE won) AS matches_won,
  COALESCE(SUM(games_won),0)::int AS games_won,
  COALESCE(SUM(games_lost),0)::int AS games_lost
FROM per_user
GROUP BY tournament_category_id, user_id;

GRANT SELECT ON public.round_robin_standings TO authenticated, service_role;
GRANT SELECT ON public.americano_individual_standings TO authenticated, service_role;