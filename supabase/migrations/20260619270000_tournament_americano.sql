-- FASE 4.6: americano de rotación. 4 players, 1 court, 3 rounds; every player partners every
-- other exactly once. Individual score = games your pair won, accumulated. Matches are 2v2 and
-- go through the engine, which is GENERALIZED here to teams (a side's effective rating = the
-- average of its players' ratings; the resulting delta is applied to every player on the side).
-- Backward compatible with 1v1 (a one-player team's average is that player). No tenant_id.

-- Team fixtures need 2-player sides.
alter table public.tournament_bracket add column if not exists team_a uuid[];
alter table public.tournament_bracket add column if not exists team_b uuid[];

-- ---------------------------------------------------------------------------
-- Generalized rating engine: works for 1v1 and 2v2 via team averaging.
-- ---------------------------------------------------------------------------
create or replace function public.apply_match_to_ratings(_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m public.matches%rowtype;
  _sa numeric; _sb numeric; cm numeric;
  q   constant numeric := 0.0057564627325;
  pi2 constant numeric := 9.8696044010893586;
  ra numeric; rda numeric; rb numeric; rdb numeric;
  ga numeric; gb numeric; ea numeric; eb numeric; d2a numeric; d2b numeric;
  nra numeric; nrda numeric; nrb numeric; nrdb numeric;
  _da numeric; _db numeric;
  _pid uuid; _pr numeric; _prd numeric; _pmc int;
begin
  select * into m from public.matches where id = _match_id;
  if not found or m.confirmation_status <> 'confirmed' then return; end if;
  if coalesce(array_length(m.side_a, 1), 0) < 1 or coalesce(array_length(m.side_b, 1), 0) < 1 then return; end if;
  if exists (select 1 from public.rating_history where match_id = _match_id) then return; end if;

  _sa := case when m.match_winner = 'a' then 1 else 0 end; _sb := 1 - _sa;
  cm := coalesce(m.prestige_mult, 1.0);

  -- Effective (team) ratings = average over the side's players (defaults for missing rows).
  select coalesce(avg(rating), 1500), coalesce(avg(rd), 350) into ra, rda
    from public.player_ratings where user_id = any(m.side_a) and sport = m.sport and format = m.format;
  ra := coalesce(ra, 1500); rda := coalesce(rda, 350);
  select coalesce(avg(rating), 1500), coalesce(avg(rd), 350) into rb, rdb
    from public.player_ratings where user_id = any(m.side_b) and sport = m.sport and format = m.format;
  rb := coalesce(rb, 1500); rdb := coalesce(rdb, 350);

  ga  := 1.0 / sqrt(1.0 + 3.0 * q * q * rdb * rdb / pi2);
  gb  := 1.0 / sqrt(1.0 + 3.0 * q * q * rda * rda / pi2);
  ea  := 1.0 / (1.0 + power(10.0, -ga * (ra - rb) / 400.0));
  eb  := 1.0 / (1.0 + power(10.0, -gb * (rb - ra) / 400.0));
  d2a := 1.0 / (q * q * ga * ga * ea * (1.0 - ea));
  d2b := 1.0 / (q * q * gb * gb * eb * (1.0 - eb));
  nrda := least(350, greatest(30, sqrt(1.0 / (1.0 / (rda * rda) + 1.0 / d2a))));
  nrdb := least(350, greatest(30, sqrt(1.0 / (1.0 / (rdb * rdb) + 1.0 / d2b))));
  nra := ra + cm * (q / (1.0 / (rda * rda) + 1.0 / d2a)) * ga * (_sa - ea);
  nrb := rb + cm * (q / (1.0 / (rdb * rdb) + 1.0 / d2b)) * gb * (_sb - eb);
  _da := nra - ra; _db := nrb - rb;

  -- Apply the side's delta to every player on that side.
  foreach _pid in array m.side_a loop
    select rating, rd, matches_count into _pr, _prd, _pmc from public.player_ratings where user_id = _pid and sport = m.sport and format = m.format;
    if _pr is null then _pr := 1500; _prd := 350; _pmc := 0; end if;
    insert into public.player_ratings (user_id, sport, format, rating, rd, nivel, confidence_tier, is_primary, matches_count, updated_at)
    values (_pid, m.sport, m.format, round(_pr + _da, 2), round(nrda, 2), public.rating_to_nivel(_pr + _da),
            case when _pmc + 1 >= 5 then 'established' else 'provisional' end, false, _pmc + 1, now())
    on conflict (user_id, sport, format) do update
      set rating = round(_pr + _da, 2), rd = round(nrda, 2), nivel = public.rating_to_nivel(_pr + _da),
          matches_count = public.player_ratings.matches_count + 1,
          confidence_tier = case when public.player_ratings.matches_count + 1 >= 5 then 'established' else 'provisional' end,
          updated_at = now();
    insert into public.rating_history (user_id, sport, format, match_id, rating_before, rating_after, rd_before, rd_after, opponent_rating, expected_score, actual_score, context_mult, period_date)
    values (_pid, m.sport, m.format, _match_id, round(_pr, 2), round(_pr + _da, 2), round(_prd, 2), round(nrda, 2), round(rb, 2), round(ea, 4), _sa, cm, current_date);
    insert into public.points_ledger (user_id, sport, format, match_id, season, base_delta, context_mult, prestige_mult, weighted_delta)
    values (_pid, m.sport, m.format, _match_id, extract(year from now())::int, round(_da, 2), cm, cm, round(_da, 2));
  end loop;
  foreach _pid in array m.side_b loop
    select rating, rd, matches_count into _pr, _prd, _pmc from public.player_ratings where user_id = _pid and sport = m.sport and format = m.format;
    if _pr is null then _pr := 1500; _prd := 350; _pmc := 0; end if;
    insert into public.player_ratings (user_id, sport, format, rating, rd, nivel, confidence_tier, is_primary, matches_count, updated_at)
    values (_pid, m.sport, m.format, round(_pr + _db, 2), round(nrdb, 2), public.rating_to_nivel(_pr + _db),
            case when _pmc + 1 >= 5 then 'established' else 'provisional' end, false, _pmc + 1, now())
    on conflict (user_id, sport, format) do update
      set rating = round(_pr + _db, 2), rd = round(nrdb, 2), nivel = public.rating_to_nivel(_pr + _db),
          matches_count = public.player_ratings.matches_count + 1,
          confidence_tier = case when public.player_ratings.matches_count + 1 >= 5 then 'established' else 'provisional' end,
          updated_at = now();
    insert into public.rating_history (user_id, sport, format, match_id, rating_before, rating_after, rd_before, rd_after, opponent_rating, expected_score, actual_score, context_mult, period_date)
    values (_pid, m.sport, m.format, _match_id, round(_pr, 2), round(_pr + _db, 2), round(_prd, 2), round(nrdb, 2), round(ra, 2), round(eb, 4), _sb, cm, current_date);
    insert into public.points_ledger (user_id, sport, format, match_id, season, base_delta, context_mult, prestige_mult, weighted_delta)
    values (_pid, m.sport, m.format, _match_id, extract(year from now())::int, round(_db, 2), cm, cm, round(_db, 2));
  end loop;
end $$;

-- play_bracket_match: support team fixtures (team_a/team_b). Recorder is any participant.
create or replace function public.play_bracket_match(_slot_id uuid, _winner_is_me boolean, _sets jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  b public.tournament_bracket%rowtype; _uid uuid := auth.uid();
  _disc text; _fmt text; _mid uuid; _winner_side text; _rec_is_a boolean;
  _sa uuid[]; _sb uuid[]; _s jsonb; _idx int := 0; _ga int; _gb int;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  select * into b from public.tournament_bracket where id = _slot_id;
  if not found then raise exception 'Partido no encontrado'; end if;
  _sa := coalesce(b.team_a, array[b.player_a]); _sb := coalesce(b.team_b, array[b.player_b]);
  _sa := array_remove(_sa, null); _sb := array_remove(_sb, null);
  if b.status <> 'playable' or coalesce(array_length(_sa,1),0) = 0 or coalesce(array_length(_sb,1),0) = 0 then raise exception 'El partido no está listo para jugarse'; end if;
  if b.match_id is not null then raise exception 'Este partido ya tiene un resultado cargado'; end if;
  if not (_uid = any(_sa) or _uid = any(_sb)) then raise exception 'No participas en este partido'; end if;

  select disciplina into _disc from public.tournament_config where space_id = b.category_id;
  _disc := coalesce(_disc, 'padel'); _fmt := case when _disc = 'padel' then 'doubles' else 'singles' end;
  _rec_is_a := (_uid = any(_sa));
  _winner_side := case when _rec_is_a = _winner_is_me then 'a' else 'b' end;

  insert into public.matches (sport, format, source_type, space_id, side_a, side_b, match_winner, played_at,
                              verified_event, prestige_mult, confirmation_status, source_ref, recorded_by)
  values (_disc, _fmt, 'tournament', b.category_id, _sa, _sb, _winner_side, now(),
          true, coalesce((select prestige_mult from public.tournament_config where space_id = b.category_id), 1.0),
          'pending', jsonb_build_object('bracket_slot', b.id, 'round', b.round), _uid)
  returning id into _mid;

  for _s in select * from jsonb_array_elements(coalesce(_sets, '[]'::jsonb)) loop
    if _rec_is_a then _ga := (_s->>'games_a')::int; _gb := (_s->>'games_b')::int;
    else _ga := (_s->>'games_b')::int; _gb := (_s->>'games_a')::int; end if;
    insert into public.match_sets (match_id, set_index, games_a, games_b, is_tiebreak, is_valid)
    values (_mid, _idx, _ga, _gb, coalesce((_s->>'is_tiebreak')::boolean, false), true);
    _idx := _idx + 1;
  end loop;

  update public.tournament_bracket set match_id = _mid, status = 'played_pending' where id = b.id;
  return _mid;
end $$;

-- Americano: 4-player rotation fixtures (each partners every other once).
create or replace function public._generate_americano(_category_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _disc text; _fmt text; _p uuid[]; _n int; _i int;
begin
  select disciplina into _disc from public.tournament_config where space_id = _category_id;
  _disc := coalesce(_disc, 'padel'); _fmt := case when _disc = 'padel' then 'doubles' else 'singles' end;
  select coalesce(array_agg(uid order by rating desc nulls last, uid), '{}') into _p
  from (select mm.player_id as uid, pr.rating from public.space_membership mm
        left join public.player_ratings pr on pr.user_id = mm.player_id and pr.sport = _disc and pr.format = _fmt
        where mm.space_id = _category_id and mm.status = 'active') t;
  _n := coalesce(array_length(_p, 1), 0);
  if _n <> 4 then raise exception 'El americano demo está hecho para 4 jugadores (hay %)', _n; end if;

  delete from public.tournament_bracket where category_id = _category_id;
  insert into public.tournament_bracket (category_id, bracket, round, slot, team_a, team_b, status) values
    (_category_id, 'americano', 1, 0, array[_p[1], _p[2]], array[_p[3], _p[4]], 'playable'),
    (_category_id, 'americano', 2, 0, array[_p[1], _p[3]], array[_p[2], _p[4]], 'playable'),
    (_category_id, 'americano', 3, 0, array[_p[1], _p[4]], array[_p[2], _p[3]], 'playable');
  for _i in 1 .. 4 loop
    insert into public.space_standing (space_id, player_id, local_rank, local_state)
    values (_category_id, _p[_i], _i, jsonb_build_object('points', 0, 'played', 0, 'status', 'active'))
    on conflict (space_id, player_id) do update set local_rank = excluded.local_rank, local_state = excluded.local_state, updated_at = now();
  end loop;
end $$;

-- Individual standings: points = sum of games your pair won across confirmed rounds.
create or replace function public._recompute_americano(_category_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    with mm as (
      select m.side_a, m.side_b, m.id,
        (select coalesce(sum(games_a), 0) from public.match_sets s where s.match_id = m.id) as ga,
        (select coalesce(sum(games_b), 0) from public.match_sets s where s.match_id = m.id) as gb
      from public.matches m
      where m.space_id = _category_id and m.source_type = 'tournament' and m.confirmation_status = 'confirmed'
    ),
    pts as (
      select ss.player_id as uid,
        coalesce(sum(case when ss.player_id = any(mm.side_a) then mm.ga when ss.player_id = any(mm.side_b) then mm.gb else 0 end), 0) as points,
        coalesce(count(mm.id) filter (where ss.player_id = any(mm.side_a) or ss.player_id = any(mm.side_b)), 0) as played
      from public.space_standing ss
      left join mm on (ss.player_id = any(mm.side_a) or ss.player_id = any(mm.side_b))
      where ss.space_id = _category_id
      group by ss.player_id
    )
    select uid, points, played, row_number() over (order by points desc, uid) as pos from pts
  loop
    update public.space_standing
       set local_rank = r.pos, local_state = jsonb_build_object('points', r.points, 'played', r.played, 'status', 'active'), updated_at = now()
     where space_id = _category_id and player_id = r.uid;
  end loop;
end $$;

create or replace function public._apply_americano(_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.matches%rowtype; b public.tournament_bracket%rowtype;
begin
  select * into m from public.matches where id = _match_id;
  select * into b from public.tournament_bracket where match_id = _match_id;
  if found and b.winner is null then
    update public.tournament_bracket set winner = case when m.match_winner = 'a' then b.team_a[1] else b.team_b[1] end, status = 'played' where id = b.id;
  end if;
  perform public._recompute_americano(m.space_id);
end $$;

-- Dispatchers gain americano.
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
  elsif _motor = 'double_elimination' then perform public._apply_double_elim(_match_id);
  elsif _motor = 'americano' then perform public._apply_americano(_match_id);
  else perform public._apply_single_elim(_match_id);
  end if;
end $$;

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
  elsif _motor = 'double_elimination' then perform public._generate_double_elim(_category_id);
  elsif _motor = 'americano' then perform public._generate_americano(_category_id);
  else perform public._generate_bracket(_category_id); end if;
end $$;

-- Read RPCs for the UI.
create or replace function public.americano_view(_category_id uuid)
returns table (slot_id uuid, round int, status text, match_id uuid, team_a text[], team_b text[], team_a_ids uuid[], team_b_ids uuid[], winner_side text)
language sql stable security definer set search_path = public as $$
  select b.id, b.round, b.status, b.match_id,
    (select array_agg(pf.display_name order by ord) from unnest(b.team_a) with ordinality u(uid, ord) join public.profiles pf on pf.id = u.uid),
    (select array_agg(pf.display_name order by ord) from unnest(b.team_b) with ordinality u(uid, ord) join public.profiles pf on pf.id = u.uid),
    b.team_a, b.team_b,
    (select mt.match_winner from public.matches mt where mt.id = b.match_id)
  from public.tournament_bracket b
  where b.category_id = _category_id and b.bracket = 'americano'
  order by b.round;
$$;

create or replace function public.americano_standings(_category_id uuid)
returns table (pos int, user_id uuid, name text, points int, played int)
language sql stable security definer set search_path = public as $$
  select ss.local_rank, pf.id, pf.display_name,
    coalesce((ss.local_state->>'points')::int, 0), coalesce((ss.local_state->>'played')::int, 0)
  from public.space_standing ss join public.profiles pf on pf.id = ss.player_id
  where ss.space_id = _category_id
  order by ss.local_rank nulls last, pf.display_name;
$$;

grant execute on function public.americano_view(uuid) to authenticated;
grant execute on function public.americano_standings(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: a 4-player americano demo.
-- ---------------------------------------------------------------------------
do $$
declare _club uuid; _org uuid; _tour uuid; _cat uuid; r record;
begin
  select id, organizer_id into _club, _org from public.space where slug = 'demo-club' and type = 'club';
  if _club is null then return; end if;

  select id into _tour from public.space where slug = 'torneo-ame-demo' and parent_space_id = _club;
  if _tour is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('tournament', _club, 'demo_club.torneo_ame', 'Torneo Demo · Americano', 'torneo-ame-demo', 'members', 'request', null, _org, 'active')
    returning id into _tour;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_tour, 'americano', 'manual', 'padel', 'games', 'puntual', 1.1);
  end if;

  select id into _cat from public.space where slug = 'torneo-ame-open' and parent_space_id = _tour;
  if _cat is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('category', _tour, 'demo_club.torneo_ame.open', 'Categoría OPEN', 'torneo-ame-open', 'members', 'request', 'padel', _org, 'active')
    returning id into _cat;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_cat, 'americano', 'manual', 'padel', 'games', 'puntual', 1.1);
  end if;

  for r in
    select p.id from public.profiles p join auth.users u on u.id = p.id
    where u.email in ('demouser@aceplay.cl','demo01@demo.local','demo03@demo.local','demo05@demo.local')
  loop
    insert into public.space_membership (player_id, space_id, role, status)
    values (r.id, _cat, 'player'::public.membership_role, 'active') on conflict (player_id, space_id) do nothing;
  end loop;

  if not exists (select 1 from public.tournament_bracket where category_id = _cat) then
    perform public._generate_americano(_cat);
  end if;
end $$;

notify pgrst, 'reload schema';
