-- FIX 1: trigger que crea profiles desde auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'handle', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1))
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- BACKFILL
insert into public.profiles (id, handle, display_name)
select u.id,
       coalesce(u.raw_user_meta_data->>'handle', split_part(u.email,'@',1)),
       coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email,'@',1))
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- FIX 2: semilla canónica
insert into public.category_config (sport,rank_order,category_key,label,loss_points,requires_tournament,is_entry,promotes_to_escalafon) values
('tennis',1,'cuarta','Cuarta',-27,false,true,false),
('tennis',2,'tercera','Tercera',-28,false,false,false),
('tennis',3,'segunda','Segunda',-30,true,false,false),
('tennis',4,'primera','Primera',-30,true,false,false),
('tennis',5,'honor','Honor',-30,false,false,true),
('padel',1,'sexta','Sexta',-25,false,true,false),
('padel',2,'quinta','Quinta',-26,false,false,false),
('padel',3,'cuarta','Cuarta',-27,false,false,false),
('padel',4,'tercera','Tercera',-28,false,false,false),
('padel',5,'segunda','Segunda',-30,true,false,false),
('padel',6,'primera','Primera',-30,true,false,false),
('padel',7,'open','OPEN',-30,false,false,true)
on conflict (sport,rank_order) do update set
  label=excluded.label, loss_points=excluded.loss_points,
  requires_tournament=excluded.requires_tournament,
  is_entry=excluded.is_entry, promotes_to_escalafon=excluded.promotes_to_escalafon;