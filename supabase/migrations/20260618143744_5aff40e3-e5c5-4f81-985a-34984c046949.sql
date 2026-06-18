drop schema public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant create on schema public to service_role;

create extension if not exists ltree with schema public;

-- IDENTIDAD GLOBAL
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  display_name text not null,
  avatar_url text,
  rut text,
  birthdate date,
  data_consent jsonb not null default '{}',
  created_at timestamptz not null default now()
);
-- is_minor como función computada (current_date no es inmutable → no se puede como columna generada)
create or replace function public.is_minor(p public.profiles) returns boolean
language sql stable as $$
  select p.birthdate is not null and p.birthdate > current_date - interval '18 years'
$$;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ENUMS
create type public.space_type as enum ('club','tournament','category','escalerilla','liga','escalafon');
create type public.space_visibility as enum ('public','members','hierarchy');
create type public.join_policy as enum ('open','request','invite','code','socios_only');
create type public.membership_role as enum ('owner','admin','organizer','player','spectator');
create type public.membership_status as enum ('active','pending','invited','suspended','left');

-- ESPACIOS
create table public.space (
  id uuid primary key default gen_random_uuid(),
  type public.space_type not null,
  parent_space_id uuid references public.space(id) on delete restrict,
  path ltree not null,
  name text not null,
  slug text not null,
  visibility public.space_visibility not null default 'members',
  join_policy public.join_policy not null default 'invite',
  sport text check (sport in ('tennis','padel')),
  organizer_id uuid not null references public.profiles(id),
  status text not null default 'active',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (parent_space_id, slug)
);
grant select, insert, update, delete on public.space to authenticated;
grant all on public.space to service_role;
alter table public.space enable row level security;

create index space_path_gist on public.space using gist (path);
create index space_parent_idx on public.space (parent_space_id);
create index space_type_idx on public.space (type);

create or replace function public.space_set_path() returns trigger language plpgsql as $$
declare parent_path ltree; parent_type public.space_type;
begin
  if new.parent_space_id is null then
    new.path := text2ltree(regexp_replace(new.slug,'[^a-zA-Z0-9_]','_','g'));
  else
    select path, type into parent_path, parent_type from public.space where id = new.parent_space_id;
    new.path := parent_path || regexp_replace(new.slug,'[^a-zA-Z0-9_]','_','g');
    if new.type = 'category' and parent_type <> 'tournament' then
      raise exception 'category must have a tournament parent';
    end if;
  end if;
  if new.type = 'category' and new.parent_space_id is null then
    raise exception 'category cannot be root';
  end if;
  return new;
end $$;

create trigger trg_space_path before insert or update of parent_space_id, slug
  on public.space for each row execute function public.space_set_path();

-- PERTENENCIA
create table public.space_membership (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid not null references public.space(id) on delete cascade,
  role public.membership_role not null default 'player',
  status public.membership_status not null default 'active',
  invited_by uuid references public.profiles(id),
  joined_at timestamptz not null default now(),
  unique (player_id, space_id)
);
grant select, insert, update, delete on public.space_membership to authenticated;
grant all on public.space_membership to service_role;
alter table public.space_membership enable row level security;

create index sm_player_idx on public.space_membership (player_id);
create index sm_space_idx on public.space_membership (space_id, status);

-- STANDING LOCAL
create table public.space_standing (
  space_id uuid not null references public.space(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  local_rank int,
  local_state jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (space_id, player_id)
);
grant select, insert, update, delete on public.space_standing to authenticated;
grant all on public.space_standing to service_role;
alter table public.space_standing enable row level security;