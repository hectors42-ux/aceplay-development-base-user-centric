
WITH base AS (
  SELECT pr.user_id, pr.tenant_id, pr.level AS final_level
  FROM public.player_ratings pr
  WHERE pr.sport = 'tenis_singles'
    AND pr.tenant_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.rating_history rh
      WHERE rh.user_id = pr.user_id
        AND rh.sport = 'tenis_singles'
        AND rh.source = 'admin_adjustment'
    )
),
series AS (
  SELECT b.user_id, b.tenant_id, b.final_level,
         gs AS idx,
         ((('x' || substr(md5(b.user_id::text || gs::text), 1, 8))::bit(32)::int % 41) - 18) / 100.0 AS delta
  FROM base b, generate_series(1, 8) gs
),
chained AS (
  SELECT s.user_id, s.tenant_id, s.idx, s.delta,
         s.final_level - COALESCE(SUM(s.delta) OVER (
           PARTITION BY s.user_id ORDER BY s.idx
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         ), 0) AS level_after_walk
  FROM series s
)
INSERT INTO public.rating_history (
  tenant_id, user_id, sport, level_before, level_after, delta,
  reliability_before, reliability_after, source, recorded_at, notes
)
SELECT
  c.tenant_id,
  c.user_id,
  'tenis_singles'::rating_sport,
  ROUND((c.level_after_walk - c.delta)::numeric, 2),
  ROUND(c.level_after_walk::numeric, 2),
  ROUND(c.delta::numeric, 2),
  LEAST(100, 30 + (8 - c.idx) * 6),
  LEAST(100, 30 + (8 - c.idx) * 6 + 2),
  'admin_adjustment'::rating_change_source,
  now() - ((c.idx * 5) || ' days')::interval - (random() * interval '6 hours'),
  'Seed histórico tenis singles para demo'
FROM chained c;
