-- GEMELO DIGITAL · Escalerilla Round Robin (Club de Tenis Providencia, 1ra Fase).
-- 30 jugadores reales (display = nombre + inicial; SIN email/telefono · Ley 21.719),
-- 51 partidos del log de control, sobre el motor RR roster (Fase A) — firewall:
-- los roster_players NO tienen rating global; su puntaje vive solo en el torneo.
-- demouser se agrega al FINAL (participante #31, 0 partidos -> no altera a nadie) y
-- como ORGANIZADOR. Idempotente. Bajo Club Providencia (limpio).
do $$
declare
  _club uuid; _org uuid; _me uuid; _tour uuid; _cat uuid;
  _p uuid[] := '{}'; _id uuid; _name text; _m uuid; _demo uuid;
  _spec jsonb; _set jsonb; _si int;
  _names text[] := array['Jesús E.', 'Javier A.', 'Ignacio B.', 'Leonardo S.', 'Joaquín G.', 'Claudio H.', 'Sergio O.', 'Gabriel M.', 'Ignacio V.', 'Francisco R.', 'Carlos S.', 'Francisco B.', 'Sebastián D.', 'Juan José S.', 'Alejandro G.', 'Danilo C.', 'Denis P.', 'Cristian F.', 'Sebastián J.', 'Francisco G.', 'Gonzalo L.', 'Leo M.', 'Sergio F.', 'Héctor H.', 'Gonzalo J.', 'Julio C.', 'Nicolae P.', 'Patricio R.', 'Jorge M.', 'Iván P.'];
  -- [a_idx, b_idx, winner_idx, retiro(0/1), [[ga,gb,is_tb?],...]]
  _specs jsonb := '[[16,7,16,0,[[3,6,false],[6,2,false],[10,6,true]]],[7,17,7,0,[[6,0,false],[5,7,false],[10,7,true]]],[8,27,8,1,[[6,2,false],[2,3,false]]],[19,30,19,0,[[6,4,false],[6,2,false]]],[23,11,23,0,[[4,6,false],[6,3,false],[10,2,true]]],[3,7,3,0,[[6,3,false],[6,0,false]]],[5,17,5,0,[[6,1,false],[3,6,false],[10,5,true]]],[25,29,25,0,[[2,6,false],[6,3,false],[10,7,true]]],[7,20,7,0,[[6,3,false],[6,1,false]]],[21,17,21,0,[[6,3,false],[6,3,false]]],[5,23,5,0,[[6,2,false],[6,4,false]]],[20,22,20,0,[[5,7,false],[6,0,false],[10,8,true]]],[26,29,26,0,[[5,7,false],[7,5,false],[10,1,true]]],[7,29,7,0,[[6,0,false],[6,4,false]]],[25,26,25,0,[[6,3,false],[6,1,false]]],[23,22,23,0,[[7,5,false],[6,3,false]]],[1,12,1,0,[[6,4,false],[6,2,false]]],[25,30,25,0,[[6,1,false],[6,4,false]]],[9,7,9,0,[[6,3,false],[3,6,false],[10,2,true]]],[5,29,5,0,[[6,0,false],[6,4,false]]],[4,12,4,0,[[6,3,false],[6,3,false]]],[19,23,19,0,[[6,7,false],[6,1,false],[10,7,true]]],[6,10,6,0,[[6,1,false],[6,1,false]]],[30,26,30,0,[[6,1,false],[2,6,false],[11,9,true]]],[23,26,23,0,[[7,5,false],[6,4,false]]],[12,7,12,0,[[6,1,false],[6,1,false]]],[20,17,20,0,[[4,6,false],[6,3,false],[10,6,true]]],[3,10,3,0,[[6,0,false],[6,4,false]]],[4,24,4,0,[[6,2,false],[6,3,false]]],[19,26,19,0,[[6,1,false],[6,2,false]]],[9,23,9,0,[[6,0,false],[6,0,false]]],[12,11,12,0,[[6,0,false],[4,6,false],[10,7,true]]],[4,5,4,0,[[2,6,false],[6,2,false],[10,6,true]]],[9,29,9,0,[[6,0,false],[6,2,false]]],[7,19,7,0,[[6,4,false],[2,6,false],[10,2,true]]],[2,6,2,0,[[7,5,false],[6,3,false]]],[19,20,19,0,[[6,3,false],[6,1,false]]],[27,26,27,0,[[6,0,false],[6,0,false]]],[16,24,16,0,[[6,2,false],[6,4,false]]],[6,25,6,0,[[6,1,false],[7,6,false]]],[19,29,19,0,[[6,1,false],[6,4,false]]],[3,12,3,0,[[6,3,false],[6,3,false]]],[19,25,19,0,[[6,3,false],[6,4,false]]],[9,17,9,0,[[6,1,false],[6,0,false]]],[3,8,3,0,[[6,1,false],[6,3,false]]],[17,29,17,0,[[7,6,false],[4,6,false],[10,8,true]]],[24,11,24,0,[[6,1,false],[3,6,false],[10,7,true]]],[19,11,19,0,[[7,6,false],[6,4,false]]],[2,17,2,0,[[6,1,false],[6,1,false]]],[9,18,9,0,[[6,2,false],[6,0,false]]],[4,6,4,0,[[6,4,false],[4,6,false],[10,5,true]]]]'::jsonb;
begin
  select id, organizer_id into _club, _org from public.space where slug = 'club-providencia' and type = 'club';
  if _club is null then raise notice 'club-providencia no existe'; return; end if;
  select id into _me from auth.users where email = 'demouser@aceplay.cl';

  select id into _tour from public.space where slug = 'rr-providencia-2026' and parent_space_id = _club;
  if _tour is null then
    insert into public.space (type, parent_space_id, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('tournament', _club, 'Escalerilla Round Robin · 1ra Fase', 'rr-providencia-2026', 'members', 'request', null, _org, 'active')
    returning id into _tour;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_tour, 'round_robin', 'manual', 'tennis', 'best_of_3', 'puntual', 1.0);
  end if;
  select id into _cat from public.space where slug = 'cat-rr-providencia-2026' and parent_space_id = _tour;
  if _cat is null then
    insert into public.space (type, parent_space_id, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('category', _tour, 'Grupo único', 'cat-rr-providencia-2026', 'members', 'request', 'tennis', _org, 'active')
    returning id into _cat;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_cat, 'round_robin', 'manual', 'tennis', 'best_of_3', 'puntual', 1.0);
  end if;

  if exists (select 1 from public.rr_participant where category_id = _cat) then raise notice 'ya seedeado'; return; end if;

  foreach _name in array _names loop
    insert into public.roster_players (club_id, display_name, source) values (_club, _name, 'manual') returning id into _id;
    _p := _p || _id;
    insert into public.rr_participant (category_id, roster_player_id) values (_cat, _id);
  end loop;

  for _spec in select value from jsonb_array_elements(_specs) loop
    insert into public.rr_match (category_id, player_a, player_b, winner, played_at)
    values (_cat, _p[(_spec->>0)::int], _p[(_spec->>1)::int], _p[(_spec->>2)::int], now())
    returning id into _m;
    _si := 0;
    for _set in select value from jsonb_array_elements(_spec->4) loop
      insert into public.rr_match_set (rr_match_id, set_index, games_a, games_b, is_tiebreak)
      values (_m, _si, (_set->>0)::int, (_set->>1)::int, coalesce((_set->>2)::boolean, false));
      _si := _si + 1;
    end loop;
  end loop;

  if _me is not null then
    insert into public.roster_players (club_id, display_name, source, claimed_by)
    values (_club, 'Demo User', 'manual', _me) returning id into _demo;
    insert into public.rr_participant (category_id, roster_player_id) values (_cat, _demo);
    insert into public.space_membership (player_id, space_id, role, status) values (_me, _tour, 'organizer', 'active')
      on conflict (player_id, space_id) do update set role='organizer', status='active';
    insert into public.space_membership (player_id, space_id, role, status) values (_me, _cat, 'organizer', 'active')
      on conflict (player_id, space_id) do update set role='organizer', status='active';
    insert into public.space_membership (player_id, space_id, role, status) values (_me, _club, 'organizer', 'active')
      on conflict (player_id, space_id) do update set role='organizer', status='active';
  end if;
  raise notice 'gemelo cargado: % jugadores + demouser, % partidos', array_length(_p,1), jsonb_array_length(_specs);
end $$;

notify pgrst, 'reload schema';
