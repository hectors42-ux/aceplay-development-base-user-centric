-- FASE 3-1: simple rating -> nivel -> category coupling (no tournament gating).
-- When the global rating moves, nivel (and therefore the category via category_config) follows.
-- requires_tournament stays a latent flag in category_config; it is NOT enforced here.

-- Linear, monotonic map between Glicko rating and the 1..7 nivel scale.
create or replace function public.rating_to_nivel(_rating numeric)
returns numeric language sql immutable set search_path = public as $$
  select round(least(7.0, greatest(1.0, (_rating - 1300) / 100.0)), 2);
$$;

create or replace function public.nivel_to_rating(_nivel numeric)
returns numeric language sql immutable set search_path = public as $$
  select 1300 + least(7.0, greatest(0.0, _nivel)) * 100.0;
$$;

-- Onboarding now seeds the rating FROM the questionnaire level so rating and nivel are
-- consistent from the start (rating_to_nivel(rating) == level).
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
  _rating numeric;
  _row public.player_ratings;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  if _initial_level < 0 or _initial_level > 7 then raise exception 'Nivel inicial fuera de rango (0-7)'; end if;

  if _sport in ('tenis_singles', 'tennis', 'tenis') then _sport_key := 'tennis'; _format := 'singles';
  elsif _sport in ('tenis_dobles', 'tennis_doubles') then _sport_key := 'tennis'; _format := 'doubles';
  elsif _sport = 'padel' then _sport_key := 'padel'; _format := 'doubles';
  else raise exception 'Deporte no soportado: %', _sport; end if;

  _is_first := not exists (select 1 from public.player_ratings where user_id = _uid);
  _rating := public.nivel_to_rating(_initial_level);

  insert into public.player_ratings (
    user_id, sport, format, rating, rd, nivel, confidence_tier, is_primary, matches_count, updated_at
  ) values (
    _uid, _sport_key, _format,
    _rating,
    greatest(50, 350 - round(_initial_reliability * 3.0)),
    public.rating_to_nivel(_rating),
    'provisional', _is_first, 0, now()
  )
  on conflict (user_id, sport, format) do update
    set nivel = excluded.nivel,
        rating = excluded.rating,
        rd = excluded.rd,
        updated_at = now()
  returning * into _row;

  return _row;
end $$;

-- Engine: now also update nivel from the new rating, so category/order follow the rating.
create or replace function public.apply_match_to_ratings(_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  _a uuid; _b uuid;
  _sa numeric; _sb numeric;
  ra numeric; rda numeric; ma int;
  rb numeric; rdb numeric; mb int;
  cm numeric;
  q   constant numeric := 0.0057564627325;
  pi2 constant numeric := 9.8696044010893586;
  ga numeric; gb numeric;
  ea numeric; eb numeric;
  d2a numeric; d2b numeric;
  nra numeric; nrda numeric;
  nrb numeric; nrdb numeric;
begin
  select * into m from public.matches where id = _match_id;
  if not found or m.confirmation_status <> 'confirmed' then return; end if;
  if coalesce(array_length(m.side_a, 1), 0) <> 1 or coalesce(array_length(m.side_b, 1), 0) <> 1 then return; end if;
  if exists (select 1 from public.rating_history where match_id = _match_id) then return; end if;

  _a := m.side_a[1]; _b := m.side_b[1];
  _sa := case when m.match_winner = 'a' then 1 else 0 end;
  _sb := 1 - _sa;
  cm := coalesce(m.prestige_mult, 1.0);

  select rating, rd, matches_count into ra, rda, ma
    from public.player_ratings where user_id = _a and sport = m.sport and format = m.format;
  if ra is null then ra := 1500; rda := 350; ma := 0; end if;
  select rating, rd, matches_count into rb, rdb, mb
    from public.player_ratings where user_id = _b and sport = m.sport and format = m.format;
  if rb is null then rb := 1500; rdb := 350; mb := 0; end if;

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

  insert into public.player_ratings (user_id, sport, format, rating, rd, nivel, confidence_tier, is_primary, matches_count, updated_at)
  values (_a, m.sport, m.format, round(nra, 2), round(nrda, 2), public.rating_to_nivel(round(nra, 2)),
          case when ma + 1 >= 5 then 'established' else 'provisional' end, false, ma + 1, now())
  on conflict (user_id, sport, format) do update
    set rating = round(nra, 2), rd = round(nrda, 2),
        nivel = public.rating_to_nivel(round(nra, 2)),
        matches_count = public.player_ratings.matches_count + 1,
        confidence_tier = case when public.player_ratings.matches_count + 1 >= 5 then 'established' else 'provisional' end,
        updated_at = now();

  insert into public.player_ratings (user_id, sport, format, rating, rd, nivel, confidence_tier, is_primary, matches_count, updated_at)
  values (_b, m.sport, m.format, round(nrb, 2), round(nrdb, 2), public.rating_to_nivel(round(nrb, 2)),
          case when mb + 1 >= 5 then 'established' else 'provisional' end, false, mb + 1, now())
  on conflict (user_id, sport, format) do update
    set rating = round(nrb, 2), rd = round(nrdb, 2),
        nivel = public.rating_to_nivel(round(nrb, 2)),
        matches_count = public.player_ratings.matches_count + 1,
        confidence_tier = case when public.player_ratings.matches_count + 1 >= 5 then 'established' else 'provisional' end,
        updated_at = now();

  insert into public.rating_history
    (user_id, sport, format, match_id, rating_before, rating_after, rd_before, rd_after,
     opponent_rating, expected_score, actual_score, context_mult, period_date)
  values
    (_a, m.sport, m.format, _match_id, round(ra,2), round(nra,2), round(rda,2), round(nrda,2),
     round(rb,2), round(ea,4), _sa, cm, current_date),
    (_b, m.sport, m.format, _match_id, round(rb,2), round(nrb,2), round(rdb,2), round(nrdb,2),
     round(ra,2), round(eb,4), _sb, cm, current_date);

  insert into public.points_ledger
    (user_id, sport, format, match_id, season, base_delta, context_mult, prestige_mult, weighted_delta)
  values
    (_a, m.sport, m.format, _match_id, extract(year from now())::int, round(nra-ra,2), cm, cm, round(nra-ra,2)),
    (_b, m.sport, m.format, _match_id, extract(year from now())::int, round(nrb-rb,2), cm, cm, round(nrb-rb,2));
end $$;

-- Re-derive nivel from the current rating for every existing rating row, so the whole
-- ladder/ranking is coherent with ratings from now on.
update public.player_ratings set nivel = public.rating_to_nivel(rating);

notify pgrst, 'reload schema';
