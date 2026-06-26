-- ============================================================================
-- FASE B.1 (#3) · Carga de resultados por el ORGANIZADOR en categorías del motor
-- (brackets: single/doble elim, consolación, grupos, americano, y el round_robin
-- del motor). play_bracket_match exige que el caller SEA jugador del partido
-- ('No participas en este partido'), así que no sirve para el organizador.
-- submit_match_result (la organizadora) está MUERTA. Este RPC nuevo reproduce
-- EXACTAMENTE el camino vivo de play_bracket_match (inserta el match pending +
-- sets, marca el slot 'played_pending') pero con gate de ORGANIZADOR y ganador
-- explícito. NO modifica el motor ni bypassa el firewall: el resultado queda
-- 'pending' y el rating/avance del cuadro ocurren al CONFIRMARSE, igual que hoy.
-- ============================================================================
create or replace function public.org_record_bracket_result(
  _slot_id uuid, _winner_side text, _sets jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  b public.tournament_bracket%rowtype;
  _disc text; _fmt text; _mid uuid; _s jsonb; _idx int := 0;
begin
  select * into b from public.tournament_bracket where id = _slot_id;
  if not found then raise exception 'Partido no encontrado'; end if;
  if not public.space_can_manage(b.category_id) then
    raise exception 'Solo el organizador o admin puede cargar resultados';
  end if;
  if _winner_side not in ('a', 'b') then raise exception 'Ganador inválido'; end if;
  if b.status <> 'playable' or b.player_a is null or b.player_b is null then
    raise exception 'El partido no está listo para cargarse';
  end if;
  if b.match_id is not null then raise exception 'Este partido ya tiene un resultado cargado'; end if;

  select disciplina into _disc from public.tournament_config where space_id = b.category_id;
  _disc := coalesce(_disc, 'padel');
  _fmt := case when _disc = 'padel' then 'doubles' else 'singles' end;

  insert into public.matches (sport, format, source_type, space_id, side_a, side_b, match_winner, played_at,
                              verified_event, prestige_mult, confirmation_status, source_ref, recorded_by)
  values (_disc, _fmt, 'tournament', b.category_id, array[b.player_a], array[b.player_b], _winner_side, now(),
          true, coalesce((select prestige_mult from public.tournament_config where space_id = b.category_id), 1.0),
          'pending', jsonb_build_object('bracket_slot', b.id, 'round', b.round, 'slot', b.slot), auth.uid())
  returning id into _mid;

  for _s in select * from jsonb_array_elements(coalesce(_sets, '[]'::jsonb)) loop
    insert into public.match_sets (match_id, set_index, games_a, games_b, is_tiebreak, is_valid)
    values (_mid, _idx, (_s->>'games_a')::int, (_s->>'games_b')::int, coalesce((_s->>'is_tiebreak')::boolean, false), true);
    _idx := _idx + 1;
  end loop;

  update public.tournament_bracket set match_id = _mid, status = 'played_pending' where id = b.id;
  return _mid;
end $$;
grant execute on function public.org_record_bracket_result(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
