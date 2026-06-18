create table public.tournament_alerts (
  user_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

alter table public.tournament_alerts enable row level security;

create policy "user manages own tournament alerts"
on public.tournament_alerts
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and tenant_id = public.user_tenant_id(auth.uid()));

create policy "club_admin reads tournament alerts"
on public.tournament_alerts
for select
to authenticated
using (public.is_club_admin_of(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));