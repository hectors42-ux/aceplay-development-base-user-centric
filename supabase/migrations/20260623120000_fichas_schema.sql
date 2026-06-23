-- ============================================================================
-- CAPA DE PREMIO: Fichas → CÓDIGOS DE DESCUENTO de marca. AcePlay NO financia,
-- NO custodia valor, NO cobra. Un premio se muestra SOLO como "beneficio en
-- [Marca]" + su costo en FICHAS. NUNCA precios en pesos.
--
-- FIREWALL DE 3 CRUCES:
--   (a) Las Fichas NUNCA escriben en el ledger de Rating (Glicko).
--   (b) Las Fichas no compran XP ni viceversa (no hay conversión Fichas<->XP).
--   (c) Hito→Fichas es una recompensa EXPLÍCITA y UNIDIRECCIONAL (monto fijo de
--       config, jamás derivado del XP).
-- Player-first, cero tenant_id. Fichas son una moneda GLOBAL (no por deporte).
-- Parámetros en economy_config.
-- ============================================================================

-- Marcas (mínima; se enriquece en la Épica C).
create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  logo_url   text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Ledger de Fichas (append-only). Saldo = suma de deltas NO expirados.
create table if not exists public.fichas_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null,
  delta      integer not null,
  reason     text not null,
  ref_type   text,
  ref_id     text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index fichas_ledger_user_idx on public.fichas_ledger (user_id, expires_at);
-- Idempotencia de OTORGAMIENTOS (delta>0) por ref: un hito otorga una sola vez.
create unique index fichas_grant_idem_idx on public.fichas_ledger (user_id, reason, ref_type, ref_id)
  where delta > 0 and ref_id is not null;

-- Catálogo de premios. benefit_label es TEXTO ("20% en Wilson"), NO un precio.
create table if not exists public.reward_items (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands(id) on delete cascade,
  title         text not null,
  benefit_label text not null,
  cost_fichas   integer not null check (cost_fichas > 0),
  stock         integer,                 -- null = ilimitado
  terms         text,
  sport_scope   text,                    -- null = cualquier deporte
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index reward_items_brand_idx on public.reward_items (brand_id, active);

-- Canjes: cada uno emite un CÓDIGO único que el usuario usa en el canal de la marca.
create table if not exists public.redemptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  reward_item_id uuid not null references public.reward_items(id),
  code           text unique not null,
  status         text not null default 'issued',  -- issued | used | expired
  created_at     timestamptz not null default now(),
  used_at        timestamptz
);
create index redemptions_user_idx on public.redemptions (user_id, created_at desc);

-- RLS: lectura acotada; TODA escritura va por RPCs SECURITY DEFINER.
alter table public.brands       enable row level security;
alter table public.fichas_ledger enable row level security;
alter table public.reward_items enable row level security;
alter table public.redemptions  enable row level security;

create policy brands_read on public.brands for select to authenticated using (true);
create policy reward_items_read on public.reward_items for select to authenticated using (true);
create policy fichas_ledger_read on public.fichas_ledger for select to authenticated using (user_id = auth.uid());
create policy redemptions_read on public.redemptions for select to authenticated using (user_id = auth.uid());

grant select on public.brands, public.reward_items, public.fichas_ledger, public.redemptions to authenticated;

-- Parámetros de Fichas (editables por admin). Hito→Fichas con montos fijos.
insert into public.economy_config (key, value) values
  ('fichas', jsonb_build_object('expiry_days', 90, 'grant_mission', 5, 'grant_promotion', 25, 'expiring_soon_days', 14))
on conflict (key) do nothing;

notify pgrst, 'reload schema';
