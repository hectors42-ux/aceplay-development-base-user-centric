-- Vitrina de torneos del jugador — ADAPTADOR DE LECTURA (no toca el motor).
-- category_bundle(category) compone tournament_bracket + profiles + tournament_config
-- + match_sets en el MODELO que esperan las pantallas (registrations con jugadores,
-- matches con registration_a/b_id + bracket + score, players). El motor modela a los
-- participantes como jugadores (player_a/b) o equipos (team_a/b[]); aquí se proyectan
-- como "registration" (player2 = compañero o null). Respeta visibilidad (can_access_space).
-- SOLO LECTURA: no escribe en rating/xp/fichas ni toca la lógica del motor.
create or replace function public.category_bundle(_category_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  with cat as (
    select c.id, c.name, c.sport, c.parent_space_id, c.status,
           cfg.motor, cfg.agendamiento, cfg.disciplina
    from public.space c
    left join public.tournament_config cfg on cfg.space_id = c.id
    where c.id = _category_id and c.type = 'category' and public.can_access_space(c.id)
  ),
  tour as (
    select t.id, t.name, t.slug, t.status
    from public.space t where t.id = (select parent_space_id from cat) and t.type = 'tournament'
  ),
  br as (
    select b.* from public.tournament_bracket b where b.category_id = _category_id
  ),
  -- Participantes (lado A y B de cada slot) → "registrations" (id = representante).
  parts as (
    select coalesce(b.team_a[1], b.player_a) as rid, b.team_a as team, b.player_a as solo from br b
      where b.player_a is not null or b.team_a is not null
    union
    select coalesce(b.team_b[1], b.player_b), b.team_b, b.player_b from br b
      where b.player_b is not null or b.team_b is not null
  ),
  regs as (
    select distinct on (rid)
      rid as id,
      coalesce(team[1], solo) as player1_user_id,
      team[2] as player2_user_id
    from parts where rid is not null
  ),
  -- Todos los user ids involucrados (para el mapa de players).
  uids as (
    select id as uid from regs
    union select player2_user_id from regs where player2_user_id is not null
    union select winner from br where winner is not null
  )
  select jsonb_build_object(
    'tournament', (select to_jsonb(t) from tour t),
    'category', (select jsonb_build_object(
        'id', c.id, 'name', c.name, 'sport', c.sport, 'status', c.status,
        'motor', c.motor, 'scheduling', c.agendamiento, 'discipline', c.disciplina)
      from cat c),
    'registrations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'player1_user_id', r.player1_user_id, 'player2_user_id', r.player2_user_id,
        'status', 'confirmada', 'seed', null))
      from regs r), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'registration_a_id', coalesce(b.team_a[1], b.player_a),
        'registration_b_id', coalesce(b.team_b[1], b.player_b),
        'winner_registration_id', b.winner,
        'status', case
                    when b.status in ('played','confirmed','played_pending') then 'jugado'
                    when b.status = 'bye' then 'bye'
                    else 'pendiente' end,
        'round', b.round, 'slot', b.slot, 'bracket', b.bracket, 'phase', b.bracket,
        'match_id', b.match_id, 'scheduled_at', null,
        'score', (select jsonb_agg(jsonb_build_object('a', ms.games_a, 'b', ms.games_b) order by ms.set_index)
                    from public.match_sets ms where ms.match_id = b.match_id)
      ) order by b.round, b.slot)
      from br b), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', pf.id, 'first_name', split_part(coalesce(pf.display_name,''),' ',1),
        'last_name', nullif(trim(substr(coalesce(pf.display_name,''), strpos(coalesce(pf.display_name,'')||' ',' ')+1)),''),
        'avatar_url', pf.avatar_url))
      from public.profiles pf where pf.id in (select uid from uids)), '[]'::jsonb)
  );
$$;

grant execute on function public.category_bundle(uuid) to authenticated;

notify pgrst, 'reload schema';
