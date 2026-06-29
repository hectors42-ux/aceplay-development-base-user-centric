-- Ajuste demo del reto vivo: nombres distinguibles para los 2 participantes con
-- cuenta + password conocido para demo01/demo02 (cuentas @demo.local de prueba),
-- para poder ejercitar y demostrar el flujo reto → aceptar → cargar → confirmar.
do $$
declare _cat uuid;
begin
  select id into _cat from public.space where slug = 'cat-rr-providencia-2026';
  if _cat is null then return; end if;
  update public.roster_players rp
     set display_name = 'Reto Demo A'
   where rp.claimed_by = (select id from auth.users where email = 'demo01@demo.local')
     and exists (select 1 from public.rr_participant pa where pa.roster_player_id = rp.id and pa.category_id = _cat);
  update public.roster_players rp
     set display_name = 'Reto Demo B'
   where rp.claimed_by = (select id from auth.users where email = 'demo02@demo.local')
     and exists (select 1 from public.rr_participant pa where pa.roster_player_id = rp.id and pa.category_id = _cat);
end $$;

-- Password de prueba (cuentas demo, entorno interno). pgcrypto vive en extensions.
update auth.users
   set encrypted_password = extensions.crypt('AcePlay2024', extensions.gen_salt('bf')),
       email_confirmed_at = coalesce(email_confirmed_at, now()),
       updated_at = now()
 where email in ('demo01@demo.local', 'demo02@demo.local');

notify pgrst, 'reload schema';
