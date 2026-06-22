-- FASE 4.3: consolation. Main bracket (single elimination) + a consolation bracket (B) where
-- the FIRST-ROUND losers of the main bracket fall and play their own single-elim. Same base:
-- engine + anti-farming for matches; space_standing local; no tenant_id.

-- Make the bracket table multi-bracket aware.
alter table public.tournament_bracket add column if not exists bracket text not null default 'main';
alter table public.tournament_bracket drop constraint if exists tournament_bracket_category_id_round_slot_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tournament_bracket_cat_bracket_round_slot') then
    alter table public.tournament_bracket add constraint tournament_bracket_cat_bracket_round_slot
      unique (category_id, bracket, round, slot);
  end if;
end $$;

-- Advance a winner within a SPECIFIC bracket (main or consolation).
create or replace function public._advance_bracket(_category_id uuid, _bracket text, _round int, _slot int, _winner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _nr int; _ns int; _maxr int;
begin
  select max(round) into _maxr from public.tournament_bracket where category_id = _category_id and bracket = _bracket;
  if _round >= _maxr then
    update public.space_standing
       set local_rank = case when _bracket = 'main' then 1 else local_rank end,
           local_state = local_state || jsonb_build_object('status', case when _bracket = 'main' then 'champion' else 'consolation_champion' end, 'round_reached', _round + 1, 'bracket', _bracket),
           updated_at = now()
     where space_id = _category_id and player_id = _winner;
    return;
  end if;
  _nr := _round + 1; _ns := _slot / 2;
  if _slot % 2 = 0 then
    update public.tournament_bracket set player_a = _winner where category_id = _category_id and bracket = _bracket and round = _nr and slot = _ns;
  else
    update public.tournament_bracket set player_b = _winner where category_id = _category_id and bracket = _bracket and round = _nr and slot = _ns;
  end if;
  update public.tournament_bracket set status = 'playable'
   where category_id = _category_id and bracket = _bracket and round = _nr and slot = _ns
     and player_a is not null and player_b is not null and status = 'pending';
  update public.space_standing
     set local_state = local_state || jsonb_build_object('round_reached', _nr, 'bracket', _bracket), updated_at = now()
   where space_id = _category_id and player_id = _winner;
end $$;

-- Re-create the main-bracket generator's bye auto-advance to pass the bracket.
create or replace function public._generate_bracket(_category_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _disc text; _fmt text;
  _players uuid[]; _n int; _size int; _rounds int; _r int; _s int;
  _seed int[]; _tmp int[]; _m int; _x int;
  _posA int; _posB int; _pa uuid; _pb uuid;
  _slot record;
begin
  select disciplina into _disc from public.tournament_config where space_id = _category_id;
  _disc := coalesce(_disc, 'padel');
  _fmt := case when _disc = 'padel' then 'doubles' else 'singles' end;

  select coalesce(array_agg(uid order by rating desc nulls last, uid), '{}') into _players
  from (
    select mm.player_id as uid, pr.rating
    from public.space_membership mm
    left join public.player_ratings pr on pr.user_id = mm.player_id and pr.sport = _disc and pr.format = _fmt
    where mm.space_id = _category_id and mm.status = 'active'
  ) t;
  _n := coalesce(array_length(_players, 1), 0);
  if _n < 2 then raise exception 'Se necesitan al menos 2 inscritos'; end if;

  _size := 1; while _size < _n loop _size := _size * 2; end loop;
  _rounds := 0; _m := _size; while _m > 1 loop _m := _m / 2; _rounds := _rounds + 1; end loop;

  _seed := array[1];
  while array_length(_seed, 1) < _size loop
    _m := array_length(_seed, 1) * 2 + 1; _tmp := '{}';
    foreach _x in array _seed loop _tmp := _tmp || _x || (_m - _x); end loop;
    _seed := _tmp;
  end loop;

  delete from public.tournament_bracket where category_id = _category_id;
  for _s in 0 .. _size / 2 - 1 loop
    _posA := _seed[2 * _s + 1]; _posB := _seed[2 * _s + 2];
    _pa := case when _posA <= _n then _players[_posA] else null end;
    _pb := case when _posB <= _n then _players[_posB] else null end;
    insert into public.tournament_bracket (category_id, bracket, round, slot, player_a, player_b, winner, status)
    values (_category_id, 'main', 1, _s, _pa, _pb,
            case when _pa is not null and _pb is null then _pa when _pb is not null and _pa is null then _pb else null end,
            case when _pa is not null and _pb is not null then 'playable' when _pa is null and _pb is null then 'pending' else 'bye' end);
  end loop;
  for _r in 2 .. _rounds loop
    for _s in 0 .. (_size / power(2, _r))::int - 1 loop
      insert into public.tournament_bracket (category_id, bracket, round, slot, status) values (_category_id, 'main', _r, _s, 'pending');
    end loop;
  end loop;
  for _s in 1 .. _n loop
    insert into public.space_standing (space_id, player_id, local_rank, local_state)
    values (_category_id, _players[_s], _s, jsonb_build_object('seed', _s, 'round_reached', 1, 'status', 'active', 'bracket', 'main'))
    on conflict (space_id, player_id) do update set local_rank = excluded.local_rank, local_state = excluded.local_state, updated_at = now();
  end loop;
  for _slot in select * from public.tournament_bracket where category_id = _category_id and bracket = 'main' and round = 1 and status = 'bye' and winner is not null loop
    perform public._advance_bracket(_category_id, 'main', 1, _slot.slot, _slot.winner);
  end loop;
end $$;

-- Single elimination apply (bracket-aware).
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
  update public.space_standing set local_state = local_state || jsonb_build_object('status', 'eliminated', 'round_reached', b.round), updated_at = now()
   where space_id = b.category_id and player_id = _l;
  perform public._advance_bracket(b.category_id, b.bracket, b.round, b.slot, _w);
end $$;

-- Consolation apply: main losers in round 1 drop into the consolation bracket; everyone else
-- as in single elimination, within their own bracket.
create or replace function public._apply_consolation(_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.matches%rowtype; b public.tournament_bracket%rowtype; _w uuid; _l uuid; _bs int;
begin
  select * into m from public.matches where id = _match_id;
  select * into b from public.tournament_bracket where match_id = _match_id;
  if not found or b.winner is not null then return; end if;
  _w := case when m.match_winner = 'a' then b.player_a else b.player_b end;
  _l := case when m.match_winner = 'a' then b.player_b else b.player_a end;
  update public.tournament_bracket set winner = _w, status = 'played' where id = b.id;

  perform public._advance_bracket(b.category_id, b.bracket, b.round, b.slot, _w);

  if b.bracket = 'main' and b.round = 1 then
    -- loser drops into consolation round 1, deterministic placement.
    _bs := b.slot / 2;
    if b.slot % 2 = 0 then
      update public.tournament_bracket set player_a = _l where category_id = b.category_id and bracket = 'consolation' and round = 1 and slot = _bs;
    else
      update public.tournament_bracket set player_b = _l where category_id = b.category_id and bracket = 'consolation' and round = 1 and slot = _bs;
    end if;
    update public.tournament_bracket set status = 'playable'
     where category_id = b.category_id and bracket = 'consolation' and round = 1 and slot = _bs
       and player_a is not null and player_b is not null and status = 'pending';
    update public.space_standing set local_state = local_state || jsonb_build_object('status', 'consolation', 'bracket', 'consolation', 'round_reached', 1), updated_at = now()
     where space_id = b.category_id and player_id = _l;
  else
    update public.space_standing set local_state = local_state || jsonb_build_object('status', case when b.bracket = 'consolation' then 'eliminated_consolation' else 'eliminated' end, 'round_reached', b.round), updated_at = now()
     where space_id = b.category_id and player_id = _l;
  end if;
end $$;

-- Dispatcher by format.
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
  elsif _motor = 'consolation' then
    perform public._apply_consolation(_match_id);
  else
    perform public._apply_single_elim(_match_id);
  end if;
end $$;

-- Generate main + empty consolation bracket.
create or replace function public._generate_consolation(_category_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _l int; _size int; _rounds int; _r int; _s int;
begin
  perform public._generate_bracket(_category_id);  -- main
  select count(*) into _l from public.tournament_bracket
   where category_id = _category_id and bracket = 'main' and round = 1 and player_a is not null and player_b is not null;
  if _l >= 2 then
    _size := 1; while _size < _l loop _size := _size * 2; end loop;
    _rounds := 0; _r := _size; while _r > 1 loop _r := _r / 2; _rounds := _rounds + 1; end loop;
    for _r in 1 .. _rounds loop
      for _s in 0 .. (_size / power(2, _r))::int - 1 loop
        insert into public.tournament_bracket (category_id, bracket, round, slot, status)
        values (_category_id, 'consolation', _r, _s, 'pending')
        on conflict (category_id, bracket, round, slot) do nothing;
      end loop;
    end loop;
  end if;
end $$;

-- Organizer-gated generate dispatches by format.
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
  else perform public._generate_bracket(_category_id); end if;
end $$;

-- bracket_view gains the bracket label.
drop function if exists public.bracket_view(uuid);
create or replace function public.bracket_view(_category_id uuid)
returns table (slot_id uuid, bracket text, round int, slot int, player_a uuid, name_a text, player_b uuid, name_b text, winner uuid, status text, match_id uuid)
language sql stable security definer set search_path = public as $$
  select b.id, b.bracket, b.round, b.slot, b.player_a, pa.display_name, b.player_b, pb.display_name, b.winner, b.status, b.match_id
  from public.tournament_bracket b
  left join public.profiles pa on pa.id = b.player_a
  left join public.profiles pb on pb.id = b.player_b
  where b.category_id = _category_id
  order by (b.bracket = 'consolation'), b.round, b.slot;
$$;
grant execute on function public.bracket_view(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: a demo consolation tournament (8 players) in the AcePlay Demo Club.
-- ---------------------------------------------------------------------------
do $$
declare _club uuid; _org uuid; _tour uuid; _cat uuid; r record;
begin
  select id, organizer_id into _club, _org from public.space where slug = 'demo-club' and type = 'club';
  if _club is null then return; end if;

  select id into _tour from public.space where slug = 'torneo-cons-demo' and parent_space_id = _club;
  if _tour is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('tournament', _club, 'demo_club.torneo_cons', 'Torneo Demo · Consolación', 'torneo-cons-demo', 'members', 'request', null, _org, 'active')
    returning id into _tour;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_tour, 'consolation', 'manual', 'padel', 'best_of_3', 'puntual', 1.2);
  end if;

  select id into _cat from public.space where slug = 'torneo-cons-open' and parent_space_id = _tour;
  if _cat is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('category', _tour, 'demo_club.torneo_cons.open', 'Categoría OPEN', 'torneo-cons-open', 'members', 'request', 'padel', _org, 'active')
    returning id into _cat;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_cat, 'consolation', 'manual', 'padel', 'best_of_3', 'puntual', 1.2);
  end if;

  for r in
    select p.id from public.profiles p join auth.users u on u.id = p.id
    where u.email in ('demouser@aceplay.cl','demo01@demo.local','demo02@demo.local','demo03@demo.local',
                      'demo04@demo.local','demo05@demo.local','demo06@demo.local','demo07@demo.local')
  loop
    insert into public.space_membership (player_id, space_id, role, status)
    values (r.id, _cat, 'player'::public.membership_role, 'active')
    on conflict (player_id, space_id) do nothing;
  end loop;

  if not exists (select 1 from public.tournament_bracket where category_id = _cat) then
    perform public._generate_consolation(_cat);
  end if;
end $$;

notify pgrst, 'reload schema';
