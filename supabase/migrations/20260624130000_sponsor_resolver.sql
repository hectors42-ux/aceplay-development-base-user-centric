-- Resolver de presencia: devuelve los placements candidatos de un scope (y ref
-- opcional), activos y dentro de ventana, ordenados por prioridad pagada >
-- prioridad manual > weight. La rotación round-robin estable entre EMPATADOS la
-- hace el cliente (función pura resolveSponsor, testeable). Solo lectura; no
-- toca ledgers de usuarios.
create or replace function public.sponsor_candidates(_scope text, _ref_id uuid default null)
returns table (
  placement_id uuid, brand_id uuid, brand_name text, logo_url text, hero_url text,
  slot text, priority integer, paid_priority boolean, weight integer
)
language sql stable security definer set search_path = public as $$
  select sp.id, b.id, b.name, b.logo_url, b.hero_url, sp.slot, sp.priority, sp.paid_priority, sp.weight
  from public.sponsor_placements sp
  join public.brands b on b.id = sp.brand_id
  where sp.active and b.status = 'active' and sp.scope = _scope
    and (sp.ref_id is null or sp.ref_id = _ref_id)
    and (sp.starts_at is null or sp.starts_at <= now())
    and (sp.ends_at is null or sp.ends_at >= now())
  order by sp.paid_priority desc, sp.priority desc, sp.weight desc, sp.id;
$$;

grant execute on function public.sponsor_candidates(text, uuid) to authenticated;

notify pgrst, 'reload schema';
