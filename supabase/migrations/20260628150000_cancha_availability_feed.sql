-- ÉPICA M · Cancha — M4: feed de llamados enriquecido (SOLO LECTURA).
-- Devuelve los llamados ABIERTOS con el nivel/categoría de quien publica (para la
-- card del feed y el % de Zona), el nombre del espacio y un flag is_mine.
-- [Addendum D] Un menor NO aparece en el feed público (is_minor manda); solo se ve
-- a sí mismo. Firewall: lectura pura; no escribe en rating/xp/fichas ni premia.
create or replace function public.availability_feed(_sport text default 'tennis')
returns table (
  id uuid, user_id uuid, name text, avatar_url text, avatar_kind text, avatar_look text,
  poster_nivel numeric, poster_category text,
  slots jsonb, space_id uuid, space_name text, scope text, note text,
  status text, taken_by uuid, created_at timestamptz, is_mine boolean
)
language sql stable security definer set search_path = public as $$
  with sk as (
    select case when _sport = 'padel' then 'padel' else 'tennis' end as sport_key,
           case when _sport = 'padel' then 'doubles' else 'singles' end as fmt
  )
  select
    ac.id, ac.user_id, pf.display_name, pf.avatar_url, pf.avatar_kind, pf.avatar_look,
    pr.nivel,
    (select cc.label from public.category_config cc
       where cc.sport = (select sport_key from sk)
         and cc.category_key = public.get_player_category(pr.nivel, (select sport_key from sk)) limit 1),
    ac.slots, ac.space_id, s.name, ac.scope, ac.note,
    ac.status, ac.taken_by, ac.created_at,
    (ac.user_id = auth.uid())
  from public.availability_calls ac
  join public.profiles pf on pf.id = ac.user_id
  left join public.player_ratings pr
    on pr.user_id = ac.user_id and pr.sport = (select sport_key from sk) and pr.format = (select fmt from sk)
  left join public.space s on s.id = ac.space_id
  where ac.status = 'open'
    and ac.sport = (select sport_key from sk)
    and not (public.is_minor(pf) and pf.id <> auth.uid())   -- Addendum D: el menor no aparece en el feed público
  order by ac.created_at desc;
$$;

grant execute on function public.availability_feed(text) to authenticated;

notify pgrst, 'reload schema';
