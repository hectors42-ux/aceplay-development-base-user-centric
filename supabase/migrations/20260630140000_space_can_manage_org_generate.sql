-- ============================================================================
-- FASE B.1 (#1+#2) · Entrada del organizador al motor VIVO + generar llave.
-- Construye SOBRE el motor space vivo (los internos _generate_* existentes). NO
-- toca el motor: agrega un wrapper nuevo con un gate más amplio (organizador de
-- la categoría/torneo/club O admin) para que UI y RPC concuerden. No usa nada de
-- la capa legacy muerta (tournament_categories/is_tournament_manager/etc.).
-- FIREWALL: generar la llave NO escribe en rating/xp/fichas.
-- ============================================================================

-- Gate vivo de gestión: ¿el caller es organizador de este espacio o de un
-- ancestro (torneo/club), o admin? Sirve para el HERO (id de torneo) y para la
-- CATEGORÍA (id de categoría).
create or replace function public.space_can_manage(_space_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, parent_space_id, organizer_id
    from public.space where id = _space_id
    union all
    select s.id, s.parent_space_id, s.organizer_id
    from public.space s join chain c on s.id = c.parent_space_id
  )
  select public.is_admin() or exists (
    select 1 from chain where organizer_id = auth.uid()
  );
$$;
grant execute on function public.space_can_manage(uuid) to authenticated;

-- Generar la llave (dispatcher por formato) con el gate de gestión. Reusa los
-- generadores internos VIVOS del motor; no duplica su lógica de formato.
create or replace function public.org_generate_bracket(_category_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare _motor text;
begin
  if not public.space_can_manage(_category_id) then
    raise exception 'Solo el organizador o admin del torneo puede generar la llave';
  end if;
  select motor into _motor from public.tournament_config where space_id = _category_id;
  if _motor is null then raise exception 'La categoría no tiene formato configurado'; end if;

  if _motor = 'round_robin' then        perform public._generate_round_robin(_category_id);
  elsif _motor = 'consolation' then     perform public._generate_consolation(_category_id);
  elsif _motor = 'groups_playoff' then  perform public._generate_groups(_category_id);
  elsif _motor = 'double_elimination' then perform public._generate_double_elim(_category_id);
  elsif _motor = 'americano' then       perform public._generate_americano(_category_id);
  else                                  perform public._generate_bracket(_category_id);
  end if;
end $$;
grant execute on function public.org_generate_bracket(uuid) to authenticated;

notify pgrst, 'reload schema';
