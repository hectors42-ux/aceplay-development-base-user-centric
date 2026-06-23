-- Lógica de la capa de medición del organizador. FIREWALL: nada de esto escribe
-- en player_ratings/rating_history/xp_ledger/fichas_ledger/points_ledger. Lee
-- matches/tournament_bracket/space_membership para COMPUTAR métricas crudas, y
-- escribe solo organizer_metrics/organizer_revenue_log. No deriva mérito ni
-- ventaja de jugador.

-- Captura las 3 métricas CRUDAS de un torneo (interno; sin auth, sin score).
create or replace function public._capture_organizer_metrics(_tournament_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _org uuid; _cats uuid[];
  _expected int; _resolved int; _enrolled int; _played_players int; _conf int; _conf_sets int;
  _completion numeric; _retention numeric; _dq numeric;
begin
  select organizer_id into _org from public.space where id = _tournament_id and type = 'tournament';
  if _org is null then return; end if;
  select coalesce(array_agg(id), '{}') into _cats
    from public.space where parent_space_id = _tournament_id and type = 'category';

  -- completion_rate = fixtures resueltos / fixtures totales (excluye byes).
  select count(*) filter (where coalesce(status, '') <> 'bye'),
         count(*) filter (where winner is not null)
    into _expected, _resolved
    from public.tournament_bracket where category_id = any(_cats);

  -- retention = jugadores que jugaron ≥1 partido confirmado / inscritos.
  select count(distinct player_id) into _enrolled
    from public.space_membership where space_id = any(_cats) and status = 'active' and role = 'player';
  select count(distinct p) into _played_players from (
    select unnest(coalesce(m.side_a, '{}'::uuid[]) || coalesce(m.side_b, '{}'::uuid[])) as p
    from public.matches m
    where m.space_id = any(_cats) and m.source_type = 'tournament' and m.confirmation_status = 'confirmed'
  ) t;

  -- data_quality = partidos confirmados con score (sets) / partidos confirmados.
  select count(*), count(*) filter (where exists (select 1 from public.match_sets ms where ms.match_id = m.id))
    into _conf, _conf_sets
    from public.matches m
    where m.space_id = any(_cats) and m.source_type = 'tournament' and m.confirmation_status = 'confirmed';

  _completion := case when _expected > 0 then round(_resolved::numeric / _expected, 3) else 0 end;
  _retention  := case when _enrolled > 0 then round(_played_players::numeric / _enrolled, 3) else 0 end;
  _dq         := case when _conf > 0 then round(_conf_sets::numeric / _conf, 3) else 0 end;

  insert into public.organizer_metrics (organizer_id, tournament_id, completion_rate, retention, data_quality)
  values (_org, _tournament_id, _completion, _retention, _dq)
  on conflict (tournament_id) do update
    set completion_rate = excluded.completion_rate, retention = excluded.retention,
        data_quality = excluded.data_quality, captured_at = now();
end $$;

-- Finalizar un torneo: marca 'finished' y captura las métricas. Solo organizador o admin.
create or replace function public.finalize_tournament(_tournament_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _org uuid;
begin
  select organizer_id into _org from public.space where id = _tournament_id and type = 'tournament';
  if _org is null then raise exception 'Torneo no encontrado'; end if;
  if auth.uid() <> _org and not public.is_admin() then raise exception 'Solo el organizador o un admin puede finalizar'; end if;
  update public.space set status = 'finished' where id = _tournament_id;
  perform public._capture_organizer_metrics(_tournament_id);
end $$;

-- Registrar un ingreso del organizador (REGISTRO, no cobro). Admin o el propio organizador.
create or replace function public.log_organizer_revenue(_organizer_id uuid, _type text, _amount_clp numeric default null, _ref text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  if auth.uid() <> _organizer_id and not public.is_admin() then raise exception 'No autorizado'; end if;
  if _type not in ('saas', 'convenience_fee', 'pro_engine', 'sponsorship') then raise exception 'Tipo inválido'; end if;
  insert into public.organizer_revenue_log (organizer_id, type, amount_clp, ref)
  values (_organizer_id, _type, _amount_clp, _ref) returning id into _id;
  return _id;
end $$;

-- Panel SOLO LECTURA: métricas crudas por torneo (las propias, o todas si admin).
create or replace function public.organizer_panel()
returns table (tournament_id uuid, tournament_name text, organizer_name text, status text,
               completion_rate numeric, retention numeric, data_quality numeric, captured_at timestamptz)
language sql stable security definer set search_path = public as $$
  select om.tournament_id, t.name, pf.display_name, t.status,
         om.completion_rate, om.retention, om.data_quality, om.captured_at
  from public.organizer_metrics om
  join public.space t on t.id = om.tournament_id
  join public.profiles pf on pf.id = om.organizer_id
  where public.is_admin() or om.organizer_id = auth.uid()
  order by om.captured_at desc;
$$;

-- Registro de ingresos (propio o admin).
create or replace function public.organizer_revenue_panel()
returns table (id uuid, organizer_name text, type text, amount_clp numeric, ref text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, pf.display_name, r.type, r.amount_clp, r.ref, r.created_at
  from public.organizer_revenue_log r
  join public.profiles pf on pf.id = r.organizer_id
  where public.is_admin() or r.organizer_id = auth.uid()
  order by r.created_at desc;
$$;

-- Torneos del caller aún no finalizados (para ofrecer la acción de finalizar).
create or replace function public.organizer_finalizable()
returns table (tournament_id uuid, name text)
language sql stable security definer set search_path = public as $$
  select t.id, t.name from public.space t
  where t.type = 'tournament' and coalesce(t.status, '') <> 'finished'
    and (public.is_admin() or t.organizer_id = auth.uid())
    and exists (select 1 from public.space c join public.tournament_bracket b on b.category_id = c.id
                where c.parent_space_id = t.id)
  order by t.name;
$$;

grant execute on function public.finalize_tournament(uuid) to authenticated;
grant execute on function public.log_organizer_revenue(uuid, text, numeric, text) to authenticated;
grant execute on function public.organizer_panel() to authenticated;
grant execute on function public.organizer_revenue_panel() to authenticated;
grant execute on function public.organizer_finalizable() to authenticated;
-- _capture_organizer_metrics es interno: NO se concede a authenticated.

notify pgrst, 'reload schema';
