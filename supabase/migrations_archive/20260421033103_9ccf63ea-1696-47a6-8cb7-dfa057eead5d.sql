-- Sincronizar matches_played, last_match_at y level con el historial real
UPDATE public.player_ratings pr
SET matches_played = sub.total,
    last_match_at = sub.last_at,
    level = sub.last_level,
    reliability = LEAST(sub.last_rel, 96),
    last_change_delta = sub.last_delta,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (sport)
    sport,
    COUNT(*) OVER (PARTITION BY sport) AS total,
    MAX(recorded_at) OVER (PARTITION BY sport) AS last_at,
    FIRST_VALUE(level_after) OVER (PARTITION BY sport ORDER BY recorded_at DESC) AS last_level,
    FIRST_VALUE(reliability_after) OVER (PARTITION BY sport ORDER BY recorded_at DESC) AS last_rel,
    FIRST_VALUE(delta) OVER (PARTITION BY sport ORDER BY recorded_at DESC) AS last_delta
  FROM public.rating_history
  WHERE user_id = '9337315f-3e13-4cbe-80cd-0561d4781a68'
) sub
WHERE pr.user_id = '9337315f-3e13-4cbe-80cd-0561d4781a68'
  AND pr.sport::text = sub.sport::text;

-- Sincronizar wins/losses en ladder_positions de Héctor para tenis singles
UPDATE public.ladder_positions lp
SET wins = sub.wins,
    losses = sub.losses,
    last_played_at = sub.last_at,
    updated_at = now()
FROM (
  SELECT
    SUM(CASE WHEN delta > 0 THEN 1 ELSE 0 END)::int AS wins,
    SUM(CASE WHEN delta < 0 THEN 1 ELSE 0 END)::int AS losses,
    MAX(recorded_at) AS last_at
  FROM public.rating_history
  WHERE user_id = '9337315f-3e13-4cbe-80cd-0561d4781a68'
    AND sport = 'tenis_singles'
) sub
WHERE lp.user_id = '9337315f-3e13-4cbe-80cd-0561d4781a68';