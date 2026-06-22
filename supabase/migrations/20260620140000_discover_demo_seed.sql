-- FASE 5 (Part C): seed de OTROS clubes (distintos del AcePlay Demo Club) para poblar Descubrir
-- con oportunidades públicas cross-club. Cada club: 1 torneo público (round_robin) + 1 escalerilla
-- pública. Los torneos se siembran SIN bracket y SIN demouser, para que la demo muestre a demouser
-- descubriendo, inscribiéndose y jugando. Cero tenant_id. Idempotente por slug de club.
do $$
declare _club uuid; _t uuid; _c uuid; _e uuid; _org uuid;
begin
  -- ===================== CLUB NORTE (organizer demo08) =====================
  if not exists (select 1 from public.space where slug = 'club-norte') then
    select id into _org from auth.users where email = 'demo08@demo.local';
    insert into public.space (type, path, name, slug, visibility, join_policy, organizer_id, status, settings)
    values ('club', 'club_norte', 'Club Norte', 'club-norte', 'hierarchy', 'request', _org, 'active', '{}'::jsonb)
    returning id into _club;
    insert into public.space_membership (player_id, space_id, role, status)
    values (_org, _club, 'organizer', 'active') on conflict (player_id, space_id) do nothing;

    -- Torneo público de pádel (round robin).
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, organizer_id, status, settings)
    values ('tournament', _club, 'club_norte.abierto_norte', 'Abierto Norte', 'abierto-norte', 'public', 'request', _org, 'active',
            jsonb_build_object('starts_at', (now() + interval '5 days')::text))
    returning id into _t;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_t, 'round_robin', 'manual', 'padel', 'best_of_3', 'puntual', 1.0);
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status, settings)
    values ('category', _t, 'club_norte.abierto_norte.open', 'Categoría OPEN', 'abierto-norte-open', 'public', 'request', 'padel', _org, 'active',
            jsonb_build_object('level_label', 'Abierto', 'max_players', 8))
    returning id into _c;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_c, 'round_robin', 'manual', 'padel', 'best_of_3', 'puntual', 1.0);
    insert into public.space_membership (player_id, space_id, role, status)
      select id, _c, 'player', 'active' from auth.users where email in ('demo09@demo.local','demo10@demo.local','demo11@demo.local')
      on conflict (player_id, space_id) do nothing;

    -- Escalerilla pública de tenis.
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status, settings)
    values ('escalerilla', _club, 'club_norte.escalerilla_norte', 'Escalerilla Norte', 'escalerilla-norte', 'public', 'request', 'tennis', _org, 'active',
            jsonb_build_object('level_label', 'Todos los niveles'))
    returning id into _e;
    insert into public.escalerilla_config (space_id, pyramid, challenge_rules) values (_e, '{}', '{}');
    insert into public.space_membership (player_id, space_id, role, status)
      select id, _e, 'player', 'active' from auth.users where email in ('demo12@demo.local','demo13@demo.local')
      on conflict (player_id, space_id) do nothing;
    insert into public.space_standing (space_id, player_id, local_rank, local_state)
      select _e, id, row_number() over (order by email), '{"status":"active"}'::jsonb
      from auth.users where email in ('demo12@demo.local','demo13@demo.local')
      on conflict (space_id, player_id) do nothing;
  end if;

  -- ===================== CLUB SUR (organizer demo14) =====================
  if not exists (select 1 from public.space where slug = 'club-sur') then
    select id into _org from auth.users where email = 'demo14@demo.local';
    insert into public.space (type, path, name, slug, visibility, join_policy, organizer_id, status, settings)
    values ('club', 'club_sur', 'Club Sur', 'club-sur', 'hierarchy', 'request', _org, 'active', '{}'::jsonb)
    returning id into _club;
    insert into public.space_membership (player_id, space_id, role, status)
    values (_org, _club, 'organizer', 'active') on conflict (player_id, space_id) do nothing;

    -- Torneo público de tenis (round robin).
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, organizer_id, status, settings)
    values ('tournament', _club, 'club_sur.open_sur', 'Open Sur', 'open-sur', 'public', 'request', _org, 'active',
            jsonb_build_object('starts_at', (now() + interval '9 days')::text))
    returning id into _t;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_t, 'round_robin', 'manual', 'tennis', 'best_of_3', 'puntual', 1.0);
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status, settings)
    values ('category', _t, 'club_sur.open_sur.open', 'Categoría OPEN', 'open-sur-open', 'public', 'request', 'tennis', _org, 'active',
            jsonb_build_object('level_label', 'Abierto', 'max_players', 8))
    returning id into _c;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_c, 'round_robin', 'manual', 'tennis', 'best_of_3', 'puntual', 1.0);
    insert into public.space_membership (player_id, space_id, role, status)
      select id, _c, 'player', 'active' from auth.users where email in ('demo15@demo.local','demo16@demo.local','demo01@demo.local')
      on conflict (player_id, space_id) do nothing;

    -- Escalerilla pública de pádel.
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status, settings)
    values ('escalerilla', _club, 'club_sur.escalerilla_sur', 'Escalerilla Sur', 'escalerilla-sur', 'public', 'request', 'padel', _org, 'active',
            jsonb_build_object('level_label', 'Intermedio'))
    returning id into _e;
    insert into public.escalerilla_config (space_id, pyramid, challenge_rules) values (_e, '{}', '{}');
    insert into public.space_membership (player_id, space_id, role, status)
      select id, _e, 'player', 'active' from auth.users where email in ('demo02@demo.local','demo03@demo.local')
      on conflict (player_id, space_id) do nothing;
    insert into public.space_standing (space_id, player_id, local_rank, local_state)
      select _e, id, row_number() over (order by email), '{"status":"active"}'::jsonb
      from auth.users where email in ('demo02@demo.local','demo03@demo.local')
      on conflict (space_id, player_id) do nothing;
  end if;
end $$;

notify pgrst, 'reload schema';
