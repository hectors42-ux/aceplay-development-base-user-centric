-- ============================================================================
-- SEED · Round-robin demo "Escalerilla Providencia" (Club Providencia · tenis).
-- 12 invitados (roster_players, source='manual') + 18 partidos con resultados
-- variados (sets normales + algunos super tie-break del 3er set) para poblar el
-- standings ponderado. Idempotente.
--
-- ⚠️ Nombres ficticios reconocibles — DEBEN genericarse antes de cualquier
--    exposición pública / demo / repo público (Ley 21.719).
-- ============================================================================
do $$
declare
  _club uuid; _org uuid; _tour uuid; _cat uuid;
  _p uuid[] := '{}'; _id uuid; _name text; _m uuid;
  _spec jsonb; _set jsonb; _si int;
  _names text[] := array[
    'Matías Fernándes', 'Cristóbal Gonzáles', 'Tomás Muñós', 'Vicente Rojás',
    'Benjamín Contrerás', 'Joaquín Sepúlvedas', 'Agustín Morán', 'Felipe Castíllo',
    'Sebastián Tórres', 'Diego Vergára', 'Martín Espinozas', 'Ignacio Fuentés'
  ];
  -- Partidos: [a_idx, b_idx, winner_idx, [[games_a, games_b, is_tiebreak?], ...]]
  _specs jsonb := '[
    [1,2,1,[[6,3],[6,4]]],
    [1,3,1,[[6,2],[6,1]]],
    [1,4,1,[[6,4],[4,6],[10,8,true]]],
    [1,5,1,[[6,4],[6,4]]],
    [2,3,2,[[7,5],[6,4]]],
    [2,4,2,[[6,3],[6,4]]],
    [2,6,2,[[6,4],[4,6],[10,6,true]]],
    [3,4,3,[[6,4],[6,4]]],
    [3,11,3,[[6,3],[6,2]]],
    [4,12,4,[[6,4],[6,3]]],
    [5,6,5,[[6,2],[6,2]]],
    [5,7,5,[[6,4],[3,6],[10,7,true]]],
    [6,7,6,[[7,6],[6,4]]],
    [7,8,7,[[6,4],[6,4]]],
    [8,9,8,[[6,1],[6,2]]],
    [8,10,8,[[6,3],[6,4]]],
    [9,10,9,[[6,4],[7,5]]],
    [11,12,11,[[6,2],[6,3]]]
  ]'::jsonb;
begin
  select id, organizer_id into _club, _org from public.space where slug = 'club-providencia' and type = 'club';
  if _club is null then return; end if;

  select id into _tour from public.space where slug = 'torneo-escalerilla-prov' and parent_space_id = _club;
  if _tour is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('tournament', _club, 'club_providencia.escalerilla_prov', 'Escalerilla Providencia',
            'torneo-escalerilla-prov', 'hierarchy', 'request', null, _org, 'active')
    returning id into _tour;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_tour, 'round_robin', 'manual', 'tennis', 'best_of_3', 'puntual', 1.0);
  end if;

  select id into _cat from public.space where slug = 'cat-escalerilla-prov' and parent_space_id = _tour;
  if _cat is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('category', _tour, 'club_providencia.escalerilla_prov.grupo', 'Grupo único',
            'cat-escalerilla-prov', 'hierarchy', 'request', 'tennis', _org, 'active')
    returning id into _cat;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_cat, 'round_robin', 'manual', 'tennis', 'best_of_3', 'puntual', 1.0);
  end if;

  -- Ya seedeado → salir (idempotente).
  if exists (select 1 from public.rr_participant where category_id = _cat) then return; end if;

  -- 12 invitados ficticios.
  foreach _name in array _names loop
    insert into public.roster_players (club_id, display_name, source)
    values (_club, _name, 'manual') returning id into _id;
    _p := _p || _id;
    insert into public.rr_participant (category_id, roster_player_id) values (_cat, _id);
  end loop;

  -- 18 partidos con sets (algunos con super TB en el 3er set).
  for _spec in select value from jsonb_array_elements(_specs) loop
    insert into public.rr_match (category_id, player_a, player_b, winner, played_at)
    values (_cat,
            _p[(_spec->>0)::int], _p[(_spec->>1)::int], _p[(_spec->>2)::int], now())
    returning id into _m;
    _si := 0;
    for _set in select value from jsonb_array_elements(_spec->3) loop
      insert into public.rr_match_set (rr_match_id, set_index, games_a, games_b, is_tiebreak)
      values (_m, _si, (_set->>0)::int, (_set->>1)::int, coalesce((_set->>2)::boolean, false));
      _si := _si + 1;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
