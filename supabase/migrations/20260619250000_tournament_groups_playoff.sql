-- FASE 4.4: groups -> playoff. 2 groups of 4 (snake-seeded by rating), round robin within each
-- group (wins -> set diff -> head-to-head, same as 4.2). When the group stage completes, the top 2
-- of each group cross into a single-elim playoff (1A vs 2B, 1B vs 2A). Engine + anti-farming; the
-- bracket column carries group_a / group_b / playoff. space_standing is the local table; no tenant_id.

-- Group-scoped standings (round-robin rules, restricted to one group's players/matches).
create or replace function public._recompute_group(_category_id uuid, _grp text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    with gp as (
      select ss.player_id as uid from public.space_standing ss
      where ss.space_id = _category_id and ss.local_state->>'group' = _grp
    ),
    confirmed as (
      select m.id, m.side_a[1] as a, m.side_b[1] as b, m.match_winner,
        (select count(*) from public.match_sets s where s.match_id = m.id and s.games_a > s.games_b) as sa,
        (select count(*) from public.match_sets s where s.match_id = m.id and s.games_b > s.games_a) as sb
      from public.matches m
      where m.space_id = _category_id and m.source_type = 'tournament' and m.confirmation_status = 'confirmed'
        and m.side_a[1] in (select uid from gp) and m.side_b[1] in (select uid from gp)
    ),
    pp as (
      select gp.uid,
        coalesce(sum(case when (c.a = gp.uid and c.match_winner = 'a') or (c.b = gp.uid and c.match_winner = 'b') then 1 else 0 end), 0) as wins,
        coalesce(count(c.id), 0) as played,
        coalesce(sum(case when c.a = gp.uid then c.sa - c.sb when c.b = gp.uid then c.sb - c.sa else 0 end), 0) as set_diff
      from gp left join confirmed c on (c.a = gp.uid or c.b = gp.uid)
      group by gp.uid
    ),
    ranked as (
      select pp.uid, pp.wins, pp.played, pp.set_diff,
        (select count(*) from confirmed c
          where ((c.a = pp.uid and c.match_winner = 'a') or (c.b = pp.uid and c.match_winner = 'b'))
            and exists (select 1 from pp o where o.uid = case when c.a = pp.uid then c.b else c.a end and o.wins = pp.wins and o.set_diff = pp.set_diff)) as h2h
      from pp
    )
    select uid, wins, played, set_diff, row_number() over (order by wins desc, set_diff desc, h2h desc, uid) as pos
    from ranked
  loop
    update public.space_standing
       set local_rank = r.pos,
           local_state = jsonb_build_object('group', _grp, 'wins', r.wins, 'played', r.played, 'set_diff', r.set_diff, 'status', 'group'),
           updated_at = now()
     where space_id = _category_id and player_id = r.uid;
  end loop;
end $$;

-- Generate the two groups (snake by rating) + their round-robin fixtures + an empty playoff bracket.
create or replace function public._generate_groups(_category_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _disc text; _fmt text; _players uuid[]; _n int; _i int; _j int; _grp text;
  _ga uuid[]; _gb uuid[]; _slot int;
begin
  select disciplina into _disc from public.tournament_config where space_id = _category_id;
  _disc := coalesce(_disc, 'padel'); _fmt := case when _disc = 'padel' then 'doubles' else 'singles' end;

  select coalesce(array_agg(uid order by rating desc nulls last, uid), '{}') into _players
  from (
    select mm.player_id as uid, pr.rating from public.space_membership mm
    left join public.player_ratings pr on pr.user_id = mm.player_id and pr.sport = _disc and pr.format = _fmt
    where mm.space_id = _category_id and mm.status = 'active'
  ) t;
  _n := coalesce(array_length(_players, 1), 0);
  if _n < 4 then raise exception 'Se necesitan al menos 4 inscritos para grupos'; end if;

  delete from public.tournament_bracket where category_id = _category_id;

  -- Snake assignment to 2 groups (seed i: A if i%4 in {1,0}, else B).
  for _i in 1 .. _n loop
    if (_i % 4) in (1, 0) then _ga := _ga || _players[_i]; else _gb := _gb || _players[_i]; end if;
  end loop;

  -- Group round-robin fixtures + standings.
  _slot := 0;
  for _i in 1 .. array_length(_ga, 1) - 1 loop
    for _j in _i + 1 .. array_length(_ga, 1) loop
      insert into public.tournament_bracket (category_id, bracket, round, slot, player_a, player_b, status)
      values (_category_id, 'group_a', 1, _slot, _ga[_i], _ga[_j], 'playable'); _slot := _slot + 1;
    end loop;
  end loop;
  _slot := 0;
  for _i in 1 .. array_length(_gb, 1) - 1 loop
    for _j in _i + 1 .. array_length(_gb, 1) loop
      insert into public.tournament_bracket (category_id, bracket, round, slot, player_a, player_b, status)
      values (_category_id, 'group_b', 1, _slot, _gb[_i], _gb[_j], 'playable'); _slot := _slot + 1;
    end loop;
  end loop;

  for _i in 1 .. array_length(_ga, 1) loop
    insert into public.space_standing (space_id, player_id, local_rank, local_state)
    values (_category_id, _ga[_i], _i, jsonb_build_object('group', 'A', 'wins', 0, 'played', 0, 'set_diff', 0, 'status', 'group'))
    on conflict (space_id, player_id) do update set local_rank = excluded.local_rank, local_state = excluded.local_state, updated_at = now();
  end loop;
  for _i in 1 .. array_length(_gb, 1) loop
    insert into public.space_standing (space_id, player_id, local_rank, local_state)
    values (_category_id, _gb[_i], _i, jsonb_build_object('group', 'B', 'wins', 0, 'played', 0, 'set_diff', 0, 'status', 'group'))
    on conflict (space_id, player_id) do update set local_rank = excluded.local_rank, local_state = excluded.local_state, updated_at = now();
  end loop;

  -- Empty playoff: 2 semifinals + final.
  insert into public.tournament_bracket (category_id, bracket, round, slot, status) values
    (_category_id, 'playoff', 1, 0, 'pending'), (_category_id, 'playoff', 1, 1, 'pending'),
    (_category_id, 'playoff', 2, 0, 'pending');
end $$;

-- Seed the playoff once both groups are complete: 1A vs 2B, 1B vs 2A.
create or replace function public._seed_playoff(_category_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _1a uuid; _2a uuid; _1b uuid; _2b uuid;
begin
  -- already seeded?
  if exists (select 1 from public.tournament_bracket where category_id = _category_id and bracket = 'playoff' and round = 1 and slot = 0 and player_a is not null) then
    return;
  end if;
  -- groups complete?
  if exists (select 1 from public.tournament_bracket where category_id = _category_id and bracket in ('group_a','group_b') and status <> 'played') then
    return;
  end if;
  select player_id into _1a from public.space_standing where space_id = _category_id and local_state->>'group' = 'A' and local_rank = 1;
  select player_id into _2a from public.space_standing where space_id = _category_id and local_state->>'group' = 'A' and local_rank = 2;
  select player_id into _1b from public.space_standing where space_id = _category_id and local_state->>'group' = 'B' and local_rank = 1;
  select player_id into _2b from public.space_standing where space_id = _category_id and local_state->>'group' = 'B' and local_rank = 2;

  update public.tournament_bracket set player_a = _1a, player_b = _2b, status = 'playable' where category_id = _category_id and bracket = 'playoff' and round = 1 and slot = 0;
  update public.tournament_bracket set player_a = _1b, player_b = _2a, status = 'playable' where category_id = _category_id and bracket = 'playoff' and round = 1 and slot = 1;

  update public.space_standing set local_state = local_state || jsonb_build_object('status', 'playoff')
   where space_id = _category_id and player_id in (_1a, _2a, _1b, _2b);
  update public.space_standing set local_state = local_state || jsonb_build_object('status', 'eliminated')
   where space_id = _category_id and local_state->>'group' is not null and player_id not in (_1a, _2a, _1b, _2b);
end $$;

-- Apply a confirmed match for the groups->playoff format.
create or replace function public._apply_groups(_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.matches%rowtype; b public.tournament_bracket%rowtype; _w uuid; _l uuid; _grp text;
begin
  select * into m from public.matches where id = _match_id;
  select * into b from public.tournament_bracket where match_id = _match_id;
  if not found or b.winner is not null then return; end if;
  _w := case when m.match_winner = 'a' then b.player_a else b.player_b end;
  _l := case when m.match_winner = 'a' then b.player_b else b.player_a end;
  update public.tournament_bracket set winner = _w, status = 'played' where id = b.id;

  if b.bracket in ('group_a', 'group_b') then
    _grp := upper(right(b.bracket, 1));
    perform public._recompute_group(_category_id := b.category_id, _grp := _grp);
    perform public._seed_playoff(b.category_id);
  else  -- playoff
    update public.space_standing set local_state = local_state || jsonb_build_object('status', 'eliminated_playoff', 'round_reached', b.round), updated_at = now()
     where space_id = b.category_id and player_id = _l;
    perform public._advance_bracket(b.category_id, 'playoff', b.round, b.slot, _w);
  end if;
end $$;

-- Dispatcher gains groups_playoff.
create or replace function public.apply_tournament_result(_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.matches%rowtype; b public.tournament_bracket%rowtype; _motor text; _w uuid;
begin
  select * into m from public.matches where id = _match_id;
  if not found or m.confirmation_status <> 'confirmed' or m.source_type <> 'tournament' then return; end if;
  select motor into _motor from public.tournament_config where space_id = m.space_id;
  if _motor = 'round_robin' then
    select * into b from public.tournament_bracket where match_id = _match_id;
    if found and b.winner is null then
      _w := case when m.match_winner = 'a' then b.player_a else b.player_b end;
      update public.tournament_bracket set winner = _w, status = 'played' where id = b.id;
    end if;
    perform public._recompute_round_robin(m.space_id);
  elsif _motor = 'consolation' then perform public._apply_consolation(_match_id);
  elsif _motor = 'groups_playoff' then perform public._apply_groups(_match_id);
  else perform public._apply_single_elim(_match_id);
  end if;
end $$;

-- generate dispatch gains groups_playoff.
create or replace function public.generate_bracket(_category_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _org uuid; _porg uuid; _motor text;
begin
  select organizer_id into _org from public.space where id = _category_id and type = 'category';
  if _org is null then raise exception 'Categoría no encontrada'; end if;
  select s.organizer_id into _porg from public.space s join public.space c on c.parent_space_id = s.id where c.id = _category_id;
  if auth.uid() <> _org and auth.uid() <> coalesce(_porg, _org) then raise exception 'Solo el organizador puede generar el cuadro'; end if;
  select motor into _motor from public.tournament_config where space_id = _category_id;
  if _motor = 'round_robin' then perform public._generate_round_robin(_category_id);
  elsif _motor = 'consolation' then perform public._generate_consolation(_category_id);
  elsif _motor = 'groups_playoff' then perform public._generate_groups(_category_id);
  else perform public._generate_bracket(_category_id); end if;
end $$;

-- Read RPC: group standings for the UI.
create or replace function public.group_standings(_category_id uuid)
returns table (grp text, pos int, user_id uuid, name text, wins int, played int, set_diff int, status text)
language sql stable security definer set search_path = public as $$
  select ss.local_state->>'group', ss.local_rank, pf.id, pf.display_name,
         coalesce((ss.local_state->>'wins')::int, 0), coalesce((ss.local_state->>'played')::int, 0),
         coalesce((ss.local_state->>'set_diff')::int, 0), coalesce(ss.local_state->>'status', 'group')
  from public.space_standing ss
  join public.profiles pf on pf.id = ss.player_id
  where ss.space_id = _category_id and ss.local_state->>'group' is not null
  order by ss.local_state->>'group', ss.local_rank nulls last;
$$;
grant execute on function public.group_standings(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: a demo groups->playoff tournament (8 players, 2 groups of 4).
-- ---------------------------------------------------------------------------
do $$
declare _club uuid; _org uuid; _tour uuid; _cat uuid; r record;
begin
  select id, organizer_id into _club, _org from public.space where slug = 'demo-club' and type = 'club';
  if _club is null then return; end if;

  select id into _tour from public.space where slug = 'torneo-grp-demo' and parent_space_id = _club;
  if _tour is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('tournament', _club, 'demo_club.torneo_grp', 'Torneo Demo · Grupos', 'torneo-grp-demo', 'members', 'request', null, _org, 'active')
    returning id into _tour;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_tour, 'groups_playoff', 'manual', 'padel', 'best_of_3', 'puntual', 1.2);
  end if;

  select id into _cat from public.space where slug = 'torneo-grp-open' and parent_space_id = _tour;
  if _cat is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('category', _tour, 'demo_club.torneo_grp.open', 'Categoría OPEN', 'torneo-grp-open', 'members', 'request', 'padel', _org, 'active')
    returning id into _cat;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_cat, 'groups_playoff', 'manual', 'padel', 'best_of_3', 'puntual', 1.2);
  end if;

  for r in
    select p.id from public.profiles p join auth.users u on u.id = p.id
    where u.email in ('demouser@aceplay.cl','demo01@demo.local','demo02@demo.local','demo03@demo.local',
                      'demo04@demo.local','demo05@demo.local','demo06@demo.local','demo07@demo.local')
  loop
    insert into public.space_membership (player_id, space_id, role, status)
    values (r.id, _cat, 'player'::public.membership_role, 'active') on conflict (player_id, space_id) do nothing;
  end loop;

  if not exists (select 1 from public.tournament_bracket where category_id = _cat) then
    perform public._generate_groups(_cat);
  end if;
end $$;

notify pgrst, 'reload schema';
