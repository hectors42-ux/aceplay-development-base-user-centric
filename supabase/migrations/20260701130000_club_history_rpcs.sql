-- ============================================================================
-- TANDA 3 · "Mi historia en el club" (SOLO LECTURA, deriva de datos existentes).
-- FIREWALL VISUAL: el historial NUNCA expone el rating Glicko crudo — convierte
-- cada punto con rating_to_nivel(rating_after) ANTES de devolverlo. El jugador ve
-- su curva de Nivel 1.0–7.0, jamás rating_after/rd. Es POR CLUB (filtra por el club
-- ancestro de los partidos) y por DEPORTE. No escribe nada (firewall de 3 cruces).
-- ============================================================================

-- Club ancestro de un space (escalerilla→club; categoría→torneo→club).
create or replace function public.space_club_id(_space_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, parent_space_id, type from public.space where id = _space_id
    union all
    select s.id, s.parent_space_id, s.type
    from public.space s join chain c on s.id = c.parent_space_id
  )
  select id from chain where type = 'club' limit 1;
$$;
grant execute on function public.space_club_id(uuid) to authenticated;

-- Serie temporal del NIVEL del jugador en ese club (rating_history → rating_to_nivel).
-- Devuelve SOLO el nivel (no rating). rating_history es privado del usuario (RLS).
create or replace function public.club_level_history(_club_id uuid, _sport text)
returns table (at timestamptz, nivel numeric)
language sql stable security definer set search_path = public as $$
  select coalesce(m.played_at, rh.created_at) as at,
         public.rating_to_nivel(rh.rating_after) as nivel
  from public.rating_history rh
  join public.matches m on m.id = rh.match_id
  where rh.user_id = auth.uid()
    and rh.sport = _sport
    and public.space_club_id(m.space_id) = _club_id
  order by 1;
$$;
grant execute on function public.club_level_history(uuid, text) to authenticated;

-- Stats agregadas del jugador en ese club (de sus partidos con rating).
create or replace function public.club_player_stats(_club_id uuid, _sport text)
returns table (partidos_jugados int, partidos_ganados int, win_rate int, torneos int, escalerillas int, podios int)
language sql stable security definer set search_path = public as $$
  with mm as (
    select m.space_id, m.side_a, m.side_b, m.match_winner, sp.type as comp_type, sp.parent_space_id as comp_parent
    from public.matches m
    join public.space sp on sp.id = m.space_id
    where m.confirmation_status = 'confirmed' and m.sport = _sport
      and (auth.uid() = any (m.side_a) or auth.uid() = any (m.side_b))
      and public.space_club_id(m.space_id) = _club_id
  ),
  won as (
    select count(*) filter (
      where (auth.uid() = any (side_a) and match_winner = 'a')
         or (auth.uid() = any (side_b) and match_winner = 'b')) as pg,
      count(*) as pj
    from mm
  )
  select
    w.pj::int,
    w.pg::int,
    case when w.pj > 0 then round(100.0 * w.pg / w.pj)::int else 0 end,
    (select count(distinct comp_parent)::int from mm where comp_type = 'category'),
    (select count(distinct space_id)::int from mm where comp_type = 'escalerilla'),
    (select count(*)::int from public.space_standing ss
       join public.space sp2 on sp2.id = ss.space_id
       where ss.player_id = auth.uid() and sp2.status = 'finished' and sp2.sport = _sport
         and coalesce(ss.local_rank, 99) <= 3 and public.space_club_id(sp2.id) = _club_id)
  from won w;
$$;
grant execute on function public.club_player_stats(uuid, text) to authenticated;

notify pgrst, 'reload schema';
