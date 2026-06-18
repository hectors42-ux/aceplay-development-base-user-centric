\i supabase/tests/setup.sql

BEGIN;
SELECT plan(4);

-- 1. Cada match jugado en el mundo QA tiene exactamente 1 observación emitted.
SELECT is(
  (
    SELECT COUNT(*)::int FROM (
      SELECT tm.id, COUNT(o.id) c
        FROM public.tournament_matches tm
        JOIN public.tournament_categories tc ON tc.id = tm.tournament_category_id
        LEFT JOIN public.match_observation_outbox o
               ON o.tournament_match_id = tm.id AND o.status='emitted'
       WHERE tc.tenant_id = public._qa_tenant_id()
         AND tm.status = 'jugado'::public.match_status
         AND tm.walkover = false
       GROUP BY tm.id
      HAVING COUNT(o.id) <> 1
    ) x
  ),
  0,
  'cada match jugado tiene exactamente 1 observación emitted'
);

-- 2. Las observaciones de torneos QA tienen source_type='tournament' (no hay escalerilla seedeada).
SELECT is(
  (
    SELECT COUNT(DISTINCT source_type)::int
      FROM public.match_observation_outbox o
      JOIN public.tournament_matches tm ON tm.id = o.tournament_match_id
      JOIN public.tournament_categories tc ON tc.id = tm.tournament_category_id
     WHERE tc.tenant_id = public._qa_tenant_id()
       AND o.status='emitted'
       AND COALESCE(tc.preset_key,'') <> 'escalerilla'
  ),
  1,
  'todos los torneos QA (no-escalerilla) usan source_type tournament'
);

SELECT is(
  (
    SELECT MAX(source_type)
      FROM public.match_observation_outbox o
      JOIN public.tournament_matches tm ON tm.id = o.tournament_match_id
      JOIN public.tournament_categories tc ON tc.id = tm.tournament_category_id
     WHERE tc.tenant_id = public._qa_tenant_id()
       AND o.status='emitted'
       AND COALESCE(tc.preset_key,'') <> 'escalerilla'
  ),
  'tournament',
  'source_type = tournament para torneos normales'
);

-- 3. Idempotencia: re-llamar emit_match_observation no duplica filas emitted.
DO $$
DECLARE v_match uuid;
BEGIN
  SELECT tm.id INTO v_match
    FROM public.tournament_matches tm
    JOIN public.tournament_categories tc ON tc.id = tm.tournament_category_id
   WHERE tc.tenant_id = public._qa_tenant_id()
     AND tm.status = 'jugado'
   LIMIT 1;
  PERFORM public.emit_match_observation(v_match);
  PERFORM public.emit_match_observation(v_match);
  PERFORM set_config('qa.match_id', v_match::text, true);
END $$;

SELECT is(
  (SELECT COUNT(*)::int FROM public.match_observation_outbox
    WHERE tournament_match_id = current_setting('qa.match_id')::uuid
      AND status='emitted'),
  1,
  'idempotencia: emitir 2 veces deja 1 sola fila emitted'
);

SELECT * FROM finish();
ROLLBACK;