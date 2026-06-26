-- ============================================================================
-- FASE A · Round-robin con PUNTAJE PONDERADO (reglamento Club Providencia) +
-- base de inscripción de 3 vías (roster_players).
--
-- REEMPLAZA el conteo simple de 20260619220000 por la fórmula ponderada, pero NO
-- toca los otros 5 formatos. El módulo es AUTOCONTENIDO: como el trigger
-- trg_match_confirmed aplica rating a TODO match confirmado, un roster_player NO
-- puede pasar por public.matches. Por eso este motor usa rr_match/rr_match_set
-- propios y NUNCA escribe en public.player_ratings (firewall de 3 cruces).
--
-- Un participante puede ser un auth.user O un invitado del organizador: el motor
-- los trata IGUAL representándolos a TODOS como roster_players (el user queda
-- ligado vía claimed_by). Un match puede ser entre users, entre invitados o mixto.
-- ============================================================================

-- ¿el caller gestiona esta categoría? (organizador del torneo / de la categoría / admin)
create or replace function public._rr_can_manage(_category_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.space c
    join public.space t on t.id = c.parent_space_id and t.type = 'tournament'
    where c.id = _category_id
      and (t.organizer_id = auth.uid() or c.organizer_id = auth.uid())
  );
$$;
grant execute on function public._rr_can_manage(uuid) to authenticated;

