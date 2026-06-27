-- SEED TANDA 3 · partidos de ESCALERILLA jugados por el demo user en Providencia,
-- para que su "historia en el club" (curva de Nivel + stats) tenga datos. Inserta
-- ~5 partidos CONFIRMADOS: el trigger trg_match_confirmed corre el motor (genera
-- rating_history real + mueve el rating del demo user, que SÍ tiene cuenta). Los
-- roster_players (sin cuenta) no se tocan. Demo-only; idempotente.
do $$
declare
  _me uuid; _esc uuid; _opps uuid[]; _spec jsonb; _specs jsonb; _idx int := 0; _m uuid;
begin
  select id into _me from auth.users where email = 'demouser@aceplay.cl';
  select id into _esc from public.space where slug = 'escalerilla-providencia' and type = 'escalerilla';
  if _me is null or _esc is null then return; end if;
  -- idempotente
  if exists (select 1 from public.matches where space_id = _esc and confirmation_status = 'confirmed' and _me = any (side_a || side_b)) then return; end if;

  select array_agg(player_id) into _opps
  from (select player_id from public.space_standing where space_id = _esc and player_id <> _me limit 3) t;
  if coalesce(array_length(_opps, 1), 0) < 1 then return; end if;

  -- [opp_index(0-based), gana_demo(bool), games_perdedor]
  _specs := '[ [0,true,3],[1,true,4],[0,false,4],[2,true,2],[1,true,5] ]'::jsonb;
  for _spec in select value from jsonb_array_elements(_specs) loop
    insert into public.matches (sport, format, source_type, space_id, side_a, side_b, match_winner, played_at,
                                verified_event, prestige_mult, confirmation_status, recorded_by)
    values ('tennis', 'singles', 'escalerilla', _esc,
            array[_me], array[_opps[((_spec->>0)::int % array_length(_opps, 1)) + 1]],
            case when (_spec->>1)::boolean then 'a' else 'b' end,
            now() - ((5 - _idx) * interval '9 days'), false, 1.0, 'confirmed', _me)
    returning id into _m;
    -- un set (ganador 6 - games_perdedor), is_valid para el motor.
    insert into public.match_sets (match_id, set_index, games_a, games_b, is_tiebreak, is_valid)
    values (_m, 0,
            case when (_spec->>1)::boolean then 6 else (_spec->>2)::int end,
            case when (_spec->>1)::boolean then (_spec->>2)::int else 6 end,
            false, true);
    _idx := _idx + 1;
  end loop;
end $$;

notify pgrst, 'reload schema';
