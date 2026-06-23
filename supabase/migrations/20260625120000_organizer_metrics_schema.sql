-- ============================================================================
-- ÉPICA D: economía del organizador en su forma de FASE 1, NO-CUSTODIAL, +
-- captura de métricas. El motor de torneos ya existe; aquí SOLO se añade la
-- capa económica/medición.
--
-- ACOTACIÓN ESTRICTA (no adelantar):
--  * organizer_metrics es SOLO CAPTURA DE DATO CRUDO. NO se deriva índice de
--    mérito, NI "mejor organizador", NI élite curada, NI exclusividad, NI
--    ponderaciones. Eso se define después.
--  * MVP NO-CUSTODIAL: AcePlay no retiene el pozo ni cobra inscripciones. El
--    take-rate sobre el pozo es Fase 2 y queda FUERA de alcance. revenue_log es
--    un REGISTRO, no un cobro.
--
-- Firewall: estas tablas/funciones no tocan rating/xp/fichas de jugadores, y no
-- existe ninguna conversión de métricas de organizador en ventaja competitiva
-- de jugadores. Cero tenant_id.
-- ============================================================================

-- Métricas CRUDAS por torneo (sin score derivado). Ratios 0..1.
create table if not exists public.organizer_metrics (
  id              uuid primary key default gen_random_uuid(),
  organizer_id    uuid not null,
  tournament_id   uuid not null references public.space(id) on delete cascade,
  completion_rate numeric,   -- fixtures resueltos / fixtures totales
  retention       numeric,   -- jugadores que jugaron ≥1 partido / inscritos
  data_quality    numeric,   -- partidos con score cargado / partidos confirmados
  captured_at     timestamptz not null default now(),
  unique (tournament_id)     -- un snapshot por torneo (re-finalizar actualiza)
);
create index organizer_metrics_org_idx on public.organizer_metrics (organizer_id);

-- Registro de ingresos del organizador (NO es un cobro). amount_clp opcional.
create table if not exists public.organizer_revenue_log (
  id           uuid primary key default gen_random_uuid(),
  organizer_id uuid not null,
  type         text not null check (type in ('saas', 'convenience_fee', 'pro_engine', 'sponsorship')),
  amount_clp   numeric,        -- null = solo registro, sin monto
  ref          text,
  created_at   timestamptz not null default now()
);
create index organizer_revenue_org_idx on public.organizer_revenue_log (organizer_id, created_at desc);

-- RLS: el organizador ve lo suyo; el admin ve todo. Escritura por RPC definer.
alter table public.organizer_metrics enable row level security;
alter table public.organizer_revenue_log enable row level security;

create policy organizer_metrics_read on public.organizer_metrics for select to authenticated
  using (organizer_id = auth.uid() or public.is_admin());
create policy organizer_revenue_read on public.organizer_revenue_log for select to authenticated
  using (organizer_id = auth.uid() or public.is_admin());

grant select on public.organizer_metrics, public.organizer_revenue_log to authenticated;

notify pgrst, 'reload schema';
