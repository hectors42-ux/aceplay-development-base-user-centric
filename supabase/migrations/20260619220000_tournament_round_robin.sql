-- FASE 4.2: round robin (todos contra todos). Same base as 4.1: reuses tournament_bracket as
-- the fixtures table, matches go through the engine (source_type=tournament + anti-farming),
-- space_standing is the LOCAL table for THIS format. apply_tournament_result becomes a dispatcher
-- keyed by the category's tournament_config.motor.

-- Single-elimination advancement, factored out of the old apply_tournament_result.
create or replace function public._apply_single_elim(_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.matches%rowtype; b public.tournament_bracket%rowtype; _w uuid; _l uuid;
begin
  select * into m from public.matches where id = _match_id;
  select * into b from public.tournament_bracket where match_id = _match_id;
  if not found or b.winner is not null then return; end if;
  _w := case when m.match_winner = 'a' then b.player_a else b.player_b end;
  _l := case when m.match_winner = 'a' then b.player_b else b.player_a end;
  update public.tournament_bracket set winner = _w, status = 'played' where id = b.id;
  update public.space_standing
     set local_state = local_state || jsonb_build_object('status', 'eliminated', 'round_reached', b.round), updated_at = now()
   where space_id = b.category_id and player_id = _l;
  perform public._advance_bracket(b.category_id, b.round, b.slot, _w);
end $$;

-- Round-robin standings: wins, then set difference, then head-to-head among equally-placed players.
create or replace function public._recompute_round_robin(_category_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    with confirmed as (
      select m.id, m.side_a[1] as a, m.side_b[1] as b, m.match_winner,
        (select count(*) from public.match_sets s where s.match_id = m.id and s.games_a > s.games_b) as sa,
        (select count(*) from public.match_sets s where s.match_id = m.id and s.games_b > s.games_a) as sb
      from public.matches m
      where m.space_id = _category_id and m.source_type = 'tournament' and m.confirmation_status = 'confirmed'
    ),
    pp as (
      select ss.player_id as uid,
        coalesce(sum(case when (c.a = ss.player_id and c.match_winner = 'a') or (c.b = ss.player_id and c.match_winner = 'b') then 1 else 0 end), 0) as wins,
        coalesce(count(c.id), 0) as played,
        coalesce(sum(case when c.a = ss.player_id then c.sa - c.sb when c.b = ss.player_id then c.sb - c.sa else 0 end), 0) as set_diff
      from public.space_standing ss
      left join confirmed c on (c.a = ss.player_id or c.b = ss.player_id)
      where ss.space_id = _category_id
      group by ss.player_id
    ),
    ranked as (
      select pp.uid, pp.wins, pp.played, pp.set_diff,
        (select count(*) from confirmed c
           where ((c.a = pp.uid and c.match_winner = 'a') or (c.b = pp.uid and c.match_winner = 'b'))
             and exists (select 1 from pp o where o.uid = case when c.a = pp.uid then c.b else c.a end
                                            and o.wins = pp.wins and o.set_diff = pp.set_diff)
        ) as h2h
      from pp
    )
    select uid, wins, played, set_diff,
      row_number() over (order by wins desc, set_diff desc, h2h desc, uid) as pos
    from ranked
  loop
    update public.space_standing
       set local_rank = r.pos,
           local_state = jsonb_build_object('wins', r.wins, 'played', r.played, 'set_diff', r.set_diff, 'status', 'active'),
           updated_at = now()
     where space_id = _category_id and player_id = r.uid;
  end loop;
end $$;

-- Dispatcher by category format.
create or replace function public.apply_tournament_result(_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.matches%rowtype; b public.tournament_bracket%rowtype; _motor text; _w uuid;
begin
  select * into m from public.matches where id = _match_id;
  if not found or m.confirmation_status <> 'confirmed' or m.source_type <> 'tournament' then return; end if;
  select motor into _motor from public.tournament_config where space_id = m.space_id;

  if _motor = 'round_robin' then
    -- mark the fixture played, then recompute the table.
    select * into b from public.tournament_bracket where match_id = _match_id;
    if found and b.winner is null then
      _w := case when m.match_winner = 'a' then b.player_a else b.player_b end;
      update public.tournament_bracket set winner = _w, status = 'played' where id = b.id;
    end if;
    perform public._recompute_round_robin(m.space_id);
  else
    perform public._apply_single_elim(_match_id);
  end if;
end $$;

-- Generate a round-robin: one fixture per unordered pair, all immediately playable.
create or replace function public._generate_round_robin(_category_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _players uuid[]; _n int; _i int; _j int; _slot int := 0;
begin
  select coalesce(array_agg(mm.player_id order by mm.player_id), '{}') into _players
  from public.space_membership mm where mm.space_id = _category_id and mm.status = 'active';
  _n := coalesce(array_length(_players, 1), 0);
  if _n < 2 then raise exception 'Se necesitan al menos 2 inscritos'; end if;

  delete from public.tournament_bracket where category_id = _category_id;
  for _i in 1 .. _n - 1 loop
    for _j in _i + 1 .. _n loop
      insert into public.tournament_bracket (category_id, round, slot, player_a, player_b, status)
      values (_category_id, 1, _slot, _players[_i], _players[_j], 'playable');
      _slot := _slot + 1;
    end loop;
  end loop;

  for _i in 1 .. _n loop
    insert into public.space_standing (space_id, player_id, local_rank, local_state)
    values (_category_id, _players[_i], _i, jsonb_build_object('wins', 0, 'played', 0, 'set_diff', 0, 'status', 'active'))
    on conflict (space_id, player_id) do update
      set local_rank = excluded.local_rank, local_state = excluded.local_state, updated_at = now();
  end loop;

  perform public._recompute_round_robin(_category_id);
end $$;

-- Read RPC: standings table for non-bracket formats.
create or replace function public.tournament_standings(_category_id uuid)
returns table (pos int, user_id uuid, name text, wins int, played int, set_diff int, status text)
language sql stable security definer set search_path = public as $$
  select ss.local_rank, pf.id, pf.display_name,
         coalesce((ss.local_state->>'wins')::int, 0),
         coalesce((ss.local_state->>'played')::int, 0),
         coalesce((ss.local_state->>'set_diff')::int, 0),
         coalesce(ss.local_state->>'status', 'active')
  from public.space_standing ss
  join public.profiles pf on pf.id = ss.player_id
  where ss.space_id = _category_id
  order by ss.local_rank nulls last, pf.display_name;
$$;

-- Expose the category format to the UI. Return type gained a column, so drop first.
drop function if exists public.list_tournament_categories();
create or replace function public.list_tournament_categories()
returns table (category_id uuid, category_name text, tournament_name text, sport text, motor text, enrolled boolean, players int, bracket_ready boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, t.name, c.sport, tc.motor,
    exists (select 1 from public.space_membership m where m.space_id = c.id and m.player_id = auth.uid() and m.status = 'active'),
    (select count(*)::int from public.space_membership m where m.space_id = c.id and m.status = 'active'),
    exists (select 1 from public.tournament_bracket b where b.category_id = c.id)
  from public.space c
  join public.space t on t.id = c.parent_space_id and t.type = 'tournament'
  left join public.tournament_config tc on tc.space_id = c.id
  where c.type = 'category' and public.can_access_space(c.id)
  order by t.name, c.name;
$$;

grant execute on function public.tournament_standings(uuid) to authenticated;
grant execute on function public.list_tournament_categories() to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: a demo round-robin category (4 players) in the AcePlay Demo Club.
-- ---------------------------------------------------------------------------
do $$
declare _club uuid; _org uuid; _tour uuid; _cat uuid; r record;
begin
  select id, organizer_id into _club, _org from public.space where slug = 'demo-club' and type = 'club';
  if _club is null then return; end if;

  select id into _tour from public.space where slug = 'torneo-rr-demo' and parent_space_id = _club;
  if _tour is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('tournament', _club, 'demo_club.torneo_rr', 'Torneo Demo · Round Robin', 'torneo-rr-demo',
            'members', 'request', null, _org, 'active')
    returning id into _tour;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_tour, 'round_robin', 'manual', 'padel', 'best_of_3', 'puntual', 1.1);
  end if;

  select id into _cat from public.space where slug = 'torneo-rr-grupo' and parent_space_id = _tour;
  if _cat is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('category', _tour, 'demo_club.torneo_rr.grupo', 'Grupo único', 'torneo-rr-grupo',
            'members', 'request', 'padel', _org, 'active')
    returning id into _cat;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_cat, 'round_robin', 'manual', 'padel', 'best_of_3', 'puntual', 1.1);
  end if;

  for r in
    select p.id from public.profiles p join auth.users u on u.id = p.id
    where u.email in ('demouser@aceplay.cl','demo01@demo.local','demo03@demo.local','demo05@demo.local')
  loop
    insert into public.space_membership (player_id, space_id, role, status)
    values (r.id, _cat, 'player'::public.membership_role, 'active')
    on conflict (player_id, space_id) do nothing;
  end loop;

  if not exists (select 1 from public.tournament_bracket where category_id = _cat) then
    perform public._generate_round_robin(_cat);
  end if;
end $$;

notify pgrst, 'reload schema';
