-- SEED B.1 · demouser organiza la Escalerilla Providencia (round-robin roster de
-- Fase A) para poder ver/gestionar la tabla PONDERADA + H2H en local. Demo-only.
-- (organizer_id = demouser → can_access_space lo deja ver y space_can_manage gestionar.)
do $$
declare _me uuid;
begin
  select id into _me from auth.users where email = 'demouser@aceplay.cl';
  if _me is null then return; end if;
  update public.space set organizer_id = _me
   where slug in ('torneo-escalerilla-prov', 'cat-escalerilla-prov');
end $$;

notify pgrst, 'reload schema';
