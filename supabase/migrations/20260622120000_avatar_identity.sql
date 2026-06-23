-- ============================================================================
-- Identidad por avatar: foto propia O la mascota "Rally" con 10 looks.
-- Pequeño, desbloquea identidad para toda la app antes de Fichas/Tienda.
-- NO toca el motor (rating/xp/fichas): solo profiles + storage + RPCs de lectura
-- (a las que se les añaden columnas de avatar). Cero tenant_id.
--
-- Ley 21.719 (datos de menores): un menor (birthdate con edad < 18) NUNCA expone
-- foto — se fuerza a 'rally'. Lo garantiza un trigger (backstop) + la UI lo oculta.
-- ============================================================================

-- profiles.avatar_url ya existe. Añadimos kind + look.
alter table public.profiles add column if not exists avatar_kind text not null default 'rally';
alter table public.profiles add column if not exists avatar_look text not null default 'classic';

-- Las cuentas con foto previa quedan como 'photo'; el resto, 'rally'.
update public.profiles set avatar_kind = 'photo' where avatar_url is not null and avatar_kind = 'rally';

alter table public.profiles drop constraint if exists profiles_avatar_kind_chk;
alter table public.profiles add constraint profiles_avatar_kind_chk check (avatar_kind in ('photo', 'rally'));
alter table public.profiles drop constraint if exists profiles_avatar_look_chk;
alter table public.profiles add constraint profiles_avatar_look_chk check (avatar_look in
  ('classic','headband','cap','visor','shades','warpaint','crown','pro','fire','night'));

-- Protección de menores: fuerza 'rally' (sin foto) si el perfil es de un menor.
create or replace function public._enforce_avatar_privacy()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.avatar_kind = 'photo'
     and new.birthdate is not null
     and new.birthdate > (current_date - interval '18 years') then
    new.avatar_kind := 'rally';
    new.avatar_url := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_avatar_privacy on public.profiles;
create trigger trg_avatar_privacy
  before insert or update of avatar_kind, avatar_url, birthdate on public.profiles
  for each row execute function public._enforce_avatar_privacy();

-- ----------------------------------------------------------------------------
-- Storage: bucket `avatars`. Lectura pública (los menores nunca suben foto, por
-- el trigger); escritura/borrado solo en la carpeta propia {user_id}/...
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- Extender RPCs de lectura con avatar_kind/avatar_look (aditivo). Drop+recreate
-- por cambio de tipo de retorno; re-grant al final.
-- ----------------------------------------------------------------------------
drop function if exists public.ladder_standings(uuid);
create or replace function public.ladder_standings(_escalerilla_id uuid)
returns table (local_rank int, user_id uuid, name text, avatar_url text, avatar_kind text, avatar_look text, nivel numeric, category text, rating numeric)
language sql stable security definer set search_path = public as $$
  with sp as (select sport from public.space where id = _escalerilla_id)
  select
    ss.local_rank, pf.id, pf.display_name, pf.avatar_url, pf.avatar_kind, pf.avatar_look,
    pr.nivel,
    (select cc.label from public.category_config cc
       where cc.sport = (select sport from sp)
         and cc.category_key = public.get_player_category(pr.nivel, (select sport from sp)) limit 1),
    pr.rating
  from public.space_standing ss
  join public.profiles pf on pf.id = ss.player_id
  left join public.player_ratings pr
    on pr.user_id = ss.player_id
   and pr.sport = (select sport from sp)
   and pr.format = case when (select sport from sp) = 'padel' then 'doubles' else 'singles' end
  where ss.space_id = _escalerilla_id
  order by ss.local_rank;
$$;

drop function if exists public.space_roster(uuid);
create or replace function public.space_roster(_space_id uuid)
returns table (user_id uuid, name text, avatar_url text, avatar_kind text, avatar_look text)
language sql stable security definer set search_path = public as $$
  select pf.id, pf.display_name, pf.avatar_url, pf.avatar_kind, pf.avatar_look
  from public.space_membership m
  join public.profiles pf on pf.id = m.player_id
  where m.space_id = _space_id and m.status = 'active'
    and pf.id <> auth.uid()
    and exists (
      select 1 from public.space_membership me
      where me.space_id = _space_id and me.player_id = auth.uid() and me.status = 'active'
    )
  order by pf.display_name;
$$;

