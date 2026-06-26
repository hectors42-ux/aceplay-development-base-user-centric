-- FIX · separación de deportes en escalerillas: list_escalerillas no filtraba por
-- deporte (solo type='escalerilla' + acceso), así que el selector mostraba
-- escalerillas de TODOS los deportes (viola tenis/pádel no se cruzan). Agrega
-- _sport (default null = comportamiento actual, para no romper useMySpaces que
-- filtra client-side) y filtra en el WHERE cuando viene. Drop+recreate por cambio
-- de firma (evita ambigüedad de overload en PostgREST con la llamada sin args).
drop function if exists public.list_escalerillas();

create or replace function public.list_escalerillas(_sport text default null)
returns table (space_id uuid, name text, sport text, enrolled boolean, my_rank int, players int)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.sport,
    exists (select 1 from public.space_membership m where m.space_id = s.id and m.player_id = auth.uid() and m.status = 'active'),
    (select ss.local_rank from public.space_standing ss where ss.space_id = s.id and ss.player_id = auth.uid()),
    (select count(*)::int from public.space_standing ss where ss.space_id = s.id)
  from public.space s
  where s.type = 'escalerilla'
    and (_sport is null or s.sport = _sport)
    and (
      (s.visibility <> 'public' and public.can_access_space(s.id))
      or exists (select 1 from public.space_membership m where m.space_id = s.id and m.player_id = auth.uid() and m.status = 'active')
      or s.organizer_id = auth.uid()
    )
  order by s.name;
$$;
grant execute on function public.list_escalerillas(text) to authenticated;

notify pgrst, 'reload schema';
