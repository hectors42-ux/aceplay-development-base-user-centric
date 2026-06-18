-- Extensiones para cron + http
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- =====================================================================
-- process_ladder_inactivity_run
-- Baja N posiciones a jugadores activos que no han jugado en X días.
-- Por simplicidad: marca status='inactivo' y los manda al final de la pirámide
-- (reordenando posiciones por debajo). Registra entrada en ladder_history.
-- =====================================================================
create or replace function public.process_ladder_inactivity_run()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _ladder record;
  _pos record;
  _affected int := 0;
  _ladders_processed int := 0;
  _last_pos int;
begin
  for _ladder in
    select * from public.ladders where is_active = true
  loop
    _ladders_processed := _ladders_processed + 1;

    -- Para cada jugador activo cuyo last_played_at sea muy antiguo (o null y joined_at antiguo)
    for _pos in
      select lp.*
      from public.ladder_positions lp
      where lp.ladder_id = _ladder.id
        and lp.status = 'activo'
        and coalesce(lp.last_played_at, lp.joined_at)
            < (now() - make_interval(days => _ladder.inactivity_days))
      order by lp.position asc
    loop
      -- Calcular última posición actual del ladder
      select coalesce(max(position), 0) into _last_pos
      from public.ladder_positions
      where ladder_id = _ladder.id;

      -- Si ya está al final, sólo marcar inactivo
      if _pos.position = _last_pos then
        update public.ladder_positions
        set status = 'inactivo', updated_at = now()
        where id = _pos.id;
      else
        -- Subir un escalón a todos los que están debajo
        update public.ladder_positions
        set position = position - 1, updated_at = now()
        where ladder_id = _ladder.id
          and position > _pos.position;

        -- Mover al jugador inactivo al final
        update public.ladder_positions
        set position = _last_pos,
            status = 'inactivo',
            updated_at = now()
        where id = _pos.id;
      end if;

      insert into public.ladder_history (
        ladder_id, tenant_id, user_id,
        position_before, position_after,
        reason, notes
      ) values (
        _ladder.id, _ladder.tenant_id, _pos.user_id,
        _pos.position, _last_pos,
        'inactividad',
        format('Sin actividad por %s días', _ladder.inactivity_days)
      );

      _affected := _affected + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'ladders_processed', _ladders_processed,
    'players_affected', _affected,
    'ran_at', now()
  );
end;
$$;

revoke all on function public.process_ladder_inactivity_run() from public;
grant execute on function public.process_ladder_inactivity_run() to service_role;

-- =====================================================================
-- process_ladder_expirations_run
-- Desafíos en estado 'propuesto' cuyo expires_at < now() → walkover
-- automático a favor del retador. Reusa _apply_ladder_result.
-- =====================================================================
create or replace function public.process_ladder_expirations_run()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _ch record;
  _expired int := 0;
begin
  for _ch in
    select * from public.ladder_challenges
    where status = 'propuesto'
      and expires_at < now()
  loop
    -- Marcar walkover, ganador = retador
    update public.ladder_challenges
    set status = 'jugado',
        walkover = true,
        winner_user_id = _ch.challenger_user_id,
        loser_user_id = _ch.challenged_user_id,
        played_at = now(),
        responded_at = coalesce(responded_at, now()),
        result_proposed_at = coalesce(result_proposed_at, now()),
        result_confirmed_at = now(),
        score = coalesce(score, '{"walkover": true, "reason": "no_response"}'::jsonb),
        updated_at = now()
    where id = _ch.id;

    -- Aplicar swap de posiciones + historial
    perform public._apply_ladder_result(_ch.id);

    _expired := _expired + 1;
  end loop;

  return jsonb_build_object(
    'expired_walkovers', _expired,
    'ran_at', now()
  );
end;
$$;

revoke all on function public.process_ladder_expirations_run() from public;
grant execute on function public.process_ladder_expirations_run() to service_role;