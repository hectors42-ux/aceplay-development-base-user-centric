-- Piece 1 (hybrid incremental migration to core player-first):
-- Rewire the rating-onboarding RPCs to the NEW player_ratings schema.
-- No tenant_id, no level/reliability columns: we map onto (user_id, sport, format, rating, rd, nivel).

-- Player-first preference columns used by the onboarding flow.
alter table public.profiles
  add column if not exists preferred_sport text,
  add column if not exists padel_position text;

-- Has the user finished the initial-level questionnaire?  True iff they already have a rating row.
create or replace function public.has_completed_rating_onboarding(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.player_ratings where user_id = _user_id);
$$;

-- Complete onboarding: create/update the player's rating for one sport.
-- Frontend passes _sport in {'tenis_singles','padel'} (RatingSport tokens).
create or replace function public.complete_rating_onboarding(
  _sport text,
  _initial_level numeric,
  _initial_reliability integer default 15
)
returns public.player_ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _sport_key text;
  _format text;
  _is_first boolean;
  _row public.player_ratings;
begin
  if _uid is null then
    raise exception 'No autenticado';
  end if;
  if _initial_level < 0 or _initial_level > 7 then
    raise exception 'Nivel inicial fuera de rango (0-7)';
  end if;

  -- Map frontend sport tokens -> core (sport, format).
  if _sport in ('tenis_singles', 'tennis', 'tenis') then
    _sport_key := 'tennis'; _format := 'singles';
  elsif _sport in ('tenis_dobles', 'tennis_doubles') then
    _sport_key := 'tennis'; _format := 'doubles';
  elsif _sport = 'padel' then
    _sport_key := 'padel'; _format := 'doubles';
  else
    raise exception 'Deporte no soportado: %', _sport;
  end if;

  -- First rating the user creates becomes their primary sport.
  _is_first := not exists (select 1 from public.player_ratings where user_id = _uid);

  insert into public.player_ratings (
    user_id, sport, format, rating, rd, nivel, confidence_tier, is_primary, matches_count, updated_at
  ) values (
    _uid, _sport_key, _format,
    1500,
    greatest(50, 350 - round(_initial_reliability * 3.0)),
    _initial_level,
    'provisional',
    _is_first,
    0,
    now()
  )
  on conflict (user_id, sport, format) do update
    set nivel = excluded.nivel,
        rd = excluded.rd,
        updated_at = now()
  returning * into _row;

  return _row;
end $$;

grant execute on function public.has_completed_rating_onboarding(uuid) to authenticated;
grant execute on function public.complete_rating_onboarding(text, numeric, integer) to authenticated;

-- Ask PostgREST to refresh its schema cache so the new RPCs are callable immediately.
notify pgrst, 'reload schema';
