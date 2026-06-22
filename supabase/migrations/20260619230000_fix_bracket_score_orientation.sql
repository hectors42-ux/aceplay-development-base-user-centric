-- Fix: in play_bracket_match the recorder may be player_b, but the score is entered from the
-- recorder's perspective ("Gané yo 6-3" = my games first). Orient the sets to side_a/side_b so
-- games_a always belongs to side_a (= player_a). Without this, set_diff is inverted when the
-- recorder is player_b. (record_match / create_ladder_challenge always have the recorder as
-- side_a, so they are already correct.)

create or replace function public.play_bracket_match(_slot_id uuid, _winner_is_me boolean, _sets jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  b public.tournament_bracket%rowtype;
  _uid uuid := auth.uid();
  _disc text; _fmt text; _mid uuid; _winner_side text; _rec_is_a boolean;
  _s jsonb; _idx int := 0; _ga int; _gb int;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  select * into b from public.tournament_bracket where id = _slot_id;
  if not found then raise exception 'Partido no encontrado'; end if;
  if b.status <> 'playable' or b.player_a is null or b.player_b is null then raise exception 'El partido no está listo para jugarse'; end if;
  if b.match_id is not null then raise exception 'Este partido ya tiene un resultado cargado'; end if;
  if _uid <> b.player_a and _uid <> b.player_b then raise exception 'No participas en este partido'; end if;

  select disciplina into _disc from public.tournament_config where space_id = b.category_id;
  _disc := coalesce(_disc, 'padel');
  _fmt := case when _disc = 'padel' then 'doubles' else 'singles' end;
  _rec_is_a := (_uid = b.player_a);
  _winner_side := case when _rec_is_a = _winner_is_me then 'a' else 'b' end;

  insert into public.matches (sport, format, source_type, space_id, side_a, side_b, match_winner, played_at,
                              verified_event, prestige_mult, confirmation_status, source_ref, recorded_by)
  values (_disc, _fmt, 'tournament', b.category_id, array[b.player_a], array[b.player_b], _winner_side, now(),
          true, coalesce((select prestige_mult from public.tournament_config where space_id = b.category_id), 1.0),
          'pending', jsonb_build_object('bracket_slot', b.id, 'round', b.round, 'slot', b.slot), _uid)
  returning id into _mid;

  for _s in select * from jsonb_array_elements(coalesce(_sets, '[]'::jsonb)) loop
    -- _sets come from the recorder's perspective (first value = recorder's games).
    if _rec_is_a then
      _ga := (_s->>'games_a')::int; _gb := (_s->>'games_b')::int;
    else
      _ga := (_s->>'games_b')::int; _gb := (_s->>'games_a')::int;
    end if;
    insert into public.match_sets (match_id, set_index, games_a, games_b, is_tiebreak, is_valid)
    values (_mid, _idx, _ga, _gb, coalesce((_s->>'is_tiebreak')::boolean, false), true);
    _idx := _idx + 1;
  end loop;

  update public.tournament_bracket set match_id = _mid, status = 'played_pending' where id = b.id;
  return _mid;
end $$;

notify pgrst, 'reload schema';
