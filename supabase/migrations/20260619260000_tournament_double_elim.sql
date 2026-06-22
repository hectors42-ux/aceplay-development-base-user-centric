-- FASE 4.5: double elimination (4-player demo). Winners bracket (WB) + losers bracket (LB);
-- a player is out after their 2nd loss. WB losers drop into the LB. Grand final is the WB winner
-- (0 losses) vs the LB winner (1 loss); if the LB winner wins game 1, a reset game 2 decides
-- (true double elimination). Engine + anti-farming; space_standing local; no tenant_id.
-- Brackets: winners / losers / grand_final.

create or replace function public._generate_double_elim(_category_id uuid)
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
  if _n <> 4 then raise exception 'El demo de doble eliminación está hecho para 4 jugadores (hay %)', _n; end if;

  delete from public.tournament_bracket where category_id = _category_id;
  -- Winners bracket: R1 (1v4, 2v3), R2 (WB final).
  insert into public.tournament_bracket (category_id, bracket, round, slot, player_a, player_b, status) values
    (_category_id, 'winners', 1, 0, _p[1], _p[4], 'playable'),
    (_category_id, 'winners', 1, 1, _p[2], _p[3], 'playable'),
    (_category_id, 'winners', 2, 0, null, null, 'pending');
  -- Losers bracket: R1 (the two WB-R1 losers), R2 (LB final: LB-R1 winner vs WB-final loser).
  insert into public.tournament_bracket (category_id, bracket, round, slot, status) values
    (_category_id, 'losers', 1, 0, 'pending'), (_category_id, 'losers', 2, 0, 'pending');
  -- Grand final: G1 and a reset G2.
  insert into public.tournament_bracket (category_id, bracket, round, slot, status) values
    (_category_id, 'grand_final', 1, 0, 'pending'), (_category_id, 'grand_final', 2, 0, 'pending');

  for _i in 1 .. 4 loop
    insert into public.space_standing (space_id, player_id, local_rank, local_state)
    values (_category_id, _p[_i], _i, jsonb_build_object('seed', _i, 'losses', 0, 'status', 'active', 'bracket', 'winners'))
    on conflict (space_id, player_id) do update set local_rank = excluded.local_rank, local_state = excluded.local_state, updated_at = now();
  end loop;
end $$;

