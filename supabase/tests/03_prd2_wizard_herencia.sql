\i supabase/tests/setup.sql

BEGIN;
SELECT plan(3);

-- Crear un torneo con default_config y dos categorías hermanas para testear herencia.
DO $$
DECLARE v_tenant uuid := public._qa_tenant_id(); v_tour uuid; v_cat_a uuid; v_cat_b uuid;
BEGIN
  INSERT INTO public.tournaments (tenant_id, name, slug, registration_opens_at,
    registration_closes_at, starts_at, ends_at, status, created_by, default_config)
  VALUES (v_tenant, '[QA-WIZ] herencia', 'qa-wiz-' || substr(md5(random()::text),1,6),
          now()-interval'1 day', now()+interval'1 day', now()+interval'2 days',
          now()+interval'30 days', 'inscripciones_abiertas'::tournament_status,
          public._qa_admin_uid(),
          jsonb_build_object('scoring', jsonb_build_object('format','bo3','super_tb_at',1,'super_tb_points',10)))
  RETURNING id INTO v_tour;

  INSERT INTO public.tournament_categories (tournament_id, tenant_id, name, sport, modality, motor)
  VALUES (v_tour, v_tenant, 'cat-a', 'tenis', 'singles', 'round_robin')
  RETURNING id INTO v_cat_a;
  INSERT INTO public.tournament_categories (tournament_id, tenant_id, name, sport, modality, motor, preset_key)
  VALUES (v_tour, v_tenant, 'cat-b', 'tenis', 'singles', 'round_robin', 'escalerilla')
  RETURNING id INTO v_cat_b;

  PERFORM set_config('qa.tour_id', v_tour::text, true);
  PERFORM set_config('qa.cat_a', v_cat_a::text, true);
  PERFORM set_config('qa.cat_b', v_cat_b::text, true);
END $$;

-- 1. Categoría sin scoring propio hereda del default_config del torneo.
SELECT is(
  (SELECT COALESCE(tc.config->'scoring', t.default_config->'scoring')->>'format'
     FROM public.tournament_categories tc
     JOIN public.tournaments t ON t.id = tc.tournament_id
    WHERE tc.id = current_setting('qa.cat_a')::uuid),
  'bo3',
  'categoría sin scoring propio resuelve al default_config del torneo'
);

-- 2. Cambiar preset de una categoría no altera el de la hermana.
UPDATE public.tournament_categories
   SET preset_key = 'media_jornada'
 WHERE id = current_setting('qa.cat_a')::uuid;

SELECT is(
  (SELECT preset_key FROM public.tournament_categories WHERE id = current_setting('qa.cat_b')::uuid),
  'escalerilla',
  'cambiar preset en una categoría no toca a la hermana'
);

-- 3. INSERT con (padel, singles) sigue fallando dentro de este torneo.
SELECT throws_like(
  format('INSERT INTO public.tournament_categories (tournament_id, tenant_id, name, sport, modality, motor)
          VALUES (%L, %L, %L, %L, %L, %L)',
          current_setting('qa.tour_id'),
          public._qa_tenant_id(),
          'padel-bad',
          'padel', 'singles', 'round_robin'),
  '%chk_padel_es_dobles%',
  'padel-singles bloqueado a nivel de constraint en cualquier torneo'
);

SELECT * FROM finish();
ROLLBACK;