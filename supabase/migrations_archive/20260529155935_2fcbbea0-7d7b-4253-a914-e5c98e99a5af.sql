DO $$
DECLARE
  v_tenant uuid := 'ad61e9b5-2107-4b44-b9d6-f87ebd41ec1d';
  v_admin  uuid := '9c3e5ef5-4635-4bde-8820-024eaa1aac9a';
  v_ladder uuid;
  v_demo   uuid := 'e1b1724e-71f4-455b-9482-350ef950fdc8';
  v_hector uuid := 'afdfa252-f446-435b-bbf2-237f4da03376';
  v_bruno  uuid := 'e04b6339-6dbc-4bec-9656-9740d4b77dbf';
  v_cam    uuid := 'd8162e3e-3928-4de5-a97e-8a32a8ded2af';
  v_anto   uuid := 'e817e629-ac4f-4f17-be8e-13eed3928072';
  v_lucas  uuid := 'ccd4a6d9-9216-40fa-a4c3-3bb49839b9de';
BEGIN
  SELECT id INTO v_ladder FROM ladders
   WHERE tenant_id = v_tenant AND name = 'La Staderilla Pádel Verano 2026';

  IF v_ladder IS NULL THEN
    INSERT INTO ladders (
      tenant_id, name, description, discipline, gender, surface, is_active,
      season_starts_at, season_ends_at, challenge_window_days, response_window_hours,
      max_position_jump, cooldown_days, loser_drops_position,
      inactivity_days, inactivity_drop_positions, result_validation_mode, created_by
    ) VALUES (
      v_tenant, 'La Staderilla Pádel Verano 2026',
      'Pirámide oficial de pádel dobles - QA fase 3',
      'padel_dobles', 'mixto', 'sintetico', true,
      '2026-01-01', '2026-04-30', 7, 48, 3, 2, true, 30, 1,
      'jugadores_con_confirmacion', v_admin
    ) RETURNING id INTO v_ladder;

    INSERT INTO ladder_positions (tenant_id, ladder_id, user_id, position, status, joined_at) VALUES
      (v_tenant, v_ladder, v_bruno,  1, 'activo', now()),
      (v_tenant, v_ladder, v_hector, 2, 'activo', now()),
      (v_tenant, v_ladder, v_cam,    3, 'activo', now()),
      (v_tenant, v_ladder, v_demo,   4, 'activo', now()),
      (v_tenant, v_ladder, v_anto,   5, 'activo', now()),
      (v_tenant, v_ladder, v_lucas,  6, 'activo', now());
  END IF;
END $$;