-- RPC liviano para que la UI sepa si mostrar el formulario de gestión.
create or replace function public.rr_can_manage(_category_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public._rr_can_manage(_category_id);
$$;
grant execute on function public.rr_can_manage(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1 · roster_players — registra CÓMO entró cada participante (3 vías).
--   FIREWALL: un roster_player NO tiene rating global; su puntaje vive solo en
--   el torneo. claimed_by liga (estructura) un invitado a un user por email.
-- ---------------------------------------------------------------------------
create table if not exists public.roster_players (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.space(id) on delete cascade,
  display_name text not null,
  email        text,
  phone        text,
  source       text not null default 'manual' check (source in ('self', 'manual', 'import')),
  claimed_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists roster_players_club_idx on public.roster_players (club_id);
create index if not exists roster_players_claimed_idx on public.roster_players (claimed_by);

-- inscripción de un roster_player en una categoría (cualquiera de las 3 vías).
create table if not exists public.rr_participant (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid not null references public.space(id) on delete cascade,
  roster_player_id uuid not null references public.roster_players(id) on delete cascade,
  created_at       timestamptz not null default now(),
  unique (category_id, roster_player_id)
);
create index if not exists rr_participant_cat_idx on public.rr_participant (category_id);

-- resultados del round-robin (paralelos a matches/match_sets, sin tocar el rating).
create table if not exists public.rr_match (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.space(id) on delete cascade,
  player_a    uuid not null references public.roster_players(id) on delete cascade,
  player_b    uuid not null references public.roster_players(id) on delete cascade,
  winner      uuid references public.roster_players(id) on delete set null,
  played_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists rr_match_cat_idx on public.rr_match (category_id);

create table if not exists public.rr_match_set (
  rr_match_id uuid not null references public.rr_match(id) on delete cascade,
  set_index   int  not null,
  games_a     int  not null,
  games_b     int  not null,
  -- is_tiebreak = true → este "set" es el SUPER TIE-BREAK del 3er set; sus games
  -- son los PUNTOS del STB (ej. 10-8). Los sets normales llevan is_tiebreak=false.
  is_tiebreak boolean not null default false,
  primary key (rr_match_id, set_index)
);

-- ---------------------------------------------------------------------------
-- RLS: lectura pública/autenticada según acceso al espacio; escritura SOLO por
-- los RPC security-definer de abajo (no hay policies de insert/update/delete).
-- ---------------------------------------------------------------------------
alter table public.roster_players enable row level security;
alter table public.rr_participant enable row level security;
alter table public.rr_match       enable row level security;
alter table public.rr_match_set   enable row level security;

drop policy if exists roster_players_read on public.roster_players;
create policy roster_players_read on public.roster_players for select
  using (public.can_access_space(club_id));

drop policy if exists rr_participant_read on public.rr_participant;
create policy rr_participant_read on public.rr_participant for select
  using (public.can_access_space(category_id));

drop policy if exists rr_match_read on public.rr_match;
create policy rr_match_read on public.rr_match for select
  using (public.can_access_space(category_id));

drop policy if exists rr_match_set_read on public.rr_match_set;
create policy rr_match_set_read on public.rr_match_set for select
  using (exists (select 1 from public.rr_match m where m.id = rr_match_id and public.can_access_space(m.category_id)));

grant select on public.roster_players, public.rr_participant, public.rr_match, public.rr_match_set to authenticated;

-- ---------------------------------------------------------------------------
-- 2 · Inscripción flexible (3 vías a nivel de datos)
-- ---------------------------------------------------------------------------
-- · self: el auth.user actual se inscribe (source='self').
create or replace function public.enroll_self(_category_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _club uuid; _rp uuid; _name text;
begin
  if _uid is null then raise exception 'Necesitas iniciar sesión'; end if;
  select t.parent_space_id into _club
    from public.space c join public.space t on t.id = c.parent_space_id
    where c.id = _category_id and t.type = 'tournament';
  if _club is null then raise exception 'Categoría inválida'; end if;
  select display_name into _name from public.profiles where id = _uid;
  -- find-or-create del roster_player de este user en el club.
  select id into _rp from public.roster_players
    where club_id = _club and claimed_by = _uid limit 1;
  if _rp is null then
    insert into public.roster_players (club_id, display_name, source, claimed_by)
    values (_club, coalesce(_name, 'Jugador'), 'self', _uid) returning id into _rp;
  end if;
  insert into public.rr_participant (category_id, roster_player_id)
  values (_category_id, _rp) on conflict (category_id, roster_player_id) do nothing;
  return _rp;
end $$;
grant execute on function public.enroll_self(uuid) to authenticated;

-- · manual: el ORGANIZADOR da de alta un invitado (source='manual') y lo inscribe.
create or replace function public.organizer_add_player(
  _category_id uuid, _display_name text, _email text default null, _phone text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare _club uuid; _rp uuid;
begin
  if not public._rr_can_manage(_category_id) then
    raise exception 'Solo el organizador o admin del torneo puede agregar jugadores';
  end if;
  if coalesce(trim(_display_name), '') = '' then raise exception 'El nombre es obligatorio'; end if;
  select t.parent_space_id into _club
    from public.space c join public.space t on t.id = c.parent_space_id
    where c.id = _category_id and t.type = 'tournament';
  if _club is null then raise exception 'Categoría inválida'; end if;
  insert into public.roster_players (club_id, display_name, email, phone, source)
  values (_club, trim(_display_name), nullif(trim(_email), ''), nullif(trim(_phone), ''), 'manual')
  returning id into _rp;
  insert into public.rr_participant (category_id, roster_player_id)
  values (_category_id, _rp) on conflict (category_id, roster_player_id) do nothing;
  return _rp;
end $$;
grant execute on function public.organizer_add_player(uuid, text, text, text) to authenticated;
-- (La vía 'import' por planilla NO se construye aquí; source='import' queda disponible.)

-- ---------------------------------------------------------------------------
-- 6 · REGLA DEL JUGADOR DOMINANTE (entrada manual · aprobada)
--   Cuando un partido se interrumpe y cumple las condiciones del reglamento, el
--   ORGANIZADOR ingresa MANUALMENTE el marcador final derivado; el motor solo lo
--   ACEPTA y valida como un resultado normal. NO se calcula el marcador
--   automáticamente (diferido). rr_record_result es ese punto de aceptación.
-- ---------------------------------------------------------------------------
create or replace function public.rr_record_result(
  _category_id uuid, _player_a uuid, _player_b uuid, _winner uuid, _sets jsonb
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
  insert into public.rr_match (category_id, player_a, player_b, winner, played_at)
  values (_category_id, _player_a, _player_b, _winner, now()) returning id into _m;
  for _s in select value from jsonb_array_elements(coalesce(_sets, '[]'::jsonb)) loop
    insert into public.rr_match_set (rr_match_id, set_index, games_a, games_b, is_tiebreak)
    values (_m, _idx, (_s->>'games_a')::int, (_s->>'games_b')::int, coalesce((_s->>'is_tiebreak')::boolean, false));
    _idx := _idx + 1;
  end loop;
  return _m;
end $$;
grant execute on function public.rr_record_result(uuid, uuid, uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 1 (lectura) · PUNTAJE PONDERADO + jerarquía de desempate de 5 niveles.
--   Puntaje = PG×1.0 + Sets×0.1 + Juegos×0.01 + PuntosST×0.001
--   Sets/Juegos/PuntosST se derivan de rr_match_set (forma de match_sets):
--     · sets_ganados  = sets donde el jugador hizo más games/puntos.
--     · juegos_ganados= games del jugador en sets NORMALES (is_tiebreak=false).
--     · puntos_st     = puntos del jugador en sets SUPER TB (is_tiebreak=true).
--   Desempate (en orden): 1)PG 2)Sets 3)Juegos 4)Juegos STB 5)Duelo directo.
-- ---------------------------------------------------------------------------
create or replace function public.round_robin_standings(_category_id uuid)
returns table (
  player uuid, display_name text, source text,
  partidos_jugados int, partidos_ganados int,
  sets_ganados int, juegos_ganados int, puntos_st int, puntaje numeric
)
language sql stable security definer set search_path = public as $$
  with parts as (
    select rp.id, rp.display_name, rp.source
    from public.rr_participant pa
    join public.roster_players rp on rp.id = pa.roster_player_id
    where pa.category_id = _category_id
  ),
  setrows as (
    select m.player_a, m.player_b, s.games_a, s.games_b, s.is_tiebreak
    from public.rr_match m
    join public.rr_match_set s on s.rr_match_id = m.id
    where m.category_id = _category_id
  ),
  perplayer as (
    select p.id as player, p.display_name, p.source,
      (select count(*) from public.rr_match m where m.category_id = _category_id and (m.player_a = p.id or m.player_b = p.id)) as pj,
      (select count(*) from public.rr_match m where m.category_id = _category_id and m.winner = p.id) as pg,
      coalesce((select count(*) from setrows r
        where (r.player_a = p.id and r.games_a > r.games_b) or (r.player_b = p.id and r.games_b > r.games_a)), 0) as sg,
      coalesce((select sum(case when r.player_a = p.id then r.games_a when r.player_b = p.id then r.games_b else 0 end)
        from setrows r where not r.is_tiebreak and (r.player_a = p.id or r.player_b = p.id)), 0) as jg,
      coalesce((select sum(case when r.player_a = p.id then r.games_a when r.player_b = p.id then r.games_b else 0 end)
        from setrows r where r.is_tiebreak and (r.player_a = p.id or r.player_b = p.id)), 0) as st
    from parts p
  ),
  scored as (
    select pp.*, (pp.pg * 1.0 + pp.sg * 0.1 + pp.jg * 0.01 + pp.st * 0.001)::numeric as puntaje
    from perplayer pp
  )
  select sc.player, sc.display_name, sc.source,
    sc.pj::int, sc.pg::int, sc.sg::int, sc.jg::int, sc.st::int, sc.puntaje
  from scored sc
  order by
    sc.pg desc, sc.sg desc, sc.jg desc, sc.st desc,
    -- 5º nivel · DUELO DIRECTO: gana quien venció a los rivales empatados en los 4 niveles.
    (select count(*) from public.rr_match m
       where m.category_id = _category_id and m.winner = sc.player
         and exists (select 1 from scored o
                     where o.player = case when m.player_a = sc.player then m.player_b else m.player_a end
                       and o.pg = sc.pg and o.sg = sc.sg and o.jg = sc.jg and o.st = sc.st)) desc,
    sc.display_name;
$$;
grant execute on function public.round_robin_standings(uuid) to authenticated;

-- 5 · Matriz H2H (los enfrentamientos y su resultado; la N×N se pinta en Fase B).
create or replace function public.round_robin_h2h(_category_id uuid)
returns table (player_a uuid, name_a text, player_b uuid, name_b text, winner uuid, score text)
language sql stable security definer set search_path = public as $$
  select m.player_a, ra.display_name, m.player_b, rb.display_name, m.winner,
    (select string_agg(s.games_a || '-' || s.games_b, ' ' order by s.set_index)
       from public.rr_match_set s where s.rr_match_id = m.id)
  from public.rr_match m
  join public.roster_players ra on ra.id = m.player_a
  join public.roster_players rb on rb.id = m.player_b
  where m.category_id = _category_id
  order by ra.display_name, rb.display_name;
$$;
grant execute on function public.round_robin_h2h(uuid) to authenticated;

-- Lista de participantes (users + invitados) con su vía de inscripción, para la UI.
create or replace function public.round_robin_participants(_category_id uuid)
returns table (roster_player_id uuid, display_name text, email text, phone text, source text, claimed boolean)
language sql stable security definer set search_path = public as $$
  select rp.id, rp.display_name, rp.email, rp.phone, rp.source, rp.claimed_by is not null
  from public.rr_participant pa
  join public.roster_players rp on rp.id = pa.roster_player_id
  where pa.category_id = _category_id
  order by rp.display_name;
$$;
grant execute on function public.round_robin_participants(uuid) to authenticated;

notify pgrst, 'reload schema';
