
-- PRD 6 · Share Cards — RPCs para stats, momento activo y standings snapshot.

create or replace function public.get_share_card_stats(
  _tournament_id uuid,
  _user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _category_id uuid;
  _registration_id uuid;
  _total_players int;
  _latest_snapshot record;
  _wins int := 0;
  _losses int := 0;
  _is_winner boolean := false;
  _profile record;
begin
  select tr.id, tr.tournament_category_id
    into _registration_id, _category_id
  from tournament_registrations tr
  where tr.tournament_id = _tournament_id
    and (tr.player1_user_id = _user_id or tr.player2_user_id = _user_id)
    and tr.status in ('confirmed','registered')
  order by tr.registered_at asc
  limit 1;

  if _registration_id is null then
    return jsonb_build_object('found', false);
  end if;

  select count(*)::int into _total_players
  from tournament_registrations
  where tournament_category_id = _category_id
    and status in ('confirmed','registered');

  select position, points, consecutive_wins, snapshot_at
    into _latest_snapshot
  from standings_snapshots
  where tournament_id = _tournament_id
    and category_id = _category_id
    and user_id = _user_id
  order by snapshot_at desc
  limit 1;

  select
    count(*) filter (where r.winner_registration_id = _registration_id)::int,
    count(*) filter (where r.winner_registration_id is not null and r.winner_registration_id <> _registration_id)::int
    into _wins, _losses
  from tournament_match_results r
  join tournament_matches m on m.id = r.match_id
  where m.tournament_id = _tournament_id
    and r.status = 'confirmed'
    and (
      m.registration_a_id = _registration_id
      or m.registration_b_id = _registration_id
    );

  if _latest_snapshot.position = 1 then
    select (status = 'finalizado') into _is_winner
    from tournament_categories
    where id = _category_id;
  end if;

  select first_name, last_name, avatar_url
    into _profile
  from profiles
  where user_id = _user_id;

  return jsonb_build_object(
    'found', true,
    'category_id', _category_id,
    'registration_id', _registration_id,
    'rank', _latest_snapshot.position,
    'points', coalesce(_latest_snapshot.points, 0),
    'consecutive_wins', coalesce(_latest_snapshot.consecutive_wins, 0),
    'total_players', _total_players,
    'wins', _wins,
    'losses', _losses,
    'is_winner', coalesce(_is_winner, false),
    'user', jsonb_build_object(
      'first_name', _profile.first_name,
      'last_name', _profile.last_name,
      'avatar_url', _profile.avatar_url
    )
  );
end;
$$;

grant execute on function public.get_share_card_stats(uuid, uuid) to authenticated, anon;


create or replace function public.get_active_share_moment(
  _tournament_id uuid,
  _user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _cw int := 0;
  _delta int := 0;
  _last record;
  _prev record;
begin
  select consecutive_wins into _cw
  from tournament_registrations
  where tournament_id = _tournament_id
    and (player1_user_id = _user_id or player2_user_id = _user_id)
    and status in ('confirmed','registered')
  order by registered_at asc
  limit 1;

  if _cw is null then
    return jsonb_build_object('active', false);
  end if;

  select position, snapshot_at into _last
  from standings_snapshots
  where tournament_id = _tournament_id
    and user_id = _user_id
  order by snapshot_at desc
  limit 1;

  select position into _prev
  from standings_snapshots
  where tournament_id = _tournament_id
    and user_id = _user_id
    and snapshot_at < coalesce(_last.snapshot_at, now())
  order by snapshot_at desc
  limit 1;

  if _prev.position is not null and _last.position is not null then
    _delta := _prev.position - _last.position;
  end if;

  if _cw >= 3 then
    return jsonb_build_object('active', true, 'kind', 'streak', 'value', _cw, 'rank', _last.position, 'delta', _delta);
  end if;

  if _delta >= 3 then
    return jsonb_build_object('active', true, 'kind', 'climb', 'value', _delta, 'rank', _last.position, 'delta', _delta);
  end if;

  return jsonb_build_object('active', false);
end;
$$;

grant execute on function public.get_active_share_moment(uuid, uuid) to authenticated, anon;


create or replace function public.get_share_standings(
  _tournament_id uuid,
  _category_id uuid default null,
  _limit int default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _cat uuid;
  _rows jsonb;
begin
  if _category_id is not null then
    _cat := _category_id;
  else
    select id into _cat
    from tournament_categories
    where tournament_id = _tournament_id
    order by sort_order asc
    limit 1;
  end if;

  if _cat is null then
    return jsonb_build_object('rows', '[]'::jsonb);
  end if;

  with latest as (
    select distinct on (user_id)
      user_id, position, points
    from standings_snapshots
    where tournament_id = _tournament_id
      and category_id = _cat
    order by user_id, snapshot_at desc
  ),
  top as (
    select * from latest order by position asc limit _limit
  )
  select jsonb_agg(
           jsonb_build_object(
             'user_id', t.user_id,
             'position', t.position,
             'points', t.points,
             'first_name', p.first_name,
             'last_name', p.last_name,
             'avatar_url', p.avatar_url
           ) order by t.position asc
         )
    into _rows
  from top t
  left join profiles p on p.user_id = t.user_id;

  return jsonb_build_object('category_id', _cat, 'rows', coalesce(_rows, '[]'::jsonb));
end;
$$;

grant execute on function public.get_share_standings(uuid, uuid, int) to authenticated, anon;
