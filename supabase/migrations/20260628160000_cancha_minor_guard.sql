-- ÉPICA M · Cancha — FIX M4: protección de menores en los llamados abiertos.
-- Ley 21.719 · Addendum D. La protección vive en el BACKEND (las RPCs), no solo en
-- la UI. Reusa is_minor() (una sola fuente de verdad); no crea noción nueva de menor.
--   1. post_availability RECHAZA si el autor es menor: un menor no publica
--      disponibilidad pública.
--   2. availability_feed NUNCA lista llamados de un autor menor (defensa en
--      profundidad, ni siquiera al propio menor), por si quedara alguno antiguo.
-- Coherente con M3 (un menor no aparece en matchmaking ni expone datos públicos).

-- 1 · post_availability con bloqueo de menor.
create or replace function public.post_availability(
  _sport text, _slots jsonb, _space_id uuid default null, _scope text default 'zone', _note text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _id uuid; _sk text;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  -- Protección de menores (Ley 21.719): no publican disponibilidad pública.
  if exists (select 1 from public.profiles p where p.id = _uid and public.is_minor(p)) then
    raise exception 'Los llamados abiertos no están disponibles para cuentas de menores';
  end if;
  _sk := case when _sport = 'padel' then 'padel' else 'tennis' end;
  if coalesce(_scope,'zone') not in ('zone','open') then raise exception 'Alcance inválido'; end if;
  insert into public.availability_calls (user_id, sport, slots, space_id, scope, note)
  values (_uid, _sk, coalesce(_slots,'[]'::jsonb), _space_id, coalesce(_scope,'zone'), _note)
  returning id into _id;
  return _id;
end $$;

-- 2 · availability_feed: excluye SIEMPRE a autores menores (defensa en profundidad).
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
    and not public.is_minor(pf)   -- Addendum D: NUNCA listar a un autor menor
  order by ac.created_at desc;
$$;

grant execute on function public.post_availability(text, jsonb, uuid, text, text) to authenticated;
grant execute on function public.availability_feed(text) to authenticated;

notify pgrst, 'reload schema';
