-- Piece 3 (hybrid incremental): basic club ranking/escalafon against space_standing.
-- Seeds a demo club (members + standings + demo-user ratings) and exposes club_ranking(_sport),
-- the per-sport leaderboard. Independent per sport via player_ratings (sport, format).

-- ---------------------------------------------------------------------------
-- Seed: demo club, memberships, standings, and ratings for the 16 demo users.
-- Idempotent: safe to re-run. Skips silently if the demo users were never seeded.
-- ---------------------------------------------------------------------------
do $$
declare
  _club uuid;
  _org uuid;
  r record;
  _i int := 0;
  _nivel_t numeric;
  _nivel_p numeric;
begin
  select p.id into _org
    from public.profiles p join auth.users u on u.id = p.id
   where u.email = 'demo01@demo.local';
  if _org is null then
    return; -- demo users not present; nothing to seed
  end if;

  select id into _club from public.space where type = 'club' and slug = 'demo-club' limit 1;
  if _club is null then
    insert into public.space (type, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('club', 'demo_club', 'AcePlay Demo Club', 'demo-club', 'members', 'invite', null, _org, 'active')
    returning id into _club;
  end if;

  for r in
    select p.id, u.email
      from public.profiles p join auth.users u on u.id = p.id
     where u.email = 'demouser@aceplay.cl' or u.email like 'demo%@demo.local'
     order by u.email
  loop
    insert into public.space_membership (player_id, space_id, role, status)
    values (r.id, _club, (case when r.id = _org then 'organizer' else 'player' end)::public.membership_role, 'active')
    on conflict (player_id, space_id) do nothing;

    insert into public.space_standing (space_id, player_id)
    values (_club, r.id)
    on conflict (space_id, player_id) do nothing;

    -- Give the 16 demo users a spread of levels so the leaderboard is populated.
    -- demouser keeps the ratings created by their own onboarding.
    if r.email like 'demo%@demo.local' then
      _i := _i + 1;
      _nivel_t := greatest(1.0, round((6.5 - (_i - 1) * 0.34)::numeric, 2));
      _nivel_p := least(7.0, round((1.6 + (_i - 1) * 0.33)::numeric, 2));
      insert into public.player_ratings (user_id, sport, format, rating, rd, nivel, confidence_tier, is_primary, matches_count)
      values (r.id, 'tennis', 'singles', 1500 + round(_nivel_t * 60), 305, _nivel_t, 'provisional', true, 0)
      on conflict (user_id, sport, format) do nothing;
      insert into public.player_ratings (user_id, sport, format, rating, rd, nivel, confidence_tier, is_primary, matches_count)
      values (r.id, 'padel', 'doubles', 1500 + round(_nivel_p * 60), 305, _nivel_p, 'provisional', false, 0)
      on conflict (user_id, sport, format) do nothing;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: per-sport club leaderboard (ClubRankingRow[] contract).
-- ---------------------------------------------------------------------------
create or replace function public.club_ranking(_sport text)
returns table (
  user_id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  level numeric,
  reliability int,
  matches_played int,
  category text,
  rank_position int,
  prev_rank_position int,
  streak int,
  last_match_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with sk as (
    select case when _sport = 'padel' then 'padel' else 'tennis' end as sport_key,
           case when _sport = 'padel' then 'doubles' else 'singles' end as fmt
  ),
  club as (
    select s.id
      from public.space s
      join public.space_membership m on m.space_id = s.id
     where s.type = 'club' and m.player_id = auth.uid() and m.status = 'active'
     limit 1
  )
  select
    pr.user_id,
    nullif(split_part(coalesce(pf.display_name, ''), ' ', 1), '') as first_name,
    nullif(trim(substr(coalesce(pf.display_name, ''), strpos(coalesce(pf.display_name, '') || ' ', ' ') + 1)), '') as last_name,
    pf.avatar_url,
    pr.nivel as level,
    greatest(0, least(100, round((350 - pr.rd) / 3.0)))::int as reliability,
    pr.matches_count as matches_played,
    (select cc.label from public.category_config cc
      where cc.sport = (select sport_key from sk)
        and cc.category_key = public.get_player_category(pr.nivel, (select sport_key from sk))
      limit 1) as category,
    row_number() over (order by pr.nivel desc, pr.rating desc, pf.display_name)::int as rank_position,
    null::int as prev_rank_position,
    0 as streak,
    null::timestamptz as last_match_at
  from public.space_standing ss
  join public.player_ratings pr
    on pr.user_id = ss.player_id
   and pr.sport = (select sport_key from sk)
   and pr.format = (select fmt from sk)
  join public.profiles pf on pf.id = pr.user_id
  where ss.space_id = (select id from club)
  order by rank_position;
$$;

grant execute on function public.club_ranking(text) to authenticated;

notify pgrst, 'reload schema';
