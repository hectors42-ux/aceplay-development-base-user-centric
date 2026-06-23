-- ============================================================================
-- CAPA DE ENGANCHE (XP / Ligas / Rachas / Misiones / Insignias) — la capa
-- "Duolingo", COSTO CERO, SEPARADA del motor competitivo (Glicko).
--
-- FIREWALL DE 3 CRUCES (invariante que el resto del código respeta y testea):
--   (a) Nada de XP escribe jamás en el ledger de Rating (player_ratings /
--       rating_history) ni en points_ledger (capa de HABILIDAD).
--   (b) Las Fichas (capa futura) no compran XP ni viceversa.
--   (c) Toda conversión entre capas es explícita y unidireccional.
-- El Glicko SOLO se alimenta de partidos confirmados (motor intacto).
--
-- Player-first, cero tenant_id. Tenis y pádel NUNCA se cruzan: todo lo de XP
-- se separa por sport_id ('tennis' | 'padel', mismos valores que matches.sport).
-- Parámetros = economy_config (editables por admin), NO hardcode.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- economy_config: fuente única de parámetros (faucet de XP, anti-gaming, ligas,
-- rachas). Editable; arranca con los defaults indicados en el brief.
-- ----------------------------------------------------------------------------
create table if not exists public.economy_config (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- xp_ledger: append-only. (El xp_ledger legacy era un stub vacío; lo recreamos
-- con el esquema de la capa de enganche.)
-- ----------------------------------------------------------------------------
drop table if exists public.xp_ledger cascade;
create table public.xp_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null,
  sport_id   text not null,
  action     text not null,
  base_xp    integer not null,
  weight     numeric not null default 1.0,
  final_xp   integer not null,
  ref_type   text,
  ref_id     text,
  created_at timestamptz not null default now()
);
create index xp_ledger_user_idx on public.xp_ledger (user_id, created_at desc);
create index xp_ledger_user_sport_idx on public.xp_ledger (user_id, sport_id, created_at desc);
-- Idempotencia por ref: un mismo (user, action, ref) se otorga una sola vez.
create unique index xp_ledger_idem_idx on public.xp_ledger (user_id, action, ref_type, ref_id)
  where ref_id is not null;

-- ----------------------------------------------------------------------------
-- Ligas semanales (por deporte). tier es un entero (1 = más bajo).
-- ----------------------------------------------------------------------------
create table if not exists public.leagues (
  id         uuid primary key default gen_random_uuid(),
  sport_id   text not null,
  tier       integer not null default 1,
  week_start date not null,
  week_end   date not null,
  status     text not null default 'active',  -- active | closed
  created_at timestamptz not null default now()
);
create index leagues_sport_status_idx on public.leagues (sport_id, status, tier);

create table if not exists public.league_members (
  id        uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id   uuid not null,
  xp_week   integer not null default 0,
  rank      integer,
  movement  text,  -- up | down | same | promoted | relegated
  unique (league_id, user_id)
);
create index league_members_user_idx on public.league_members (user_id);
create index league_members_league_idx on public.league_members (league_id, xp_week desc);

-- ----------------------------------------------------------------------------
-- Rachas semanales (por deporte).
-- ----------------------------------------------------------------------------
create table if not exists public.streaks (
  user_id           uuid not null,
  sport_id          text not null,
  current_weeks     integer not null default 0,
  longest_weeks     integer not null default 0,
  last_active_week  date,
  freezes_available integer not null default 2,
  updated_at        timestamptz not null default now(),
  primary key (user_id, sport_id)
);

-- ----------------------------------------------------------------------------
-- Misiones (catálogo) + progreso por usuario.
-- ----------------------------------------------------------------------------
create table if not exists public.missions (
  id        uuid primary key default gen_random_uuid(),
  code      text unique not null,
  title     text not null,
  target    integer not null,
  reward_xp integer not null default 0,
  period    text not null default 'weekly',  -- weekly | daily | once
  active    boolean not null default true
);

