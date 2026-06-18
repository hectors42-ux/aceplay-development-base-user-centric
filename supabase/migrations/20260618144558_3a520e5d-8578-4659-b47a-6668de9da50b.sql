create table public.club_profile (
  space_id uuid primary key references public.space(id) on delete cascade,
  branding jsonb not null default '{}',
  legal_name text,
  tax_id text,
  padron_source text
);
grant select, insert, update, delete on public.club_profile to authenticated;
grant all on public.club_profile to service_role;
alter table public.club_profile enable row level security;

create table public.tournament_config (
  space_id uuid primary key references public.space(id) on delete cascade,
  motor text not null,
  agendamiento text,
  disciplina text not null check (disciplina in ('tennis','padel')),
  scoring text,
  ciclo text,
  prestige_mult numeric not null default 1.0
);
grant select, insert, update, delete on public.tournament_config to authenticated;
grant all on public.tournament_config to service_role;
alter table public.tournament_config enable row level security;

create table public.escalerilla_config (
  space_id uuid primary key references public.space(id) on delete cascade,
  pyramid jsonb not null default '{}',
  challenge_rules jsonb not null default '{}',
  season_label text
);
grant select, insert, update, delete on public.escalerilla_config to authenticated;
grant all on public.escalerilla_config to service_role;
alter table public.escalerilla_config enable row level security;

create policy cp_read on public.club_profile for select using (public.can_access_space(space_id));
create policy cp_write on public.club_profile for all using (public.space_admin(space_id));

create policy tc_read on public.tournament_config for select using (public.can_access_space(space_id));
create policy tc_write on public.tournament_config for all using (public.space_admin(space_id));

create policy ec_read on public.escalerilla_config for select using (public.can_access_space(space_id));
create policy ec_write on public.escalerilla_config for all using (public.space_admin(space_id));