create or replace function public._apply_double_elim(_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.matches%rowtype; b public.tournament_bracket%rowtype; _w uuid; _l uuid; _cat uuid;
begin
  select * into m from public.matches where id = _match_id;
  select * into b from public.tournament_bracket where match_id = _match_id;
  if not found or b.winner is not null then return; end if;
  _cat := b.category_id;
  _w := case when m.match_winner = 'a' then b.player_a else b.player_b end;
  _l := case when m.match_winner = 'a' then b.player_b else b.player_a end;
  update public.tournament_bracket set winner = _w, status = 'played' where id = b.id;
  -- count the loser's loss
  update public.space_standing
     set local_state = local_state || jsonb_build_object('losses', coalesce((local_state->>'losses')::int, 0) + 1), updated_at = now()
   where space_id = _cat and player_id = _l;

  if b.bracket = 'winners' and b.round = 1 then
    -- winner -> WB final; loser -> LB R1 (1st loss).
    if b.slot = 0 then
      update public.tournament_bracket set player_a = _w where category_id = _cat and bracket = 'winners' and round = 2 and slot = 0;
      update public.tournament_bracket set player_a = _l where category_id = _cat and bracket = 'losers' and round = 1 and slot = 0;
    else
      update public.tournament_bracket set player_b = _w where category_id = _cat and bracket = 'winners' and round = 2 and slot = 0;
      update public.tournament_bracket set player_b = _l where category_id = _cat and bracket = 'losers' and round = 1 and slot = 0;
    end if;
    update public.space_standing set local_state = local_state || jsonb_build_object('status', 'losers', 'bracket', 'losers') where space_id = _cat and player_id = _l;

  elsif b.bracket = 'winners' and b.round = 2 then
    -- WB champ -> grand final A; WB-final loser -> LB final B (1st loss).
    update public.tournament_bracket set player_a = _w where category_id = _cat and bracket = 'grand_final' and round = 1 and slot = 0;
    update public.tournament_bracket set player_b = _l where category_id = _cat and bracket = 'losers' and round = 2 and slot = 0;
    update public.space_standing set local_state = local_state || jsonb_build_object('status', 'losers', 'bracket', 'losers') where space_id = _cat and player_id = _l;

  elsif b.bracket = 'losers' and b.round = 1 then
    update public.tournament_bracket set player_a = _w where category_id = _cat and bracket = 'losers' and round = 2 and slot = 0;
    update public.space_standing set local_state = local_state || jsonb_build_object('status', 'eliminated') where space_id = _cat and player_id = _l;

  elsif b.bracket = 'losers' and b.round = 2 then
    -- LB champ -> grand final B.
    update public.tournament_bracket set player_b = _w where category_id = _cat and bracket = 'grand_final' and round = 1 and slot = 0;
    update public.space_standing set local_state = local_state || jsonb_build_object('status', 'eliminated') where space_id = _cat and player_id = _l;

  elsif b.bracket = 'grand_final' and b.round = 1 then
    if m.match_winner = 'a' then
      -- WB champ (player_a, 0 prior losses) wins -> champion.
      update public.space_standing set local_rank = 1, local_state = local_state || jsonb_build_object('status', 'champion') where space_id = _cat and player_id = _w;
      update public.space_standing set local_rank = 2, local_state = local_state || jsonb_build_object('status', 'runner_up') where space_id = _cat and player_id = _l;
    else
      -- LB champ wins game 1 -> bracket reset, same two players in G2.
      update public.tournament_bracket set player_a = b.player_a, player_b = b.player_b where category_id = _cat and bracket = 'grand_final' and round = 2 and slot = 0;
    end if;

  elsif b.bracket = 'grand_final' and b.round = 2 then
    update public.space_standing set local_rank = 1, local_state = local_state || jsonb_build_object('status', 'champion') where space_id = _cat and player_id = _w;
    update public.space_standing set local_rank = 2, local_state = local_state || jsonb_build_object('status', 'runner_up') where space_id = _cat and player_id = _l;
  end if;

  -- promote any slot that now has both players.
  update public.tournament_bracket set status = 'playable'
   where category_id = _cat and status = 'pending' and player_a is not null and player_b is not null;
end $$;

-- Dispatchers.
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
  else perform public._generate_bracket(_category_id); end if;
end $$;

-- ---------------------------------------------------------------------------
-- Seed: a 4-player double-elimination demo.
-- ---------------------------------------------------------------------------
do $$
declare _club uuid; _org uuid; _tour uuid; _cat uuid; r record;
begin
  select id, organizer_id into _club, _org from public.space where slug = 'demo-club' and type = 'club';
  if _club is null then return; end if;

  select id into _tour from public.space where slug = 'torneo-de-demo' and parent_space_id = _club;
  if _tour is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('tournament', _club, 'demo_club.torneo_de', 'Torneo Demo · Doble Eliminación', 'torneo-de-demo', 'members', 'request', null, _org, 'active')
    returning id into _tour;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_tour, 'double_elimination', 'manual', 'padel', 'best_of_3', 'puntual', 1.2);
  end if;

  select id into _cat from public.space where slug = 'torneo-de-open' and parent_space_id = _tour;
  if _cat is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('category', _tour, 'demo_club.torneo_de.open', 'Categoría OPEN', 'torneo-de-open', 'members', 'request', 'padel', _org, 'active')
    returning id into _cat;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_cat, 'double_elimination', 'manual', 'padel', 'best_of_3', 'puntual', 1.2);
  end if;

  for r in
    select p.id from public.profiles p join auth.users u on u.id = p.id
    where u.email in ('demouser@aceplay.cl','demo01@demo.local','demo03@demo.local','demo05@demo.local')
  loop
    insert into public.space_membership (player_id, space_id, role, status)
    values (r.id, _cat, 'player'::public.membership_role, 'active') on conflict (player_id, space_id) do nothing;
  end loop;

  if not exists (select 1 from public.tournament_bracket where category_id = _cat) then
    perform public._generate_double_elim(_cat);
  end if;
end $$;

notify pgrst, 'reload schema';
