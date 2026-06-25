-- ÉPICA N · Espacios — seed demo (idempotente). Dos clubes para ver la pantalla
-- "pertenencia activa" poblada:
--   1. Club Providencia (TENIS) con escalerilla activa: demouser va #4 con 2 desafíos
--      pendientes (2 matches escalerilla 'pending').
--   2. Stade Français (PÁDEL) con torneo en fase de grupos: demouser inscrito con un
--      próximo partido (1 match torneo 'pending').
-- Reusa space/space_membership/space_standing/configs/matches. NO toca el motor.
-- Los nombres reales viven SOLO aquí (datos), nunca en diseño/capturas.
do $$
declare
  _me uuid; _p1 uuid; _p2 uuid; _p3 uuid; _p4 uuid;
  _club1 uuid; _esc uuid;
  _club2 uuid; _tour uuid; _cat uuid;
begin
  select id into _me from auth.users where email = 'demouser@aceplay.cl';
  if _me is null then return; end if;
  select id into _p1 from auth.users where email = 'demo01@demo.local';
  select id into _p2 from auth.users where email = 'demo02@demo.local';
  select id into _p3 from auth.users where email = 'demo03@demo.local';
  select id into _p4 from auth.users where email = 'demo04@demo.local';
  if _p1 is null or _p2 is null or _p3 is null or _p4 is null then return; end if;

  -- Idempotencia.
  if exists (select 1 from public.space where slug = 'club-providencia') then return; end if;

  -- ===== 1 · Club Providencia (tenis) + escalerilla, demouser #4 =====
  insert into public.space (type, path, name, slug, visibility, join_policy, sport, organizer_id, status)
  values ('club', 'club_providencia', 'Club Providencia', 'club-providencia', 'members', 'request', 'tennis', _me, 'active')
  returning id into _club1;

  insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
  values ('escalerilla', _club1, 'club_providencia.escalerilla', 'Escalerilla Tenis · Providencia', 'escalerilla-providencia', 'members', 'request', 'tennis', _me, 'active')
  returning id into _esc;
  insert into public.escalerilla_config (space_id, season_label) values (_esc, 'Temporada Demo 2026');

  -- Membresías (club + escalerilla) y posiciones: p1=1, p2=2, p3=3, demouser=4, p4=5.
  insert into public.space_membership (player_id, space_id, role, status) values
    (_me, _club1, 'player', 'active'), (_p1, _club1, 'player', 'active'), (_p2, _club1, 'player', 'active'),
    (_p3, _club1, 'player', 'active'), (_p4, _club1, 'player', 'active'),
    (_me, _esc, 'player', 'active'), (_p1, _esc, 'player', 'active'), (_p2, _esc, 'player', 'active'),
    (_p3, _esc, 'player', 'active'), (_p4, _esc, 'player', 'active')
  on conflict (player_id, space_id) do nothing;
  insert into public.space_standing (space_id, player_id, local_rank) values
    (_esc, _p1, 1), (_esc, _p2, 2), (_esc, _p3, 3), (_esc, _me, 4), (_esc, _p4, 5)
  on conflict (space_id, player_id) do update set local_rank = excluded.local_rank;

  -- 2 desafíos pendientes (demouser reta hacia arriba; matches escalerilla 'pending').
  insert into public.matches (sport, format, source_type, space_id, side_a, side_b, match_winner, played_at, verified_event, prestige_mult, confirmation_status, source_ref, recorded_by)
  values
    ('tennis', 'singles', 'escalerilla', _esc, array[_me], array[_p3], 'a', now(), false, 1.0, 'pending', '{}'::jsonb, _me),
    ('tennis', 'singles', 'escalerilla', _esc, array[_me], array[_p2], 'a', now(), false, 1.0, 'pending', '{}'::jsonb, _me);

  -- ===== 2 · Stade Français (pádel) + torneo en grupos, demouser inscrito + próximo =====
  insert into public.space (type, path, name, slug, visibility, join_policy, sport, organizer_id, status)
  values ('club', 'stade_francais', 'Stade Français', 'stade-francais', 'members', 'request', 'padel', _me, 'active')
  returning id into _club2;

  insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
  values ('tournament', _club2, 'stade_francais.torneo', 'Torneo Stade · Pádel', 'torneo-stade', 'members', 'request', 'padel', _me, 'active')
  returning id into _tour;

  insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
  values ('category', _tour, 'stade_francais.torneo.open', 'Categoría OPEN', 'cat-stade-open', 'members', 'request', 'padel', _me, 'active')
  returning id into _cat;
  insert into public.tournament_config (space_id, motor, disciplina, agendamiento, prestige_mult)
  values (_cat, 'groups_playoff', 'padel', 'fijo', 1.0);

  -- Inscripción al club y a la categoría (enrolled).
  insert into public.space_membership (player_id, space_id, role, status) values
    (_me, _club2, 'player', 'active'), (_p1, _club2, 'player', 'active'), (_p2, _club2, 'player', 'active'),
    (_me, _cat, 'player', 'active'), (_p1, _cat, 'player', 'active'), (_p2, _cat, 'player', 'active'), (_p3, _cat, 'player', 'active')
  on conflict (player_id, space_id) do nothing;

  -- Próximo partido (match torneo 'pending' con demouser).
  insert into public.matches (sport, format, source_type, space_id, side_a, side_b, match_winner, played_at, verified_event, prestige_mult, confirmation_status, source_ref, recorded_by)
  values ('padel', 'doubles', 'tournament', _cat, array[_me], array[_p1], 'a', now(), false, 1.0, 'pending', '{}'::jsonb, _p1);
end $$;

notify pgrst, 'reload schema';