drop function if exists public.pending_confirmations();
create or replace function public.pending_confirmations()
returns table (
  match_id uuid, space_id uuid, sport text, format text,
  recorder_name text, recorder_avatar_url text, recorder_avatar_kind text, recorder_avatar_look text,
  i_won boolean, played_at timestamptz, score jsonb
)
language sql stable security definer set search_path = public as $$
  select
    m.id, m.space_id, m.sport, m.format,
    rec.display_name, rec.avatar_url, rec.avatar_kind, rec.avatar_look,
    case when auth.uid() = any(m.side_a) then (m.match_winner = 'a') else (m.match_winner = 'b') end,
    m.played_at,
    coalesce(
      (select jsonb_agg(jsonb_build_object('a', ms.games_a, 'b', ms.games_b) order by ms.set_index)
         from public.match_sets ms where ms.match_id = m.id),
      '[]'::jsonb
    )
  from public.matches m
  join public.profiles rec on rec.id = m.recorded_by
  where m.confirmation_status = 'pending'
    and auth.uid() = any(m.side_a || m.side_b)
    and auth.uid() <> m.recorded_by
    and (m.recorded_by = any(m.side_a)) <> (auth.uid() = any(m.side_a))
  order by m.played_at desc;
$$;

drop function if exists public.club_ranking(text);
create or replace function public.club_ranking(_sport text)
returns table (
  user_id uuid, first_name text, last_name text, avatar_url text, avatar_kind text, avatar_look text,
  level numeric, reliability int, matches_played int, category text,
  rank_position int, prev_rank_position int, streak int, last_match_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with sk as (
    select case when _sport = 'padel' then 'padel' else 'tennis' end as sport_key,
           case when _sport = 'padel' then 'doubles' else 'singles' end as fmt
  ),
  club as (
    select s.id from public.space s
      join public.space_membership m on m.space_id = s.id
     where s.type = 'club' and m.player_id = auth.uid() and m.status = 'active' limit 1
  )
  select
    pr.user_id,
    nullif(split_part(coalesce(pf.display_name, ''), ' ', 1), '') as first_name,
    nullif(trim(substr(coalesce(pf.display_name, ''), strpos(coalesce(pf.display_name, '') || ' ', ' ') + 1)), '') as last_name,
    pf.avatar_url, pf.avatar_kind, pf.avatar_look,
    pr.nivel as level,
    greatest(0, least(100, round((350 - pr.rd) / 3.0)))::int as reliability,
    pr.matches_count as matches_played,
    (select cc.label from public.category_config cc
      where cc.sport = (select sport_key from sk)
        and cc.category_key = public.get_player_category(pr.nivel, (select sport_key from sk)) limit 1) as category,
    row_number() over (order by pr.nivel desc, pr.rating desc, pf.display_name)::int as rank_position,
    null::int as prev_rank_position,
    0 as streak,
    null::timestamptz as last_match_at
  from public.player_ratings pr
  join public.profiles pf on pf.id = pr.user_id
  where pr.sport = (select sport_key from sk) and pr.format = (select fmt from sk)
    and exists (
      select 1 from public.space_membership m
      where m.player_id = pr.user_id and m.status = 'active'
        and m.space_id in (select id from club)
    )
  order by rank_position;
$$;

grant execute on function public.ladder_standings(uuid) to authenticated;
grant execute on function public.space_roster(uuid) to authenticated;
grant execute on function public.pending_confirmations() to authenticated;
grant execute on function public.club_ranking(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Seed demo: looks variados; 1-2 con foto (placeholder genérico).
-- ----------------------------------------------------------------------------
do $$
declare _looks text[] := array['headband','cap','visor','shades','warpaint','crown','pro','fire','night','classic'];
  _emails text[] := array['demo01@demo.local','demo02@demo.local','demo03@demo.local','demo04@demo.local','demo05@demo.local','demo06@demo.local','demo07@demo.local','demo08@demo.local','demo09@demo.local','demo10@demo.local'];
  _i int;
begin
  -- demouser: Rally con look 'fire'.
  update public.profiles set avatar_kind = 'rally', avatar_look = 'fire'
   where id = (select id from auth.users where email = 'demouser@aceplay.cl');
  -- 10 demo players con looks variados de Rally.
  for _i in 1 .. array_length(_emails, 1) loop
    update public.profiles set avatar_kind = 'rally', avatar_look = _looks[_i]
     where id = (select id from auth.users where email = _emails[_i]);
  end loop;
  -- 2 con foto (placeholder genérico; el trigger las degradaría si fueran menores).
  update public.profiles set avatar_kind = 'photo', avatar_url = 'https://i.pravatar.cc/200?u=demo11'
   where id = (select id from auth.users where email = 'demo11@demo.local');
  update public.profiles set avatar_kind = 'photo', avatar_url = 'https://i.pravatar.cc/200?u=demo12'
   where id = (select id from auth.users where email = 'demo12@demo.local');
end $$;

notify pgrst, 'reload schema';
