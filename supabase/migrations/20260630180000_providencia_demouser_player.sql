-- ============================================================================
-- SEED B.1 · El DEMO USER juega la "Escalerilla Providencia" (TORNEO tipo
-- round-robin · tournament_config.motor='round_robin'; "Escalerilla" es solo el
-- NOMBRE de display, NO la escalerilla simple de retos 1-a-1 de la app).
-- demouser ya es organizador (seed previo); aquí lo inscribimos como PARTICIPANTE
-- (mezclado entre los ~12 roster ficticios) y le sembramos ~5 partidos jugados
-- para que su fila en la tabla ponderada tenga puntaje real y su H2H tenga celdas.
--
-- FIREWALL: el módulo round-robin de roster (rr_match) está DESACOPLADO del motor
-- de rating — el resultado afecta SOLO el standings del torneo, no player_ratings
-- (ni del demo user ni de los roster_players sin cuenta). Cero cruce a rating/xp/fichas.
--
-- ⚠️ Nombres ficticios reconocibles — DEBEN genericarse antes de cualquier
--    exposición pública / demo / repo público (Ley 21.719).
-- ============================================================================
do $$
declare
  _me uuid; _club uuid; _cat uuid; _myrp uuid;
  _opp uuid[]; _m uuid; _i int; _spec jsonb; _set jsonb; _si int;
  -- [opp_index(1-based), me_gana(bool), [[mis_games, rival_games, super_tb?], ...]]
  _specs jsonb := '[
    [1, true,  [[6,3],[6,4]]],
    [2, true,  [[6,2],[4,6],[10,8,true]]],
    [3, true,  [[7,5],[6,4]]],
    [4, false, [[4,6],[3,6]]],
    [5, true,  [[6,4],[6,2]]]
  ]'::jsonb;
begin
  select id into _me from auth.users where email = 'demouser@aceplay.cl';
  select id into _club from public.space where slug = 'club-providencia';
  select id into _cat from public.space where slug = 'cat-escalerilla-prov';
  if _me is null or _club is null or _cat is null then return; end if;

  -- idempotente: si el demo user ya tiene roster_player en el club, salir.
  if exists (select 1 from public.roster_players where club_id = _club and claimed_by = _me) then return; end if;

  -- roster_player del demo user (cuenta real → source 'self', claimed_by = me).
  insert into public.roster_players (club_id, display_name, source, claimed_by)
  values (_club, 'Demo User', 'self', _me) returning id into _myrp;
  insert into public.rr_participant (category_id, roster_player_id)
  values (_cat, _myrp) on conflict (category_id, roster_player_id) do nothing;

  -- 5 rivales del round-robin (distintos al demo user).
  select array_agg(id) into _opp from (
    select pa.roster_player_id as id
    from public.rr_participant pa
    where pa.category_id = _cat and pa.roster_player_id <> _myrp
    order by pa.roster_player_id
    limit 5
  ) t;
  if coalesce(array_length(_opp, 1), 0) < 5 then return; end if;

  -- partidos jugados del demo user (mis_games = side A).
  for _spec in select value from jsonb_array_elements(_specs) loop
    _i := (_spec->>0)::int;
    insert into public.rr_match (category_id, player_a, player_b, winner, played_at)
    values (_cat, _myrp, _opp[_i], case when (_spec->>1)::boolean then _myrp else _opp[_i] end, now())
    returning id into _m;
    _si := 0;
    for _set in select value from jsonb_array_elements(_spec->2) loop
      insert into public.rr_match_set (rr_match_id, set_index, games_a, games_b, is_tiebreak)
      values (_m, _si, (_set->>0)::int, (_set->>1)::int, coalesce((_set->>2)::boolean, false));
      _si := _si + 1;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
