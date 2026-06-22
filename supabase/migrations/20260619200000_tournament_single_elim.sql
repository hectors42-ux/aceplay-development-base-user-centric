-- FASE 4.1: tournaments, SINGLE ELIMINATION only.
-- Architecture: tournament = space(type=tournament); categories = space(type=category) children.
-- Competition config lives at the CATEGORY level (its own tournament_config row, inheriting
-- defaults from the tournament's row). Enrollment = space_membership on the category.
-- Bracket matches are played via the EXISTING engine (record/confirm + anti-farming) and feed
-- the GLOBAL rating; the tournament never computes rating. space_standing on the category is the
-- LOCAL bracket advancement, separate from the global rating. No tenant_id.

-- Bracket fixtures live here (matches.match_winner is NOT NULL, so unplayed ties can't live there).
create table if not exists public.tournament_bracket (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.space(id) on delete cascade,
  round int not null,
  slot int not null,
  player_a uuid references public.profiles(id),
  player_b uuid references public.profiles(id),
  winner uuid references public.profiles(id),
  match_id uuid references public.matches(id),
  status text not null default 'pending',  -- pending | playable | played_pending | played | bye
  created_at timestamptz not null default now(),
  unique (category_id, round, slot)
);
alter table public.tournament_bracket enable row level security;
grant select on public.tournament_bracket to authenticated;
grant all on public.tournament_bracket to service_role;
drop policy if exists tb_read on public.tournament_bracket;
create policy tb_read on public.tournament_bracket for select using (public.can_access_space(category_id));

-- Advance a winner from (round, slot) into the next round; mark champion at the final.
create or replace function public._advance_bracket(_category_id uuid, _round int, _slot int, _winner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _nr int; _ns int; _maxr int;
begin
  select max(round) into _maxr from public.tournament_bracket where category_id = _category_id;
  if _round >= _maxr then
    update public.space_standing
       set local_rank = 1,
           local_state = local_state || jsonb_build_object('status', 'champion', 'round_reached', _round + 1),
           updated_at = now()
     where space_id = _category_id and player_id = _winner;
    return;
  end if;
  _nr := _round + 1; _ns := _slot / 2;
  if _slot % 2 = 0 then
    update public.tournament_bracket set player_a = _winner where category_id = _category_id and round = _nr and slot = _ns;
  else
    update public.tournament_bracket set player_b = _winner where category_id = _category_id and round = _nr and slot = _ns;
  end if;
  update public.tournament_bracket set status = 'playable'
   where category_id = _category_id and round = _nr and slot = _ns
     and player_a is not null and player_b is not null and status = 'pending';
  update public.space_standing
     set local_state = local_state || jsonb_build_object('round_reached', _nr), updated_at = now()
   where space_id = _category_id and player_id = _winner;
end $$;

-- Generate the single-elim bracket: seed by global rating, byes to the top seeds. No auth check.
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
    left join public.player_ratings pr
      on pr.user_id = mm.player_id and pr.sport = _disc and pr.format = _fmt
    where mm.space_id = _category_id and mm.status = 'active'
  ) t;
  _n := coalesce(array_length(_players, 1), 0);
  if _n < 2 then raise exception 'Se necesitan al menos 2 inscritos para generar el cuadro'; end if;

  _size := 1; while _size < _n loop _size := _size * 2; end loop;
  _rounds := 0; _m := _size; while _m > 1 loop _m := _m / 2; _rounds := _rounds + 1; end loop;

  -- standard seeding order (1, size, ..., 2)
  _seed := array[1];
  while array_length(_seed, 1) < _size loop
    _m := array_length(_seed, 1) * 2 + 1;
    _tmp := '{}';
    foreach _x in array _seed loop
      _tmp := _tmp || _x || (_m - _x);
    end loop;
    _seed := _tmp;
  end loop;

  delete from public.tournament_bracket where category_id = _category_id;

  -- round 1
  for _s in 0 .. _size / 2 - 1 loop
    _posA := _seed[2 * _s + 1];
    _posB := _seed[2 * _s + 2];
    _pa := case when _posA <= _n then _players[_posA] else null end;
    _pb := case when _posB <= _n then _players[_posB] else null end;
    insert into public.tournament_bracket (category_id, round, slot, player_a, player_b, winner, status)
    values (_category_id, 1, _s, _pa, _pb,
            case when _pa is not null and _pb is null then _pa
                 when _pb is not null and _pa is null then _pb else null end,
            case when _pa is not null and _pb is not null then 'playable'
                 when _pa is null and _pb is null then 'pending'
                 else 'bye' end);
  end loop;

  -- empty later rounds
  for _r in 2 .. _rounds loop
    for _s in 0 .. (_size / power(2, _r))::int - 1 loop
      insert into public.tournament_bracket (category_id, round, slot, status)
      values (_category_id, _r, _s, 'pending');
    end loop;
  end loop;

  -- seed standings
  for _s in 1 .. _n loop
    insert into public.space_standing (space_id, player_id, local_rank, local_state)
    values (_category_id, _players[_s], _s, jsonb_build_object('seed', _s, 'round_reached', 1, 'status', 'active'))
    on conflict (space_id, player_id) do update
      set local_rank = excluded.local_rank, local_state = excluded.local_state, updated_at = now();
  end loop;

  -- auto-advance byes
  for _slot in select * from public.tournament_bracket where category_id = _category_id and round = 1 and status = 'bye' and winner is not null loop
    perform public._advance_bracket(_category_id, 1, _slot.slot, _slot.winner);
  end loop;
end $$;

-- Organizer-gated public RPC to generate the bracket.
create or replace function public.generate_bracket(_category_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _org uuid; _porg uuid;
begin
  select organizer_id into _org from public.space where id = _category_id and type = 'category';
  if _org is null then raise exception 'Categoría no encontrada'; end if;
  select s.organizer_id into _porg from public.space s
    join public.space c on c.parent_space_id = s.id where c.id = _category_id;
  if auth.uid() <> _org and auth.uid() <> coalesce(_porg, _org) then
    raise exception 'Solo el organizador puede generar el cuadro';
  end if;
  perform public._generate_bracket(_category_id);
end $$;

-- Play a bracket match: creates a pending match via the engine, links it to the slot.
create or replace function public.play_bracket_match(_slot_id uuid, _winner_is_me boolean, _sets jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  b public.tournament_bracket%rowtype;
  _uid uuid := auth.uid();
  _disc text; _fmt text; _mid uuid; _winner_side text;
  _s jsonb; _idx int := 0;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  select * into b from public.tournament_bracket where id = _slot_id;
  if not found then raise exception 'Partido no encontrado'; end if;
  if b.status <> 'playable' or b.player_a is null or b.player_b is null then raise exception 'El partido no está listo para jugarse'; end if;
  if b.match_id is not null then raise exception 'Este partido ya tiene un resultado cargado'; end if;
  if _uid <> b.player_a and _uid <> b.player_b then raise exception 'No participas en este partido'; end if;

  select disciplina into _disc from public.tournament_config where space_id = b.category_id;
  _disc := coalesce(_disc, 'padel');
  _fmt := case when _disc = 'padel' then 'doubles' else 'singles' end;
  _winner_side := case when (_uid = b.player_a) = _winner_is_me then 'a' else 'b' end;

  insert into public.matches (sport, format, source_type, space_id, side_a, side_b, match_winner, played_at,
                              verified_event, prestige_mult, confirmation_status, source_ref, recorded_by)
  values (_disc, _fmt, 'tournament', b.category_id, array[b.player_a], array[b.player_b], _winner_side, now(),
          true, coalesce((select prestige_mult from public.tournament_config where space_id = b.category_id), 1.0),
          'pending', jsonb_build_object('bracket_slot', b.id, 'round', b.round, 'slot', b.slot), _uid)
  returning id into _mid;

  for _s in select * from jsonb_array_elements(coalesce(_sets, '[]'::jsonb)) loop
    insert into public.match_sets (match_id, set_index, games_a, games_b, is_tiebreak, is_valid)
    values (_mid, _idx, (_s->>'games_a')::int, (_s->>'games_b')::int, coalesce((_s->>'is_tiebreak')::boolean, false), true);
    _idx := _idx + 1;
  end loop;

  update public.tournament_bracket set match_id = _mid, status = 'played_pending' where id = b.id;
  return _mid;
end $$;

-- On a confirmed tournament match: record the bracket result and advance the winner.
create or replace function public.apply_tournament_result(_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.matches%rowtype; b public.tournament_bracket%rowtype; _w uuid; _l uuid;
begin
  select * into m from public.matches where id = _match_id;
  if not found or m.confirmation_status <> 'confirmed' or m.source_type <> 'tournament' then return; end if;
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

-- Extend the confirm trigger: tournament matches also advance the bracket.
create or replace function public.on_match_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.confirmation_status = 'confirmed'
     and (tg_op = 'INSERT' or coalesce(old.confirmation_status, '') <> 'confirmed') then
    perform public.apply_match_to_ratings(new.id);
    if new.source_type = 'escalerilla' then
      perform public.apply_ladder_result(new.id);
    elsif new.source_type = 'tournament' then
      perform public.apply_tournament_result(new.id);
    end if;
  end if;
  return new;
end $$;

-- Read RPCs for the UI.
create or replace function public.bracket_view(_category_id uuid)
returns table (slot_id uuid, round int, slot int, player_a uuid, name_a text, player_b uuid, name_b text, winner uuid, status text, match_id uuid)
language sql stable security definer set search_path = public as $$
  select b.id, b.round, b.slot, b.player_a, pa.display_name, b.player_b, pb.display_name, b.winner, b.status, b.match_id
  from public.tournament_bracket b
  left join public.profiles pa on pa.id = b.player_a
  left join public.profiles pb on pb.id = b.player_b
  where b.category_id = _category_id
  order by b.round, b.slot;
$$;

create or replace function public.list_tournament_categories()
returns table (category_id uuid, category_name text, tournament_name text, sport text, enrolled boolean, players int, bracket_ready boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, t.name, c.sport,
    exists (select 1 from public.space_membership m where m.space_id = c.id and m.player_id = auth.uid() and m.status = 'active'),
    (select count(*)::int from public.space_membership m where m.space_id = c.id and m.status = 'active'),
    exists (select 1 from public.tournament_bracket b where b.category_id = c.id)
  from public.space c
  join public.space t on t.id = c.parent_space_id and t.type = 'tournament'
  where c.type = 'category' and public.can_access_space(c.id)
  order by t.name, c.name;
$$;

grant execute on function public.generate_bracket(uuid) to authenticated;
grant execute on function public.play_bracket_match(uuid, boolean, jsonb) to authenticated;
grant execute on function public.bracket_view(uuid) to authenticated;
grant execute on function public.list_tournament_categories() to authenticated;

notify pgrst, 'reload schema';
