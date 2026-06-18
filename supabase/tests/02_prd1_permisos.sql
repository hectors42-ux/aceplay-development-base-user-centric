\i supabase/tests/setup.sql

BEGIN;
SELECT plan(4);

-- Preparamos 3 roles QA bajo el mismo tenant: club_admin, organizador, member.
DO $$
DECLARE
  v_tenant uuid := public._qa_tenant_id();
  v_admin uuid;
  v_organizador uuid;
  v_organizador_otro uuid;
  v_member uuid;
  v_tour uuid;
BEGIN
  -- Reutilizamos jugadores QA existentes.
  SELECT user_id INTO v_admin
    FROM public.profiles p
   WHERE p.tenant_id = v_tenant AND p.email LIKE 'qa%@aceplay.test'
   ORDER BY p.email LIMIT 1 OFFSET 0;
  SELECT user_id INTO v_organizador
    FROM public.profiles p
   WHERE p.tenant_id = v_tenant AND p.email LIKE 'qa%@aceplay.test'
   ORDER BY p.email LIMIT 1 OFFSET 1;
  SELECT user_id INTO v_organizador_otro
    FROM public.profiles p
   WHERE p.tenant_id = v_tenant AND p.email LIKE 'qa%@aceplay.test'
   ORDER BY p.email LIMIT 1 OFFSET 2;
  SELECT user_id INTO v_member
    FROM public.profiles p
   WHERE p.tenant_id = v_tenant AND p.email LIKE 'qa%@aceplay.test'
   ORDER BY p.email LIMIT 1 OFFSET 3;

  INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (v_admin, v_tenant, 'club_admin'::public.app_role) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (v_organizador, v_tenant, 'organizador'::public.app_role) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (v_organizador_otro, v_tenant, 'organizador'::public.app_role) ON CONFLICT DO NOTHING;

  -- Crear un torneo cuyo created_by es v_organizador (otro org no puede tocarlo).
  INSERT INTO public.tournaments (tenant_id, name, slug, registration_opens_at,
    registration_closes_at, starts_at, ends_at, status, created_by, default_config)
  VALUES (v_tenant, '[QA-PERM] organizador-owned', 'qa-perm-organizador-' || substr(md5(random()::text),1,6),
          now()-interval'1 day', now()+interval'1 day', now()+interval'2 days',
          now()+interval'30 days', 'inscripciones_abiertas'::tournament_status,
          v_organizador, '{}'::jsonb)
  RETURNING id INTO v_tour;

  PERFORM set_config('qa.admin_uid', v_admin::text, true);
  PERFORM set_config('qa.organizador_uid', v_organizador::text, true);
  PERFORM set_config('qa.organizador_otro_uid', v_organizador_otro::text, true);
  PERFORM set_config('qa.member_uid', v_member::text, true);
  PERFORM set_config('qa.tenant_id', v_tenant::text, true);
  PERFORM set_config('qa.tour_id', v_tour::text, true);
END $$;

-- 1. can_create_tournament: true para club_admin/organizador, false para member.
SELECT public._qa_impersonate(current_setting('qa.admin_uid')::uuid);
SELECT is(
  public.can_create_tournament(current_setting('qa.tenant_id')::uuid),
  true,
  'can_create_tournament: true para club_admin'
);

SELECT public._qa_impersonate(current_setting('qa.member_uid')::uuid);
SELECT is(
  public.can_create_tournament(current_setting('qa.tenant_id')::uuid),
  false,
  'can_create_tournament: false para member sin rol'
);

-- 2. is_tournament_manager: true para created_by; false para otro organizador.
SELECT public._qa_impersonate(current_setting('qa.organizador_uid')::uuid);
SELECT is(
  public.is_tournament_manager(current_setting('qa.tour_id')::uuid),
  true,
  'is_tournament_manager: true para el created_by organizador'
);

SELECT public._qa_impersonate(current_setting('qa.organizador_otro_uid')::uuid);
SELECT is(
  public.is_tournament_manager(current_setting('qa.tour_id')::uuid),
  false,
  'is_tournament_manager: false para otro organizador del mismo tenant'
);

SELECT * FROM finish();
ROLLBACK;