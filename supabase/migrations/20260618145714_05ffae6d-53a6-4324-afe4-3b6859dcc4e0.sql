
-- 1. category_config
create table public.category_config (
  sport text not null check (sport in ('tennis','padel')),
  rank_order int not null,
  category_key text not null,
  label text not null,
  loss_points int not null,
  requires_tournament boolean not null default false,
  is_entry boolean not null default false,
  promotes_to_escalafon boolean not null default false,
  primary key (sport, rank_order)
);
grant select on public.category_config to authenticated, anon;
grant all on public.category_config to service_role;
alter table public.category_config enable row level security;
create policy cc_read on public.category_config for select using (true);

-- 2. matches
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  format text not null,
  source_type text not null check (source_type in ('friendly','escalerilla','tournament','liga','non_competitive')),
  space_id uuid references public.space(id),
  side_a uuid[] not null,
  side_b uuid[] not null,
  match_winner text not null check (match_winner in ('a','b')),
  played_at timestamptz not null,
  verified_event boolean not null default false,
  prestige_mult numeric not null default 1.0,
  confirmation_status text not null default 'pending' check (confirmation_status in ('pending','confirmed','disputed')),
  source_ref jsonb,
  created_at timestamptz not null default now()
);
create index matches_space_idx on public.matches (space_id);
create index matches_played_idx on public.matches (played_at);
grant select, insert, update, delete on public.matches to authenticated;
grant all on public.matches to service_role;
alter table public.matches enable row level security;
create policy matches_read on public.matches for select
  using (public.can_access_space(space_id) or auth.uid() = any(side_a||side_b));

-- 3. match_sets
create table public.match_sets (
  match_id uuid references public.matches(id) on delete cascade,
  set_index int not null,
  games_a int not null,
  games_b int not null,
  is_tiebreak boolean default false,
  is_valid boolean not null,
  primary key (match_id, set_index)
);
grant select, insert, update, delete on public.match_sets to authenticated;
grant all on public.match_sets to service_role;

-- 4. player_ratings
create table public.player_ratings (
  user_id uuid not null references public.profiles(id),
  sport text not null,
  format text not null,
  rating numeric not null default 1500,
  rd numeric not null default 350,
  volatility numeric not null default 0.06,
  nivel numeric,
  matches_count int not null default 0,
  confidence_tier text not null default 'provisional',
  is_primary boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, sport, format),
  check (not (sport='padel' and format='singles'))
);
grant select on public.player_ratings to authenticated;
grant all on public.player_ratings to service_role;
alter table public.player_ratings enable row level security;
create policy ratings_read on public.player_ratings for select using (user_id = auth.uid());

-- 5. rating_history
create table public.rating_history (
  id bigserial primary key,
  user_id uuid references public.profiles(id),
  sport text,
  format text,
  match_id uuid references public.matches(id),
  rating_before numeric,
  rating_after numeric,
  rd_before numeric,
  rd_after numeric,
  opponent_rating numeric,
  expected_score numeric,
  actual_score numeric,
  context_mult numeric,
  capped boolean default false,
  period_date date,
  created_at timestamptz default now()
);
grant select on public.rating_history to authenticated;
grant all on public.rating_history to service_role;

-- 6. ladder_state
create table public.ladder_state (
  user_id uuid not null references public.profiles(id),
  sport text not null,
  format text not null,
  rank_order int not null,
  peldano int not null default 1,
  points_in_category int not null default 0,
  tournament_win_pending boolean not null default false,
  is_primary boolean not null default false,
  updated_at timestamptz default now(),
  primary key (user_id, sport, format)
);
grant select on public.ladder_state to authenticated;
grant all on public.ladder_state to service_role;
alter table public.ladder_state enable row level security;
create policy ladder_read on public.ladder_state for select using (user_id = auth.uid());

-- 7. points_ledger
create table public.points_ledger (
  id bigserial primary key,
  user_id uuid references public.profiles(id),
  sport text,
  format text,
  match_id uuid references public.matches(id),
  season int,
  base_delta numeric,
  context_mult numeric,
  prestige_mult numeric,
  weighted_delta numeric,
  capped boolean default false,
  created_at timestamptz default now()
);
grant select on public.points_ledger to authenticated;
grant all on public.points_ledger to service_role;

-- 8. xp_ledger
create table public.xp_ledger (
  id bigserial primary key,
  user_id uuid references public.profiles(id),
  action_type text,
  xp int,
  week date,
  created_at timestamptz default now()
);
grant select on public.xp_ledger to authenticated;
grant all on public.xp_ledger to service_role;

-- 9. league_state
create table public.league_state (
  user_id uuid references public.profiles(id),
  week date,
  division text,
  xp_week int,
  rank_in_division int,
  primary key (user_id, week)
);
grant select on public.league_state to authenticated;
grant all on public.league_state to service_role;
