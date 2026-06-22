-- FASE 2 (hybrid incremental): match results -> Glicko rating engine on the core.
-- Blueprint criteria honored:
--  1. Match has space_id (context/visibility) but updates the GLOBAL player_ratings.
--  2. The engine runs server-side (trigger). The frontend never recalculates rating.
--  3. The engine touches player_ratings/rating_history/points_ledger, NEVER space_standing.
--  4. Strictly per (sport, format): tennis and padel never cross.
--  5. No tenant_id. Match visibility via can_access_space; writes gated by participation.

-- ---------------------------------------------------------------------------
-- Engine: apply a confirmed 1v1 singles/doubles-as-pair match to BOTH players'
-- global ratings. Idempotent (skips if rating_history already has the match).
-- ---------------------------------------------------------------------------
create or replace function public.apply_match_to_ratings(_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  _a uuid; _b uuid;
  _sa numeric; _sb numeric;          -- actual scores (1 win / 0 loss)
  ra numeric; rda numeric; ma int;   -- player A snapshot
  rb numeric; rdb numeric; mb int;   -- player B snapshot
  cm numeric;                        -- context multiplier (match prestige)
  q   constant numeric := 0.0057564627325;   -- ln(10)/400
  pi2 constant numeric := 9.8696044010893586; -- pi^2
  ga numeric; gb numeric;            -- g(RD) of the opponent
  ea numeric; eb numeric;            -- expected scores
  d2a numeric; d2b numeric;
  nra numeric; nrda numeric;         -- new A
  nrb numeric; nrdb numeric;         -- new B
begin
  select * into m from public.matches where id = _match_id;
  if not found or m.confirmation_status <> 'confirmed' then
    return;
  end if;
  -- Minimal flow: exactly one player per side (singles, or a doubles pair treated as one unit later).
  if coalesce(array_length(m.side_a, 1), 0) <> 1 or coalesce(array_length(m.side_b, 1), 0) <> 1 then
    return;
  end if;
  -- Idempotency guard.
  if exists (select 1 from public.rating_history where match_id = _match_id) then
    return;
  end if;

  _a := m.side_a[1];
  _b := m.side_b[1];
  _sa := case when m.match_winner = 'a' then 1 else 0 end;
  _sb := 1 - _sa;
  cm := coalesce(m.prestige_mult, 1.0);

  -- Pre-match snapshots for THIS sport+format only (defaults for a first-ever match).
  select rating, rd, matches_count into ra, rda, ma
    from public.player_ratings where user_id = _a and sport = m.sport and format = m.format;
  if ra is null then ra := 1500; rda := 350; ma := 0; end if;
  select rating, rd, matches_count into rb, rdb, mb
    from public.player_ratings where user_id = _b and sport = m.sport and format = m.format;
  if rb is null then rb := 1500; rdb := 350; mb := 0; end if;

  -- Glicko-1 single-period update (both computed from the same pre-match snapshot).
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

  -- Update the GLOBAL ratings (criterion 1 & 3: never space_standing). Per (sport, format) (criterion 4).
  insert into public.player_ratings (user_id, sport, format, rating, rd, confidence_tier, is_primary, matches_count, updated_at)
  values (_a, m.sport, m.format, round(nra, 2), round(nrda, 2),
          case when ma + 1 >= 5 then 'established' else 'provisional' end, false, ma + 1, now())
  on conflict (user_id, sport, format) do update
    set rating = round(nra, 2), rd = round(nrda, 2),
        matches_count = public.player_ratings.matches_count + 1,
        confidence_tier = case when public.player_ratings.matches_count + 1 >= 5 then 'established' else 'provisional' end,
        updated_at = now();

  insert into public.player_ratings (user_id, sport, format, rating, rd, confidence_tier, is_primary, matches_count, updated_at)
  values (_b, m.sport, m.format, round(nrb, 2), round(nrdb, 2),
          case when mb + 1 >= 5 then 'established' else 'provisional' end, false, mb + 1, now())
  on conflict (user_id, sport, format) do update
    set rating = round(nrb, 2), rd = round(nrdb, 2),
        matches_count = public.player_ratings.matches_count + 1,
        confidence_tier = case when public.player_ratings.matches_count + 1 >= 5 then 'established' else 'provisional' end,
        updated_at = now();

  -- Audit trail.
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

-- Trigger: fire the engine when a match becomes 'confirmed' (criterion 2).
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
  end if;
  return new;
end $$;

drop trigger if exists trg_match_confirmed on public.matches;
create trigger trg_match_confirmed
  after insert or update of confirmation_status on public.matches
  for each row execute function public.on_match_confirmed();

-- ---------------------------------------------------------------------------
-- RPC: record a pending match between the caller and an opponent in a space.
-- ---------------------------------------------------------------------------
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

  -- Normalize sport/format (accept frontend tokens too).
  if _sport in ('tenis_singles','tennis','tenis') then _sport_key:='tennis'; _fmt:=coalesce(nullif(_format,''),'singles');
  elsif _sport = 'padel' then _sport_key:='padel'; _fmt:='doubles';
  elsif _sport = 'tennis' then _sport_key:='tennis'; _fmt:=coalesce(nullif(_format,''),'singles');
  else raise exception 'Deporte no soportado: %', _sport; end if;

  insert into public.matches
    (sport, format, source_type, space_id, side_a, side_b, match_winner, played_at,
     verified_event, prestige_mult, confirmation_status, source_ref)
  values
    (_sport_key, _fmt, 'friendly', _space_id, array[_uid], array[_opponent],
     case when _winner_is_me then 'a' else 'b' end, now(),
     false, 1.0, 'pending', '{}'::jsonb)
  returning id into _mid;

  -- Optional sets payload: [{games_a, games_b, is_tiebreak?}].
  for _s in select * from jsonb_array_elements(coalesce(_sets, '[]'::jsonb)) loop
    insert into public.match_sets (match_id, set_index, games_a, games_b, is_tiebreak, is_valid)
    values (_mid, _idx,
            (_s->>'games_a')::int, (_s->>'games_b')::int,
            coalesce((_s->>'is_tiebreak')::boolean, false), true);
    _idx := _idx + 1;
  end loop;

  return _mid;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: confirm a pending match. A participant confirms; this flips the status,
-- which fires the engine. (Opponent-only confirmation + dispute is a follow-up.)
-- ---------------------------------------------------------------------------
create or replace function public.confirm_match(_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  update public.matches
     set confirmation_status = 'confirmed'
   where id = _match_id
     and confirmation_status = 'pending'
     and _uid = any(side_a || side_b);
  if not found then
    raise exception 'Partido no encontrado, ya confirmado, o no participas en él';
  end if;
end $$;

grant execute on function public.record_match(uuid, text, text, uuid, boolean, jsonb) to authenticated;
grant execute on function public.confirm_match(uuid) to authenticated;

notify pgrst, 'reload schema';
