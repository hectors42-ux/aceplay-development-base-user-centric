-- Piece 2 (hybrid incremental): core implementation of user_profile_summary.
-- Returns the ProfileSummary JSON the frontend expects, populated from the core schema.
-- Sections the core doesn't have yet (stats, recent matches/badges, ladder/ranking positions)
-- are returned as safe empty defaults and get filled in later pieces.

create or replace function public.user_profile_summary(_user_id uuid, _sport text default 'tenis_singles')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _sport_key text;
  _format text;
  _pr public.player_ratings%rowtype;
  _profile public.profiles%rowtype;
  _category_label text;
  _reliability int;
begin
  -- Map frontend sport token -> core (sport, format).
  if _sport in ('tenis_singles', 'tennis', 'tenis') then
    _sport_key := 'tennis'; _format := 'singles';
  elsif _sport in ('tenis_dobles', 'tennis_doubles') then
    _sport_key := 'tennis'; _format := 'doubles';
  elsif _sport = 'padel' then
    _sport_key := 'padel'; _format := 'doubles';
  else
    _sport_key := 'tennis'; _format := 'singles';
  end if;

  select * into _profile from public.profiles where id = _user_id;

  select * into _pr from public.player_ratings
   where user_id = _user_id and sport = _sport_key and format = _format
   limit 1;

  if _pr.user_id is not null then
    -- Real club category (label) for the player's nivel, from category_config.
    select cc.label into _category_label
      from public.category_config cc
     where cc.sport = _sport_key
       and cc.category_key = public.get_player_category(_pr.nivel, _sport_key)
     limit 1;
    -- Reliability % derived from Glicko RD (rd 350 -> 0%, rd 50 -> 100%).
    _reliability := greatest(0, least(100, round((350 - _pr.rd) / 3.0)))::int;
  end if;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'user_id', _user_id,
      'first_name', coalesce(nullif(split_part(coalesce(_profile.display_name, ''), ' ', 1), ''), _profile.handle, 'Socio'),
      'last_name', coalesce(nullif(substr(coalesce(_profile.display_name, ''), strpos(coalesce(_profile.display_name, '') || ' ', ' ') + 1), ''), ''),
      'avatar_url', _profile.avatar_url,
      'member_since', _profile.created_at,
      'bio', null, 'dominant_hand', null, 'backhand', null, 'favorite_shot', null,
      'favorite_surface', null, 'playing_style', null, 'availability', null,
      'years_playing', null, 'email', null, 'phone', null,
      'show_email', false, 'show_phone', false
    ),
    'rating', case when _pr.user_id is null then null else jsonb_build_object(
      'sport', _sport,
      'level', _pr.nivel,
      'reliability', _reliability,
      'last_change_delta', 0,
      'matches_played', _pr.matches_count,
      'last_match_at', null,
      'category', _category_label,
      'best_level', _pr.nivel
    ) end,
    'positions', jsonb_build_object('ranking', null, 'ladder', null, 'ladder_status', null),
    'stats', jsonb_build_object(
      'wins', 0, 'losses', 0, 'walkovers_for', 0, 'walkovers_against', 0,
      'streak', 0, 'streak_kind', null
    ),
    'recent_matches', '[]'::jsonb,
    'recent_badges', '[]'::jsonb,
    'sparkline', '[]'::jsonb,
    'flags', jsonb_build_object(
      'is_owner', _user_id = auth.uid(),
      'is_admin', false,
      'show_email', false,
      'show_phone', false
    )
  );
end $$;

grant execute on function public.user_profile_summary(uuid, text) to authenticated;

notify pgrst, 'reload schema';
