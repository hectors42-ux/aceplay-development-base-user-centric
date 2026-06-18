\i supabase/tests/setup.sql

BEGIN;
SELECT plan(6);

-- 1. evaluate_dominant_rule: 6-1,4-1 con umbrales por defecto → applies=true
SELECT is(
  (
    SELECT (public.evaluate_dominant_rule(
      '[{"a":6,"b":1},{"a":4,"b":1}]'::jsonb,
      '{"min_total_games":10,"lead_min_games":4,"loser_max_share":0.5}'::jsonb
    )->>'applies')::boolean
  ),
  true,
  'dominante aplica con 6-1,4-1'
);

-- 2. evaluate_dominant_rule: set 2 empatado → no aplica (no_leading_set2).
SELECT is(
  (
    SELECT (public.evaluate_dominant_rule(
      '[{"a":6,"b":4},{"a":3,"b":3}]'::jsonb,
      '{"min_total_games":10,"lead_min_games":4,"loser_max_share":0.5}'::jsonb
    )->>'applies')::boolean
  ),
  false,
  'dominante NO aplica si el set 2 va empatado'
);

-- 3. Umbrales no hardcodeados: con set 1 muy ajustado y umbrales por defecto NO aplica;
--    con umbrales más laxos sí aplica (jsonb gobierna, no constante hardcoded).
SELECT is(
  (
    SELECT (public.evaluate_dominant_rule(
      '[{"a":6,"b":5},{"a":2,"b":1}]'::jsonb,
      '{"min_total_games":10,"lead_min_games":4,"loser_max_share":0.5}'::jsonb
    )->>'applies')::boolean
  ),
  false,
  'dominante NO aplica con umbrales por defecto sobre score ajustado'
);

SELECT is(
  (
    SELECT (public.evaluate_dominant_rule(
      '[{"a":6,"b":5},{"a":2,"b":1}]'::jsonb,
      '{"min_total_games":3,"lead_min_games":1,"loser_max_share":0.9}'::jsonb
    )->>'applies')::boolean
  ),
  true,
  'mismo score aplica si bajamos los umbrales (jsonb gobierna)'
);

-- 4. toggle_registration_fee actualiza fee_paid_at sobre la inscripción.
DO $$
DECLARE v_reg uuid; v_cat uuid; v_tenant uuid := public._qa_tenant_id();
BEGIN
  PERFORM public._qa_impersonate(public._qa_admin_uid());

  SELECT r.id, r.tournament_category_id INTO v_reg, v_cat
    FROM public.tournament_registrations r
    JOIN public.tournament_categories tc ON tc.id = r.tournament_category_id
   WHERE tc.tenant_id = v_tenant
   LIMIT 1;

  PERFORM public.toggle_registration_fee(v_reg, true, 'efectivo');
  PERFORM set_config('qa.reg_paid', v_reg::text, true);
END $$;

SELECT isnt(
  (SELECT fee_paid_at FROM public.tournament_registrations
    WHERE id = current_setting('qa.reg_paid')::uuid)::text,
  NULL,
  'toggle_registration_fee(paid=true) marca fee_paid_at'
);

-- 5. toggle_registration_fee(false) revierte fee_paid_at a NULL.
DO $$
BEGIN
  PERFORM public._qa_impersonate(public._qa_admin_uid());
  PERFORM public.toggle_registration_fee(current_setting('qa.reg_paid')::uuid, false, NULL);
END $$;

SELECT is(
  (SELECT fee_paid_at FROM public.tournament_registrations
    WHERE id = current_setting('qa.reg_paid')::uuid),
  NULL::timestamptz,
  'toggle_registration_fee(paid=false) limpia fee_paid_at'
);

SELECT * FROM finish();
ROLLBACK;