create table if not exists public.mission_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  mission_id   uuid not null references public.missions(id) on delete cascade,
  progress     integer not null default 0,
  completed_at timestamptz,
  unique (user_id, mission_id)
);
create index mission_progress_user_idx on public.mission_progress (user_id);

-- ----------------------------------------------------------------------------
-- Insignias (catálogo) + asignaciones.
-- ----------------------------------------------------------------------------
create table if not exists public.badges (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  title       text not null,
  description text,
  icon        text
);

create table if not exists public.user_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  badge_id   uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_id)
);
create index user_badges_user_idx on public.user_badges (user_id);

-- ----------------------------------------------------------------------------
-- RLS: lectura acotada; TODA escritura va por RPCs SECURITY DEFINER (no hay
-- policies de insert/update para authenticated → escritura directa bloqueada).
-- ----------------------------------------------------------------------------
alter table public.economy_config  enable row level security;
alter table public.xp_ledger       enable row level security;
alter table public.leagues         enable row level security;
alter table public.league_members  enable row level security;
alter table public.streaks         enable row level security;
alter table public.missions        enable row level security;
alter table public.mission_progress enable row level security;
alter table public.badges          enable row level security;
alter table public.user_badges     enable row level security;

create policy economy_config_read on public.economy_config for select to authenticated using (true);
create policy xp_ledger_read on public.xp_ledger for select to authenticated using (user_id = auth.uid());
create policy leagues_read on public.leagues for select to authenticated using (true);
create policy league_members_read on public.league_members for select to authenticated using (true);
create policy streaks_read on public.streaks for select to authenticated using (user_id = auth.uid());
create policy missions_read on public.missions for select to authenticated using (true);
create policy mission_progress_read on public.mission_progress for select to authenticated using (user_id = auth.uid());
create policy badges_read on public.badges for select to authenticated using (true);
create policy user_badges_read on public.user_badges for select to authenticated using (true);

grant select on public.economy_config, public.xp_ledger, public.leagues, public.league_members,
  public.streaks, public.missions, public.mission_progress, public.badges, public.user_badges to authenticated;

-- ----------------------------------------------------------------------------
-- Seed de parámetros (defaults del brief). Editables por admin después.
-- ----------------------------------------------------------------------------
insert into public.economy_config (key, value) values
  ('xp_faucet', jsonb_build_object(
    'partido_torneo_verificado', jsonb_build_object('base', 150, 'weight', 1.0),
    'invitado_activado',         jsonb_build_object('base', 200, 'weight', 1.0),
    'perfil_calibracion',        jsonb_build_object('base', 100, 'weight', 1.0, 'once', true),
    'reto_escalerilla',          jsonb_build_object('base', 75,  'weight', 0.7),
    'amistoso_confirmado',       jsonb_build_object('base', 40,  'weight', 0.3),
    'confirmar_partido_rival',   jsonb_build_object('base', 20,  'weight', 1.0)
  )),
  -- Anti-gaming: retornos decrecientes vs el MISMO rival + topes por acción/período.
  --  * repeat_window_days/repeat_decay: jugar repetido contra el mismo rival rinde
  --    cada vez menos XP (protege la densidad/calidad del dato: premiar "aparecer"
  --    no debe volverse farmear con un amigo).
  --  * daily_cap_per_action / weekly_cap_total: techos de XP por acción/día y total/
  --    semana (protege contra grindear una sola acción).
  ('xp_anti_gaming', jsonb_build_object(
    'repeat_window_days', 7,
    'repeat_decay',       0.5,
    'daily_cap_per_action', 600,
    'weekly_cap_total',   3000
  )),
  -- Ligas: tamaño objetivo + cuántos ascienden/descienden + nombres de tier.
  ('league', jsonb_build_object(
    'size', 30, 'promote', 7, 'relegate', 7,
    'tiers', jsonb_build_array('Bronce', 'Plata', 'Oro', 'Platino', 'Diamante')
  )),
  ('streak', jsonb_build_object('freezes_default', 2))
on conflict (key) do nothing;

notify pgrst, 'reload schema';
