\i supabase/tests/setup.sql

BEGIN;
SELECT plan(5);

-- 1. Ninguna categoría (padel, singles).
SELECT is(
  (SELECT COUNT(*)::int FROM public.tournament_categories WHERE sport='padel' AND modality='singles'),
  0,
  'invariante: no existe ninguna categoría (padel, singles)'
);

-- 2. Cada tournament_match pertenece a UNA sola categoría (FK no nula y única por id).
SELECT is(
  (SELECT COUNT(*)::int FROM public.tournament_matches WHERE tournament_category_id IS NULL),
  0,
  'invariante: todo match tiene tournament_category_id'
);

-- 3. Todo match jugado (no walkover, con score) tiene >=1 observación 'emitted'.
SELECT is(
  (
    SELECT COUNT(*)::int FROM public.tournament_matches tm
    WHERE tm.status='jugado'::public.match_status
      AND tm.walkover = false
      AND tm.score IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.match_observation_outbox o
        WHERE o.tournament_match_id = tm.id AND o.status='emitted'
      )
  ),
  0,
  'firewall rating: cada match jugado tiene observación emitted'
);

-- 4. No hay jugador duplicado dentro de la misma categoría (sumando p1+p2 confirmadas).
SELECT is(
  (
    WITH usuarios AS (
      SELECT tournament_category_id, player1_user_id AS uid
        FROM public.tournament_registrations
       WHERE status='confirmada'::public.registration_status
      UNION ALL
      SELECT tournament_category_id, player2_user_id
        FROM public.tournament_registrations
       WHERE status='confirmada'::public.registration_status AND player2_user_id IS NOT NULL
    )
    SELECT COUNT(*)::int FROM (
      SELECT tournament_category_id, uid, COUNT(*) c
        FROM usuarios GROUP BY 1,2 HAVING COUNT(*) > 1
    ) dup
  ),
  0,
  'no hay jugadores duplicados en la misma categoría'
);

-- 5. Todos los scores guardados son jsonb estructurado válido:
--    - bracket/RR/grupos: array de sets [{a,b}, …]
--    - americano: objeto {games_a, games_b}
SELECT is(
  (
    SELECT COUNT(*)::int FROM public.tournament_matches
    WHERE score IS NOT NULL
      AND walkover = false
      AND (
        CASE
          WHEN phase = 'americano' THEN
            NOT (score ? 'games_a' AND score ? 'games_b')
          ELSE
            jsonb_typeof(COALESCE(score->'sets', score)) <> 'array'
        END
      )
  ),
  0,
  'todo score guardado tiene forma válida (array de sets o {games_a, games_b})'
);

SELECT * FROM finish();
ROLLBACK;