-- ============================================================================
-- FASE B.1 (#6) · Cierre de CATEGORÍA sobre el motor VIVO (space).
-- finalize_tournament es a nivel TORNEO; el motor no tenía cierre a nivel
-- categoría. close_category marca la categoría (space) como 'finished' — congela
-- el standings (round_robin_standings es determinista sobre rr_match, que ya no
-- cambia: rr_record_result rechaza cargas en categorías cerradas). El podio se
-- lee de round_robin_standings (top 3 por la jerarquía de desempate). NO toca
-- tablas muertas (tournament_categories/tournament_matches).
-- FIREWALL: cerrar NO mueve rating (ya se movió por los resultados confirmados);
-- no escribe en player_ratings/xp/fichas.
-- ============================================================================
create or replace function public.close_category(_category_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.space_can_manage(_category_id) then
    raise exception 'Solo el organizador o admin puede cerrar la categoría';
  end if;
  update public.space set status = 'finished'
   where id = _category_id and type = 'category';
end $$;
grant execute on function public.close_category(uuid) to authenticated;

-- Recrea rr_record_result añadiendo el guard de categoría CERRADA (freeze del
-- standings tras el cierre). Resto idéntico.
create or replace function public.rr_record_result(
  _category_id uuid, _player_a uuid, _player_b uuid, _winner uuid, _sets jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare _m uuid; _s jsonb; _idx int := 0;
begin
  if not public._rr_can_manage(_category_id) then
    raise exception 'Solo el organizador puede cargar resultados';
  end if;
  if (select status from public.space where id = _category_id) = 'finished' then
    raise exception 'La categoría está cerrada; no se pueden cargar más resultados';
  end if;
  if _player_a = _player_b then raise exception 'Un jugador no puede jugar contra sí mismo'; end if;
  if _winner is not null and _winner <> _player_a and _winner <> _player_b then
    raise exception 'El ganador debe ser uno de los dos jugadores';
  end if;
  if not exists (select 1 from public.rr_participant where category_id = _category_id and roster_player_id = _player_a)
     or not exists (select 1 from public.rr_participant where category_id = _category_id and roster_player_id = _player_b) then
    raise exception 'Ambos jugadores deben estar inscritos en la categoría';
  end if;
  insert into public.rr_match (category_id, player_a, player_b, winner, played_at)
  values (_category_id, _player_a, _player_b, _winner, now()) returning id into _m;
  for _s in select value from jsonb_array_elements(coalesce(_sets, '[]'::jsonb)) loop
    insert into public.rr_match_set (rr_match_id, set_index, games_a, games_b, is_tiebreak)
    values (_m, _idx, (_s->>'games_a')::int, (_s->>'games_b')::int, coalesce((_s->>'is_tiebreak')::boolean, false));
    _idx := _idx + 1;
  end loop;
  return _m;
end $$;
grant execute on function public.rr_record_result(uuid, uuid, uuid, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
