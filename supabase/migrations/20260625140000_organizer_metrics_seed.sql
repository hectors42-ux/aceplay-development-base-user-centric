-- Seed Épica D: finaliza torneos reales de 2 organizadores → métricas crudas
-- VARIADAS (calculadas de los datos de partidos existentes), + registro de
-- ingresos, + una "Copa [Marca]" modelada como placement (Épica C) + registro
-- sponsorship. Todo registro, ningún cobro. Idempotente.
do $$
declare _t uuid; _ids uuid[]; _demo01 uuid; _demo08 uuid; _wilson uuid; _cup uuid;
begin
  select id into _demo01 from auth.users where email = 'demo01@demo.local';
  select id into _demo08 from auth.users where email = 'demo08@demo.local';
  select id into _wilson from public.brands where slug = 'wilson';

  -- demo01: 3 torneos finalizados con completitud variada (≈1.0, ≈0.87, ≈0.1).
  select coalesce(array_agg(id), '{}') into _ids from public.space
    where type = 'tournament' and slug in ('torneo-de-demo', 'torneo-grp-demo', 'torneo-cons-demo');
  foreach _t in array _ids loop
    update public.space set status = 'finished' where id = _t;
    perform public._capture_organizer_metrics(_t);
  end loop;

  -- demo08: 1 torneo finalizado (Abierto Norte).
  select id into _t from public.space where slug = 'abierto-norte' and type = 'tournament';
  if _t is not null then
    update public.space set status = 'finished' where id = _t;
    perform public._capture_organizer_metrics(_t);
  end if;

  -- Registro de ingresos (sin monto = solo registro; NO cobro).
  if not exists (select 1 from public.organizer_revenue_log) then
    insert into public.organizer_revenue_log (organizer_id, type, amount_clp, ref) values
      (_demo01, 'saas', null, 'Plan organizador · mensual'),
      (_demo01, 'convenience_fee', null, 'Inscripción gestionada (registro)'),
      (_demo08, 'pro_engine', null, 'Motor pro de torneo'),
      (_demo08, 'saas', null, 'Plan organizador · mensual');
  end if;

  -- "Copa Wilson" sobre el torneo de Doble Eliminación: placement + registro sponsorship.
  select id into _cup from public.space where slug = 'torneo-de-demo' and type = 'tournament';
  if _cup is not null and _wilson is not null then
    if not exists (select 1 from public.sponsor_placements where scope = 'tournament' and ref_id = _cup) then
      insert into public.sponsor_placements (brand_id, scope, ref_id, slot, priority, paid_priority, weight, active)
      values (_wilson, 'tournament', _cup, 'cup', 0, true, 6, true);
    end if;
    insert into public.organizer_revenue_log (organizer_id, type, amount_clp, ref)
      select _demo01, 'sponsorship', null, 'Copa Wilson · Torneo Doble Eliminación'
      where not exists (select 1 from public.organizer_revenue_log where type = 'sponsorship' and ref = 'Copa Wilson · Torneo Doble Eliminación');
  end if;
end $$;

notify pgrst, 'reload schema';
