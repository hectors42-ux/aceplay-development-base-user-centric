-- F2 · Fidelidad del reglamento RR: tipo de resultado (retiro/walkover), avance del
-- torneo + corte, lista de "a quién reto" (pendientes), y settings de corte/zonas.
-- El desempate por duelo directo (criterio 5) YA vive en round_robin_standings.

-- 1 · rr_match: tipo de resultado (normal/retiro/walkover) para señalizar inconclusos.
alter table public.rr_match add column if not exists result_type text not null default 'normal';
do $$ begin
  alter table public.rr_match add constraint rr_match_result_type_chk
    check (result_type in ('normal','retiro','walkover'));
exception when duplicate_object then null; end $$;

-- 2 · rr_record_result acepta _result_type (default 'normal'). Recreamos (drop del 5-arg).
drop function if exists public.rr_record_result(uuid, uuid, uuid, uuid, jsonb);
create or replace function public.rr_record_result(
  _category_id uuid, _player_a uuid, _player_b uuid, _winner uuid, _sets jsonb,
  _result_type text default 'normal'
) returns uuid language plpgsql security definer set search_path = public as $$
declare _m uuid; _s jsonb; _idx int := 0;
begin
  if not public._rr_can_manage(_category_id) then
    raise exception 'Solo el organizador puede cargar resultados';
  end if;
  if _player_a = _player_b then raise exception 'Un jugador no puede jugar contra sí mismo'; end if;
  if _winner is not null and _winner <> _player_a and _winner <> _player_b then
    raise exception 'El ganador debe ser uno de los dos jugadores';
  end if;
  if not exists (select 1 from public.rr_participant where category_id = _category_id and roster_player_id = _player_a)
     or not exists (select 1 from public.rr_participant where category_id = _category_id and roster_player_id = _player_b) then
    raise exception 'Ambos jugadores deben estar inscritos en la categoría';
  end if;
  insert into public.rr_match (category_id, player_a, player_b, winner, played_at, result_type)
  values (_category_id, _player_a, _player_b, _winner, now(),
          case when _result_type in ('normal','retiro','walkover') then _result_type else 'normal' end)
  returning id into _m;
  for _s in select value from jsonb_array_elements(coalesce(_sets, '[]'::jsonb)) loop
    insert into public.rr_match_set (rr_match_id, set_index, games_a, games_b, is_tiebreak)
    values (_m, _idx, (_s->>'games_a')::int, (_s->>'games_b')::int, coalesce((_s->>'is_tiebreak')::boolean, false));
    _idx := _idx + 1;
  end loop;
  return _m;
end $$;
grant execute on function public.rr_record_result(uuid, uuid, uuid, uuid, jsonb, text) to authenticated;

-- 3 · Avance del torneo + corte (settings de la categoría).
create or replace function public.round_robin_progress(_category_id uuid)
returns table (participants int, played int, possible int, remaining int, pct numeric,
               closes_at date, prize_top int, asado_bottom int)
language sql stable security definer set search_path = public as $$
  with p as (select count(*)::int n from public.rr_participant where category_id = _category_id),
       m as (select count(*)::int n from public.rr_match where category_id = _category_id),
       s as (select settings from public.space where id = _category_id)
  select p.n, m.n,
         (p.n * (p.n - 1) / 2)::int,
         ((p.n * (p.n - 1) / 2) - m.n)::int,
         case when p.n > 1 then round(100.0 * m.n / (p.n * (p.n - 1) / 2), 1) else 0 end,
         nullif(s.settings->>'closes_at','')::date,
         coalesce((s.settings->>'prize_top')::int, 0),
         coalesce((s.settings->>'asado_bottom')::int, 0)
  from p, m, s;
$$;
grant execute on function public.round_robin_progress(uuid) to authenticated;

-- 4 · "A quién reto": rivales que el usuario actual (su roster claimed) aún NO enfrentó.
create or replace function public.round_robin_pending(_category_id uuid)
returns table (roster_player_id uuid, display_name text)
language sql stable security definer set search_path = public as $$
  with me as (
    select pa.roster_player_id as id
    from public.rr_participant pa
    join public.roster_players rp on rp.id = pa.roster_player_id
    where pa.category_id = _category_id and rp.claimed_by = auth.uid()
    limit 1
  ),
  faced as (
    select case when m.player_a = (select id from me) then m.player_b else m.player_a end as rid
    from public.rr_match m
    where m.category_id = _category_id
      and (select id from me) in (m.player_a, m.player_b)
  )
  select rp.id, rp.display_name
  from public.rr_participant pa
  join public.roster_players rp on rp.id = pa.roster_player_id
  where pa.category_id = _category_id
    and (select id from me) is not null
    and rp.id <> (select id from me)
    and rp.id not in (select rid from faced)
  order by rp.display_name;
$$;
grant execute on function public.round_robin_pending(uuid) to authenticated;

-- 5 · Settings de la categoría del gemelo: corte 29-nov-2026, premio top-4, asado últimos-6.
--     + backfill del único partido por RETIRO (Gabriel M. vs Nicolae P.).
do $$
declare _cat uuid; _ga uuid; _ni uuid;
begin
  select id into _cat from public.space where slug = 'cat-rr-providencia-2026';
  if _cat is null then return; end if;
  update public.space
     set settings = coalesce(settings, '{}'::jsonb)
       || jsonb_build_object('closes_at', '2026-11-29', 'prize_top', 4, 'asado_bottom', 6)
   where id = _cat;

  select rp.id into _ga from public.roster_players rp
    join public.rr_participant pa on pa.roster_player_id = rp.id
   where pa.category_id = _cat and rp.display_name = 'Gabriel M.' limit 1;
  select rp.id into _ni from public.roster_players rp
    join public.rr_participant pa on pa.roster_player_id = rp.id
   where pa.category_id = _cat and rp.display_name = 'Nicolae P.' limit 1;
  if _ga is not null and _ni is not null then
    update public.rr_match set result_type = 'retiro'
     where category_id = _cat
       and ((player_a = _ga and player_b = _ni) or (player_a = _ni and player_b = _ga));
  end if;
end $$;

notify pgrst, 'reload schema';
