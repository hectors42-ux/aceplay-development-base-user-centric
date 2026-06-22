-- Enable RLS on the 5 core tables that were created without it, with SELECT-only policies.
-- Writes (insert/update/delete) are intentionally NOT exposed to `authenticated`:
-- only the engine / service_role writes, which bypasses RLS. So no write policies are defined.

-- rating_history / points_ledger / xp_ledger / league_state -> STRICTLY PRIVATE (own rows only).
-- Aggregated visibility (escalafon, ranking, liga) is served via space_standing / views,
-- never by granting access to these raw tables.

alter table public.rating_history enable row level security;
drop policy if exists rating_history_read on public.rating_history;
create policy rating_history_read on public.rating_history
  for select using (user_id = auth.uid());

alter table public.points_ledger enable row level security;
drop policy if exists points_ledger_read on public.points_ledger;
create policy points_ledger_read on public.points_ledger
  for select using (user_id = auth.uid());

alter table public.xp_ledger enable row level security;
drop policy if exists xp_ledger_read on public.xp_ledger;
create policy xp_ledger_read on public.xp_ledger
  for select using (user_id = auth.uid());

alter table public.league_state enable row level security;
drop policy if exists league_state_read on public.league_state;
create policy league_state_read on public.league_state
  for select using (user_id = auth.uid());

-- match_sets -> inherits the visibility of its parent match.
-- The predicate below is kept IDENTICAL to matches_read so the two never diverge.
alter table public.match_sets enable row level security;
drop policy if exists match_sets_read on public.match_sets;
create policy match_sets_read on public.match_sets
  for select using (
    exists (
      select 1 from public.matches m
      where m.id = match_sets.match_id
        and (public.can_access_space(m.space_id) or auth.uid() = any(m.side_a||m.side_b))
    )
  );

-- match_sets still carried INSERT/UPDATE/DELETE grants to `authenticated` from the initial
-- schema. RLS already denies those writes (no write policy), but revoke the grants too so the
-- "service_role writes only" intent is explicit at the privilege layer as well.
revoke insert, update, delete on public.match_sets from authenticated;
