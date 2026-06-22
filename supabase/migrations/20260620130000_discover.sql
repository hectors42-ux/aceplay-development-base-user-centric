-- FASE 5 (Part B): "Descubrir" — la capa de oportunidades públicas multi-club.
--  * discover_opportunities: lista spaces public (torneos + escalerillas) de CUALQUIER club.
--  * discover_enroll: inscripción cross-club en el space público SIN volverte socio del club.
--  * list_escalerillas / list_tournament_categories ("Mi club") dejan de mostrar lo público de
--    OTROS clubes: solo members/hierarchy accesible del club propio + lo que ya me inscribí +
--    lo que yo organizo. El rating que alimenta cualquier partido es el GLOBAL. Cero tenant_id.

-- "Mi club" — escalerillas: excluye public ajeno; incluye inscritas y organizadas por mí.
create or replace function public.list_escalerillas()
returns table (space_id uuid, name text, sport text, enrolled boolean, my_rank int, players int)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.sport,
    exists (select 1 from public.space_membership m where m.space_id = s.id and m.player_id = auth.uid() and m.status = 'active'),
    (select ss.local_rank from public.space_standing ss where ss.space_id = s.id and ss.player_id = auth.uid()),
    (select count(*)::int from public.space_standing ss where ss.space_id = s.id)
  from public.space s
  where s.type = 'escalerilla'
    and (
      (s.visibility <> 'public' and public.can_access_space(s.id))
      or exists (select 1 from public.space_membership m where m.space_id = s.id and m.player_id = auth.uid() and m.status = 'active')
      or s.organizer_id = auth.uid()
    )
  order by s.name;
$$;

-- "Mi club" — categorías de torneo: misma regla (incluye `motor` como ya esperaba la UI).
drop function if exists public.list_tournament_categories();
create or replace function public.list_tournament_categories()
returns table (category_id uuid, category_name text, tournament_name text, sport text,
               enrolled boolean, players int, bracket_ready boolean, motor text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, t.name, c.sport,
    exists (select 1 from public.space_membership m where m.space_id = c.id and m.player_id = auth.uid() and m.status = 'active'),
    (select count(*)::int from public.space_membership m where m.space_id = c.id and m.status = 'active' and m.role = 'player'),
    exists (select 1 from public.tournament_bracket b where b.category_id = c.id),
    (select tc.motor from public.tournament_config tc where tc.space_id = c.id)
  from public.space c
  join public.space t on t.id = c.parent_space_id and t.type = 'tournament'
  where c.type = 'category'
    and (
      (c.visibility <> 'public' and public.can_access_space(c.id))
      or exists (select 1 from public.space_membership m where m.space_id = c.id and m.player_id = auth.uid() and m.status = 'active')
      or c.organizer_id = auth.uid()
    )
  order by t.name, c.name;
$$;

-- Descubrir: oportunidades públicas de cualquier club (torneos como categoría + escalerillas).
create or replace function public.discover_opportunities(_sport text default null, _level text default null, _status text default null)
returns table (space_id uuid, kind text, name text, club_name text, sport text, level_label text,
               players int, max_players int, starts_at timestamptz, ends_at timestamptz, enrolled boolean, status text)
language sql stable security definer set search_path = public as $$
  with opps as (
    select e.id as space_id, 'escalerilla'::text as kind, e.name, e.sport,
      coalesce(nullif(e.settings->>'level_label', ''), 'Abierta') as level_label,
      (select count(*)::int from public.space_standing ss where ss.space_id = e.id) as players,
      nullif(e.settings->>'max_players', '')::int as max_players,
      nullif(e.settings->>'starts_at', '')::timestamptz as starts_at,
      nullif(e.settings->>'ends_at', '')::timestamptz as ends_at,
      e.parent_space_id as club_id,
      exists(select 1 from public.space_membership m where m.space_id = e.id and m.player_id = auth.uid() and m.status = 'active') as enrolled,
      (case when exists(select 1 from public.matches mt where mt.space_id = e.id and mt.confirmation_status = 'confirmed')
            then 'en_curso' else 'proximo' end) as status
    from public.space e
    where e.type = 'escalerilla' and e.visibility = 'public' and e.status = 'active'
    union all
    select c.id, 'torneo'::text, t.name || ' · ' || c.name, c.sport,
      coalesce(nullif(c.settings->>'level_label', ''), c.name),
      (select count(*)::int from public.space_membership m where m.space_id = c.id and m.status = 'active' and m.role = 'player'),
      nullif(c.settings->>'max_players', '')::int,
      nullif(t.settings->>'starts_at', '')::timestamptz,
      nullif(t.settings->>'ends_at', '')::timestamptz,
      t.parent_space_id,
      exists(select 1 from public.space_membership m where m.space_id = c.id and m.player_id = auth.uid() and m.status = 'active'),
      (case when exists(select 1 from public.tournament_bracket b where b.category_id = c.id) then 'en_curso' else 'proximo' end)
    from public.space c
    join public.space t on t.id = c.parent_space_id and t.type = 'tournament'
    where c.type = 'category' and c.visibility = 'public' and c.status = 'active'
  )
  select o.space_id, o.kind, o.name, cl.name as club_name, o.sport, o.level_label,
         o.players, o.max_players, o.starts_at, o.ends_at, o.enrolled, o.status
  from opps o
  left join public.space cl on cl.id = o.club_id
  where (_sport is null or _sport = '' or _sport = 'all' or o.sport = _sport)
    and (_status is null or _status = '' or _status = 'all' or o.status = _status)
    and (_level is null or _level = '' or _level = 'all' or o.level_label ilike '%' || _level || '%')
  order by o.status, o.name;
$$;

-- Inscripción cross-club: SOLO a spaces públicos; añade membership al space (NO al club).
create or replace function public.discover_enroll(_space_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _t text; _vis public.space_visibility; _next int;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  select type, visibility into _t, _vis from public.space where id = _space_id;
  if not found then raise exception 'Oportunidad no encontrada'; end if;
  if _vis <> 'public' then raise exception 'Solo puedes inscribirte por Descubrir a espacios públicos'; end if;
  if _t not in ('category', 'escalerilla') then raise exception 'Este espacio no admite inscripción directa'; end if;

  -- Membresía SOLO en el space público (no en el club organizador → no te hace socio).
  insert into public.space_membership (player_id, space_id, role, status)
  values (_uid, _space_id, 'player', 'active')
  on conflict (player_id, space_id) do update set status = 'active';

  -- En una escalerilla, entras al final de la tabla local.
  if _t = 'escalerilla' then
    select coalesce(max(local_rank), 0) + 1 into _next from public.space_standing where space_id = _space_id;
    insert into public.space_standing (space_id, player_id, local_rank, local_state)
    values (_space_id, _uid, _next, jsonb_build_object('status', 'active'))
    on conflict (space_id, player_id) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'kind', _t);
end $$;

grant execute on function public.list_escalerillas() to authenticated;
grant execute on function public.list_tournament_categories() to authenticated;
grant execute on function public.discover_opportunities(text, text, text) to authenticated;
grant execute on function public.discover_enroll(uuid) to authenticated;

notify pgrst, 'reload schema';
