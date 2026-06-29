-- RETO VIVO entre participantes CON CUENTA, scopeado al torneo RR.
-- Flujo: retar → aceptar (con día/cancha) → cargar resultado → confirma el rival
-- → escribe rr_match (suma a la tabla PONDERADA del torneo).
-- FIREWALL: NO mueve el rating Glicko global (Fase A sigue desacoplada). Los
-- roster_players SIN cuenta no participan del reto vivo (el organizador los carga).

create table if not exists public.rr_challenge (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.space(id) on delete cascade,
  challenger uuid not null references public.roster_players(id) on delete cascade,
  opponent   uuid not null references public.roster_players(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled','recorded','confirmed')),
  slot text,                                   -- día/cancha propuesto (referencial)
  proposed_winner uuid references public.roster_players(id),
  proposed_sets jsonb,
  recorded_by uuid references public.roster_players(id),
  rr_match_id uuid references public.rr_match(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rr_challenge_cat_idx on public.rr_challenge (category_id);
grant select on public.rr_challenge to authenticated;
grant all on public.rr_challenge to service_role;
alter table public.rr_challenge enable row level security;
do $$ begin
  create policy rrc_read on public.rr_challenge for select using (
    exists (select 1 from public.roster_players rp where rp.id in (challenger, opponent) and rp.claimed_by = auth.uid())
    or public.space_can_manage(category_id)
  );
exception when duplicate_object then null; end $$;

-- mi roster_player (con cuenta) en una categoría.
create or replace function public._rr_my_player(_category_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select pa.roster_player_id
  from public.rr_participant pa
  join public.roster_players rp on rp.id = pa.roster_player_id
  where pa.category_id = _category_id and rp.claimed_by = auth.uid()
  limit 1;
$$;

-- escribe el rr_match + sets (compartido). No toca rating.
create or replace function public._rr_write_match(_category_id uuid, _a uuid, _b uuid, _winner uuid, _sets jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare _m uuid; _s jsonb; _i int := 0;
begin
  insert into public.rr_match (category_id, player_a, player_b, winner, played_at)
  values (_category_id, _a, _b, _winner, now()) returning id into _m;
  for _s in select value from jsonb_array_elements(coalesce(_sets, '[]'::jsonb)) loop
    insert into public.rr_match_set (rr_match_id, set_index, games_a, games_b, is_tiebreak)
    values (_m, _i, (_s->>'games_a')::int, (_s->>'games_b')::int, coalesce((_s->>'is_tiebreak')::boolean, false));
    _i := _i + 1;
  end loop;
  return _m;
end $$;

-- 1 · enviar reto.
create or replace function public.rr_send_challenge(_category_id uuid, _opponent uuid, _slot text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _me uuid; _id uuid;
begin
  _me := public._rr_my_player(_category_id);
  if _me is null then raise exception 'No participas en esta categoría con una cuenta.'; end if;
  if _me = _opponent then raise exception 'No puedes retarte a ti mismo.'; end if;
  if not exists (select 1 from public.rr_participant pa join public.roster_players rp on rp.id = pa.roster_player_id
                 where pa.category_id = _category_id and pa.roster_player_id = _opponent and rp.claimed_by is not null) then
    raise exception 'Ese rival aún no tiene cuenta en la app; el organizador carga ese resultado.';
  end if;
  if exists (select 1 from public.rr_match m where m.category_id = _category_id
             and ((m.player_a = _me and m.player_b = _opponent) or (m.player_a = _opponent and m.player_b = _me))) then
    raise exception 'Ya jugaste con ese rival.';
  end if;
  if exists (select 1 from public.rr_challenge c where c.category_id = _category_id
             and c.status in ('pending','accepted','recorded')
             and ((c.challenger = _me and c.opponent = _opponent) or (c.challenger = _opponent and c.opponent = _me))) then
    raise exception 'Ya hay un reto en curso con ese rival.';
  end if;
  insert into public.rr_challenge (category_id, challenger, opponent, slot, created_by)
  values (_category_id, _me, _opponent, nullif(trim(_slot), ''), auth.uid()) returning id into _id;
  return _id;
end $$;

-- 2 · responder (accept/decline por el rival; cancel por el retador).
create or replace function public.rr_respond_challenge(_challenge_id uuid, _action text, _slot text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.rr_challenge%rowtype; _me uuid;
begin
  select * into c from public.rr_challenge where id = _challenge_id;
  if not found then raise exception 'Reto no encontrado'; end if;
  _me := public._rr_my_player(c.category_id);
  if _action = 'accept' then
    if c.opponent <> _me then raise exception 'Solo el retado puede aceptar.'; end if;
    if c.status <> 'pending' then raise exception 'El reto ya no está pendiente.'; end if;
    update public.rr_challenge set status='accepted', slot=coalesce(nullif(trim(_slot),''), slot), updated_at=now() where id=_challenge_id;
  elsif _action = 'decline' then
    if c.opponent <> _me then raise exception 'Solo el retado puede rechazar.'; end if;
    update public.rr_challenge set status='declined', updated_at=now() where id=_challenge_id;
  elsif _action = 'cancel' then
    if c.challenger <> _me then raise exception 'Solo el retador puede cancelar.'; end if;
    update public.rr_challenge set status='cancelled', updated_at=now() where id=_challenge_id;
  else
    raise exception 'Acción inválida';
  end if;
end $$;

-- 3 · cargar el resultado propuesto (cualquiera de los dos).
create or replace function public.rr_challenge_record(_challenge_id uuid, _winner uuid, _sets jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare c public.rr_challenge%rowtype; _me uuid;
begin
  select * into c from public.rr_challenge where id = _challenge_id;
  if not found then raise exception 'Reto no encontrado'; end if;
  _me := public._rr_my_player(c.category_id);
  if _me not in (c.challenger, c.opponent) then raise exception 'No participas en este reto.'; end if;
  if c.status <> 'accepted' then raise exception 'El reto debe estar aceptado para cargar resultado.'; end if;
  if _winner not in (c.challenger, c.opponent) then raise exception 'El ganador debe ser uno de los dos.'; end if;
  update public.rr_challenge
     set status='recorded', proposed_winner=_winner, proposed_sets=_sets, recorded_by=_me, updated_at=now()
   where id=_challenge_id;
end $$;

-- 4 · confirmar (el OTRO) → escribe el rr_match y suma a la tabla.
create or replace function public.rr_challenge_confirm(_challenge_id uuid, _agree boolean)
returns void language plpgsql security definer set search_path = public as $$
declare c public.rr_challenge%rowtype; _me uuid; _m uuid;
begin
  select * into c from public.rr_challenge where id = _challenge_id;
  if not found then raise exception 'Reto no encontrado'; end if;
  _me := public._rr_my_player(c.category_id);
  if _me not in (c.challenger, c.opponent) then raise exception 'No participas en este reto.'; end if;
  if c.status <> 'recorded' then raise exception 'No hay un resultado por confirmar.'; end if;
  if _me = c.recorded_by then raise exception 'Debe confirmar el otro jugador.'; end if;
  if _agree then
    _m := public._rr_write_match(c.category_id, c.challenger, c.opponent, c.proposed_winner, c.proposed_sets);
    update public.rr_challenge set status='confirmed', rr_match_id=_m, updated_at=now() where id=_challenge_id;
  else
    update public.rr_challenge set status='accepted', proposed_winner=null, proposed_sets=null, recorded_by=null, updated_at=now() where id=_challenge_id;
  end if;
end $$;

-- 5 · mis retos en la categoría (lectura).
create or replace function public.rr_my_challenges(_category_id uuid)
returns table (id uuid, status text, slot text, i_am_challenger boolean, rival uuid, rival_name text,
               proposed_winner uuid, proposed_sets jsonb, recorded_by_me boolean)
language sql stable security definer set search_path = public as $$
  with me as (select public._rr_my_player(_category_id) as id)
  select c.id, c.status, c.slot,
         c.challenger = (select id from me) as i_am_challenger,
         case when c.challenger = (select id from me) then c.opponent else c.challenger end as rival,
         rp.display_name as rival_name,
         c.proposed_winner, c.proposed_sets,
         (c.recorded_by = (select id from me)) as recorded_by_me
  from public.rr_challenge c
  join public.roster_players rp
    on rp.id = case when c.challenger = (select id from me) then c.opponent else c.challenger end
  where c.category_id = _category_id
    and (select id from me) in (c.challenger, c.opponent)
    and c.status in ('pending','accepted','recorded')
  order by c.updated_at desc;
$$;

grant execute on function public._rr_my_player(uuid) to authenticated;
grant execute on function public.rr_send_challenge(uuid, uuid, text) to authenticated;
grant execute on function public.rr_respond_challenge(uuid, text, text) to authenticated;
grant execute on function public.rr_challenge_record(uuid, uuid, jsonb) to authenticated;
grant execute on function public.rr_challenge_confirm(uuid, boolean) to authenticated;
grant execute on function public.rr_my_challenges(uuid) to authenticated;

-- Demo: 2 participantes CON CUENTA (al final, 0 partidos) para ejercitar el reto
-- vivo sin tocar a los 30 reales. Usa cuentas demo existentes.
do $$
declare _cat uuid; _club uuid; _u uuid; _rp uuid; _email text; _emails text[] := array['demo01@demo.local','demo02@demo.local'];
begin
  select id into _cat from public.space where slug = 'cat-rr-providencia-2026';
  if _cat is null then return; end if;
  select t.parent_space_id into _club from public.space c join public.space t on t.id = c.parent_space_id where c.id = _cat;
  foreach _email in array _emails loop
    select id into _u from auth.users where email = _email;
    if _u is null then continue; end if;
    if exists (select 1 from public.rr_participant pa join public.roster_players rp on rp.id = pa.roster_player_id
               where pa.category_id = _cat and rp.claimed_by = _u) then continue; end if;
    insert into public.roster_players (club_id, display_name, source, claimed_by)
    values (_club, 'Reto Demo ' || upper(substr(_email, 5, 1)), 'manual', _u) returning id into _rp;
    insert into public.rr_participant (category_id, roster_player_id) values (_cat, _rp);
  end loop;
end $$;

notify pgrst, 'reload schema';
