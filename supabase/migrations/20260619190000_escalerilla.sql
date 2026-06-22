-- FASE 3-2/3: the escalerilla as a space(type=escalerilla) with local standings.
-- Challenges generate matches that reuse the Fase 2/2.5 engine + anti-farming. On confirm,
-- the GLOBAL rating moves (existing engine) AND the LOCAL position in the escalerilla updates.
-- space_standing.local_rank is LOCAL to the escalerilla, separate from the global rating.

-- ---------------------------------------------------------------------------
-- Ladder result engine: classic "challenge up" rule on a confirmed escalerilla match.
-- side_a = challenger (recorder), side_b = challenged. If the challenger wins and was below,
-- they take the challenged's position and everyone in between drops one spot.
-- ---------------------------------------------------------------------------
create or replace function public.apply_ladder_result(_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  _challenger uuid;
  _challenged uuid;
  _cr int;  -- challenger local_rank
  _dr int;  -- challenged local_rank
begin
  select * into m from public.matches where id = _match_id;
  if not found or m.confirmation_status <> 'confirmed' or m.source_type <> 'escalerilla' then
    return;
  end if;
  _challenger := m.recorded_by;
  _challenged := m.side_b[1];
  if _challenger is null or _challenged is null then return; end if;

  -- Only a challenger win triggers a position change.
  if m.match_winner <> 'a' then return; end if;

  select local_rank into _cr from public.space_standing where space_id = m.space_id and player_id = _challenger;
  select local_rank into _dr from public.space_standing where space_id = m.space_id and player_id = _challenged;
  if _cr is null or _dr is null or _cr <= _dr then return; end if;

  -- Everyone from the challenged's position down to just above the challenger drops one spot...
  update public.space_standing
     set local_rank = local_rank + 1, updated_at = now()
   where space_id = m.space_id and local_rank >= _dr and local_rank < _cr;
  -- ...and the challenger takes the challenged's old position.
  update public.space_standing
     set local_rank = _dr, updated_at = now()
   where space_id = m.space_id and player_id = _challenger;
end $$;

-- Extend the confirm trigger: global rating for every match, plus local position for escalerilla.
create or replace function public.on_match_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.confirmation_status = 'confirmed'
     and (tg_op = 'INSERT' or coalesce(old.confirmation_status, '') <> 'confirmed') then
    perform public.apply_match_to_ratings(new.id);
    if new.source_type = 'escalerilla' then
      perform public.apply_ladder_result(new.id);
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Challenge a player who is ABOVE me in the escalerilla; creates a pending match.
create or replace function public.create_ladder_challenge(
  _escalerilla_id uuid,
  _opponent uuid,
  _winner_is_me boolean,
  _sets jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _sp text; _fmt text;
  _cr int; _dr int;
  _mid uuid; _s jsonb; _idx int := 0;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  if _opponent is null or _opponent = _uid then raise exception 'Rival inválido'; end if;

  select local_rank into _cr from public.space_standing where space_id = _escalerilla_id and player_id = _uid;
  select local_rank into _dr from public.space_standing where space_id = _escalerilla_id and player_id = _opponent;
  if _cr is null then raise exception 'No estás inscrito en esta escalerilla'; end if;
  if _dr is null then raise exception 'El rival no está inscrito en esta escalerilla'; end if;
  if _dr >= _cr then raise exception 'Solo puedes retar a alguien en una posición superior a la tuya'; end if;

  select sport into _sp from public.space where id = _escalerilla_id;
  _sp := coalesce(_sp, 'padel');
  _fmt := case when _sp = 'padel' then 'doubles' else 'singles' end;

  insert into public.matches
    (sport, format, source_type, space_id, side_a, side_b, match_winner, played_at,
     verified_event, prestige_mult, confirmation_status, source_ref, recorded_by)
  values
    (_sp, _fmt, 'escalerilla', _escalerilla_id, array[_uid], array[_opponent],
     case when _winner_is_me then 'a' else 'b' end, now(), false, 1.0, 'pending', '{}'::jsonb, _uid)
  returning id into _mid;

  for _s in select * from jsonb_array_elements(coalesce(_sets, '[]'::jsonb)) loop
    insert into public.match_sets (match_id, set_index, games_a, games_b, is_tiebreak, is_valid)
    values (_mid, _idx, (_s->>'games_a')::int, (_s->>'games_b')::int, coalesce((_s->>'is_tiebreak')::boolean, false), true);
    _idx := _idx + 1;
  end loop;

  return _mid;
end $$;

-- Standings of an escalerilla (local positions + the player's global nivel/category/rating).
create or replace function public.ladder_standings(_escalerilla_id uuid)
returns table (local_rank int, user_id uuid, name text, avatar_url text, nivel numeric, category text, rating numeric)
language sql stable security definer set search_path = public as $$
  with sp as (select sport from public.space where id = _escalerilla_id)
  select
    ss.local_rank, pf.id, pf.display_name, pf.avatar_url,
    pr.nivel,
    (select cc.label from public.category_config cc
       where cc.sport = (select sport from sp)
         and cc.category_key = public.get_player_category(pr.nivel, (select sport from sp)) limit 1),
    pr.rating
  from public.space_standing ss
  join public.profiles pf on pf.id = ss.player_id
  left join public.player_ratings pr
    on pr.user_id = ss.player_id
   and pr.sport = (select sport from sp)
   and pr.format = case when (select sport from sp) = 'padel' then 'doubles' else 'singles' end
  where ss.space_id = _escalerilla_id
  order by ss.local_rank;
$$;

-- Escalerillas the caller can access (membership or hierarchy discovery within the club).
create or replace function public.list_escalerillas()
returns table (space_id uuid, name text, sport text, enrolled boolean, my_rank int, players int)
language sql stable security definer set search_path = public as $$
  select
    s.id, s.name, s.sport,
    exists (select 1 from public.space_membership m where m.space_id = s.id and m.player_id = auth.uid() and m.status = 'active'),
    (select ss.local_rank from public.space_standing ss where ss.space_id = s.id and ss.player_id = auth.uid()),
    (select count(*)::int from public.space_standing ss where ss.space_id = s.id)
  from public.space s
  where s.type = 'escalerilla' and public.can_access_space(s.id)
  order by s.name;
$$;

grant execute on function public.create_ladder_challenge(uuid, uuid, boolean, jsonb) to authenticated;
grant execute on function public.ladder_standings(uuid) to authenticated;
grant execute on function public.list_escalerillas() to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: a demo escalerilla inside the AcePlay Demo Club, with an initial order.
-- demouser starts at #5 so the demo can "challenge up". Idempotent.
-- ---------------------------------------------------------------------------
do $$
declare
  _club uuid; _esc uuid; _org uuid;
  r record;
begin
  select id, organizer_id into _club, _org from public.space where slug = 'demo-club' and type = 'club';
  if _club is null then return; end if;

  -- Club becomes hierarchy-visible so its members discover the escalerilla.
  update public.space set visibility = 'hierarchy' where id = _club and visibility <> 'hierarchy';

  select id into _esc from public.space where slug = 'escalerilla-padel-demo' and parent_space_id = _club;
  if _esc is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('escalerilla', _club, 'demo_club.escalerilla_padel', 'Escalerilla Pádel · Demo',
            'escalerilla-padel-demo', 'members', 'request', 'padel', _org, 'active')
    returning id into _esc;
    insert into public.escalerilla_config (space_id, pyramid, challenge_rules, season_label)
    values (_esc, '{"shape":"pyramid"}'::jsonb,
            '{"challenge_up_only":true,"max_positions_up":3,"loser_drops":false}'::jsonb,
            'Temporada Demo 2026');
  end if;

  for r in
    select p.id,
      case u.email
        when 'demo01@demo.local' then 1 when 'demo02@demo.local' then 2
        when 'demo03@demo.local' then 3 when 'demo04@demo.local' then 4
        when 'demouser@aceplay.cl' then 5 when 'demo05@demo.local' then 6
        when 'demo06@demo.local' then 7 when 'demo07@demo.local' then 8
      end as ord
    from public.profiles p join auth.users u on u.id = p.id
    where u.email in ('demo01@demo.local','demo02@demo.local','demo03@demo.local','demo04@demo.local',
                      'demouser@aceplay.cl','demo05@demo.local','demo06@demo.local','demo07@demo.local')
  loop
    if r.ord is null then continue; end if;
    insert into public.space_membership (player_id, space_id, role, status)
    values (r.id, _esc, 'player'::public.membership_role, 'active')
    on conflict (player_id, space_id) do nothing;
    insert into public.space_standing (space_id, player_id, local_rank)
    values (_esc, r.id, r.ord)
    on conflict (space_id, player_id) do update set local_rank = excluded.local_rank, updated_at = now();
  end loop;
end $$;

notify pgrst, 'reload schema';
