
CREATE OR REPLACE FUNCTION public.demo_protocol_seed()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_tenant uuid := public._demo_tenant_id();
  v_caller uuid := auth.uid();
  v_demouser uuid := public._demo_user_uid('demouser@aceplay.cl');
  v_created_bots int;
  v_errors jsonb := '[]'::jsonb;
  v_label text;
  v_result jsonb;
  v_recipe record;
BEGIN
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No existe tenant aceplay-demo'; END IF;

  IF v_caller IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_caller AND role IN ('club_admin'::app_role,'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado: requiere club_admin o super_admin';
  END IF;

  -- Asegura que demouser tenga rol del tenant demo (necesario para is_tournament_manager)
  IF v_demouser IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (v_demouser, v_tenant, 'club_admin'::app_role) ON CONFLICT DO NOTHING;
  END IF;

  PERFORM public.demo_protocol_wipe(false);

  v_created_bots := public.demo_seed_players(200);
  PERFORM public.demo_seed_courts();

  FOR v_recipe IN
    SELECT * FROM (VALUES
      ('Escalerilla mixta (A1·A2·E2)',  'round_robin',        'desafio_libre', 'en_curso',   8,  'demouser@aceplay.cl'),
      ('Pádel dobles (A3)',             'americano_rotacion', 'admin',         'en_curso',   8,  'demouser@aceplay.cl'),
      ('Eliminación 8 (B1·C1)',         'eliminacion_simple', 'admin',         'en_curso',   8,  NULL),
      ('Cuadro congelado (B4)',         'eliminacion_simple', 'admin',         'congelado',  8,  NULL),
      ('Grupos + Playoff (D1)',         'grupos_playoff',     'admin',         'en_curso',   16, NULL),
      ('Doble eliminación (D3)',        'doble_eliminacion',  'admin',         'en_curso',   16, NULL),
      ('Consolación (D4)',              'consolacion',        'admin',         'en_curso',   16, NULL),
      ('Escalerilla cerrada (E1)',      'round_robin',        'desafio_libre', 'finalizado', 8,  'demouser@aceplay.cl'),
      ('Monstruo 32 (F1)',              'round_robin',        'desafio_libre', 'en_curso',   32, NULL)
    ) AS r(label, motor, scheduling, state, n, organizer)
  LOOP
    BEGIN
      PERFORM public._demo_seed_tournament(v_recipe.label, v_recipe.motor, v_recipe.scheduling, v_recipe.state, v_recipe.n, v_recipe.organizer);
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('label', v_recipe.label, 'motor', v_recipe.motor, 'error', SQLERRM);
    END;
  END LOOP;

  v_result := public.demo_protocol_status();
  v_result := v_result || jsonb_build_object('bots_created', v_created_bots, 'errors', v_errors);
  RETURN v_result;
END;
$$;
