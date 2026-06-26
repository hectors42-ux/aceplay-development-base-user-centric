-- SEED B.1 · Membresía de demouser en la "Escalerilla Providencia" (torneo
-- round-robin) para que el RLS de space lo deje LEER el torneo/categoría (además
-- de organizer_id, can_access_space chequea space_membership). Rol 'organizer' →
-- también lo reconoce el gate de gestión. Demo-only.
do $$
declare _me uuid; _tour uuid; _cat uuid;
begin
  select id into _me from auth.users where email = 'demouser@aceplay.cl';
  select id into _tour from public.space where slug = 'torneo-escalerilla-prov';
  select id into _cat from public.space where slug = 'cat-escalerilla-prov';
  if _me is null then return; end if;
  if _tour is not null then
    insert into public.space_membership (player_id, space_id, role, status)
    values (_me, _tour, 'organizer'::public.membership_role, 'active')
    on conflict (player_id, space_id) do update set role = 'organizer', status = 'active';
  end if;
  if _cat is not null then
    insert into public.space_membership (player_id, space_id, role, status)
    values (_me, _cat, 'organizer'::public.membership_role, 'active')
    on conflict (player_id, space_id) do update set role = 'organizer', status = 'active';
  end if;
end $$;

notify pgrst, 'reload schema';
