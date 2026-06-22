-- FASE 2.5-A: anti-farming on match confirmation + helper RPCs for the result-loading UI.
-- Criteria: no tenant_id; the recorder never confirms their own match; rating only moves on 'confirmed'.

-- Who recorded the match (set by record_match).
alter table public.matches add column if not exists recorded_by uuid references public.profiles(id);

-- record_match: now stamps recorded_by = caller.
create or replace function public.record_match(
  _space_id uuid,
  _sport text,
  _format text,
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
  _sport_key text;
  _fmt text;
  _mid uuid;
  _s jsonb;
  _idx int := 0;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  if _opponent is null or _opponent = _uid then raise exception 'Rival inválido'; end if;

  if _sport in ('tenis_singles','tennis','tenis') then _sport_key:='tennis'; _fmt:=coalesce(nullif(_format,''),'singles');
  elsif _sport = 'padel' then _sport_key:='padel'; _fmt:='doubles';
  elsif _sport = 'tennis' then _sport_key:='tennis'; _fmt:=coalesce(nullif(_format,''),'singles');
  else raise exception 'Deporte no soportado: %', _sport; end if;

  insert into public.matches
    (sport, format, source_type, space_id, side_a, side_b, match_winner, played_at,
     verified_event, prestige_mult, confirmation_status, source_ref, recorded_by)
  values
    (_sport_key, _fmt, 'friendly', _space_id, array[_uid], array[_opponent],
     case when _winner_is_me then 'a' else 'b' end, now(),
     false, 1.0, 'pending', '{}'::jsonb, _uid)
  returning id into _mid;

  for _s in select * from jsonb_array_elements(coalesce(_sets, '[]'::jsonb)) loop
    insert into public.match_sets (match_id, set_index, games_a, games_b, is_tiebreak, is_valid)
    values (_mid, _idx, (_s->>'games_a')::int, (_s->>'games_b')::int,
            coalesce((_s->>'is_tiebreak')::boolean, false), true);
    _idx := _idx + 1;
  end loop;

  return _mid;
end $$;

-- Shared guard: the caller must be a participant on the OPPOSITE side from the recorder,
-- and must not be the recorder. Raises on violation. Returns the match row.
create or replace function public._assert_opponent_can_act(_match_id uuid)
returns public.matches
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  select * into m from public.matches where id = _match_id;
  if not found then raise exception 'Partido no encontrado'; end if;
  if m.confirmation_status <> 'pending' then raise exception 'El partido no está pendiente (estado: %)', m.confirmation_status; end if;
  if m.recorded_by is null then raise exception 'Partido sin registrante; no se puede actuar'; end if;
  if _uid = m.recorded_by then raise exception 'No puedes confirmar/disputar tu propio partido'; end if;
  if not (_uid = any(m.side_a || m.side_b)) then raise exception 'No participas en este partido'; end if;
  if (m.recorded_by = any(m.side_a)) = (_uid = any(m.side_a)) then
    raise exception 'Solo un jugador del lado rival al registrante puede confirmar/disputar';
  end if;
  return m;
end $$;

-- confirm_match: anti-farming enforced; flips to 'confirmed' (fires the rating engine);
-- returns the caller's resulting rating delta for the UI.
-- Drop first: the previous version returned void, and return type can't be changed in place.
drop function if exists public.confirm_match(uuid);
create or replace function public.confirm_match(_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  _uid uuid := auth.uid();
  _delta jsonb;
begin
  m := public._assert_opponent_can_act(_match_id);
  update public.matches set confirmation_status = 'confirmed' where id = m.id;
  -- trigger trg_match_confirmed has now run the engine; read this player's delta.
  select jsonb_build_object(
           'rating_before', rating_before,
           'rating_after', rating_after,
           'delta', round(rating_after - rating_before, 2)
         )
    into _delta
    from public.rating_history
   where match_id = _match_id and user_id = _uid;
  return coalesce(_delta, '{}'::jsonb);
end $$;

-- dispute_match: opponent rejects; status 'disputed' (does NOT feed the rating).
create or replace function public.dispute_match(_match_id uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  _uid uuid := auth.uid();
begin
  m := public._assert_opponent_can_act(_match_id);
  update public.matches
     set confirmation_status = 'disputed',
         source_ref = coalesce(source_ref, '{}'::jsonb)
                      || jsonb_build_object('dispute_reason', coalesce(_reason, ''), 'disputed_by', _uid)
   where id = m.id;
end $$;

-- ---------------------------------------------------------------------------
-- Helper RPCs for the UI.
-- ---------------------------------------------------------------------------

-- Spaces the caller belongs to (space picker).
create or replace function public.my_match_spaces()
returns table (space_id uuid, name text, sport text, type text)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.sport, s.type::text
  from public.space s
  join public.space_membership m on m.space_id = s.id
  where m.player_id = auth.uid() and m.status = 'active'
  order by s.name;
$$;

-- Active members of a space, excluding the caller (opponent picker). Only if the caller is a member.
create or replace function public.space_roster(_space_id uuid)
returns table (user_id uuid, name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select pf.id, pf.display_name, pf.avatar_url
  from public.space_membership m
  join public.profiles pf on pf.id = m.player_id
  where m.space_id = _space_id and m.status = 'active'
    and pf.id <> auth.uid()
    and exists (
      select 1 from public.space_membership me
      where me.space_id = _space_id and me.player_id = auth.uid() and me.status = 'active'
    )
  order by pf.display_name;
$$;

-- Pending matches the caller should confirm (rival side, not the recorder).
create or replace function public.pending_confirmations()
returns table (
  match_id uuid, space_id uuid, sport text, format text,
  recorder_name text, i_won boolean, played_at timestamptz, score jsonb
)
language sql stable security definer set search_path = public as $$
  select
    m.id, m.space_id, m.sport, m.format,
    rec.display_name,
    case when auth.uid() = any(m.side_a) then (m.match_winner = 'a') else (m.match_winner = 'b') end,
    m.played_at,
    coalesce(
      (select jsonb_agg(jsonb_build_object('a', ms.games_a, 'b', ms.games_b) order by ms.set_index)
         from public.match_sets ms where ms.match_id = m.id),
      '[]'::jsonb
    )
  from public.matches m
  join public.profiles rec on rec.id = m.recorded_by
  where m.confirmation_status = 'pending'
    and auth.uid() = any(m.side_a || m.side_b)
    and auth.uid() <> m.recorded_by
    and (m.recorded_by = any(m.side_a)) <> (auth.uid() = any(m.side_a))
  order by m.played_at desc;
$$;

grant execute on function public.record_match(uuid, text, text, uuid, boolean, jsonb) to authenticated;
grant execute on function public.confirm_match(uuid) to authenticated;
grant execute on function public.dispute_match(uuid, text) to authenticated;
grant execute on function public.my_match_spaces() to authenticated;
grant execute on function public.space_roster(uuid) to authenticated;
grant execute on function public.pending_confirmations() to authenticated;

notify pgrst, 'reload schema';
