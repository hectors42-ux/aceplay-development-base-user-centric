-- ============================================================================
-- ÉPICA C: gestión de marcas + presencia transversal (placements) + portal
-- admin. Admin-first; rotación y prioridad pagada.
--
-- REGLA DE FINANCIAMIENTO (no negociable): los beneficios de CLUB entran como
-- inventario FINANCIADO POR EL CLUB. El club se modela como un brand vinculado a
-- club_id; sus reward_items se financian de su lado. AcePlay NUNCA financia ni
-- custodia valor: solo emite el beneficio (código). Esta migración no crea
-- ningún flujo de dinero.
--
-- Firewall: nada aquí escribe en los ledgers de rating/xp/fichas de usuarios.
-- Editar economy_config cambia PARÁMETROS de cálculo, no inyecta saldos. Cero
-- tenant_id.
-- ============================================================================

-- Enriquecer brands (se creó mínima en la Épica B).
alter table public.brands add column if not exists hero_url text;
alter table public.brands add column if not exists status text not null default 'active';
alter table public.brands add column if not exists contact jsonb not null default '{}'::jsonb;
-- club_id: si la marca es un club-sponsor, apunta al space del club que la financia.
alter table public.brands add column if not exists club_id uuid references public.space(id) on delete set null;

-- Presencia transversal de marcas por superficie.
create table if not exists public.sponsor_placements (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands(id) on delete cascade,
  scope         text not null check (scope in ('tournament', 'ladder', 'club', 'store', 'discover', 'home')),
  ref_id        uuid,                                  -- acota a una entidad; null = global del scope
  slot          text not null default 'default',
  priority      integer not null default 0,            -- orden manual del admin (tras prioridad pagada)
  paid_priority boolean not null default false,        -- prioridad pagada: gana sobre el resto
  starts_at     timestamptz,
  ends_at       timestamptz,
  weight        integer not null default 1,            -- peso para rotación entre empatados
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index sponsor_placements_scope_idx on public.sponsor_placements (scope, active);
create index sponsor_placements_brand_idx on public.sponsor_placements (brand_id);

-- Roles de aplicación (la app ya los consulta en AuthProvider; faltaba la tabla
-- en el core). Habilita el gating admin existente. Player-first, sin tenant_id.
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  role       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- ¿El caller es admin? (SECURITY DEFINER para usarse en políticas RLS).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('super_admin', 'club_admin')
  );
$$;

-- RLS.
alter table public.sponsor_placements enable row level security;
alter table public.user_roles enable row level security;

create policy user_roles_read on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy sponsor_placements_read on public.sponsor_placements for select to authenticated using (true);

-- Escritura SOLO admin (las políticas se suman OR a las de lectura ya existentes).
create policy brands_admin_write on public.brands for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy reward_items_admin_write on public.reward_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sponsor_placements_admin_write on public.sponsor_placements for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy economy_config_admin_write on public.economy_config for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.user_roles, public.sponsor_placements to authenticated;
grant insert, update, delete on public.brands, public.reward_items, public.sponsor_placements, public.economy_config to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Seed: demouser como super_admin para operar el portal en la demo.
insert into public.user_roles (user_id, role)
  select id, 'super_admin' from auth.users where email = 'demouser@aceplay.cl'
on conflict (user_id, role) do nothing;

notify pgrst, 'reload schema';
