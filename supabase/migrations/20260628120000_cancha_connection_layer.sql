-- ============================================================================
-- ÉPICA M · Sección "Cancha" — M1: capa de datos de CONEXIÓN (sin tocar el motor)
-- ----------------------------------------------------------------------------
-- Monta SOBRE el motor existente (rating→nivel, escalerilla, record/confirm,
-- award_xp, grant_fichas). NO lo rehace. Cero tenant_id. Tenis y pádel no se cruzan.
--
-- FIREWALL DE 3 CRUCES (garantía de esta migración):
--   Ninguna RPC de conexión (suggest_partners, post/take_availability,
--   send/respond_challenge, compute_ascension_path, get_public_profile, agenda)
--   ESCRIBE en rating/xp/fichas/escalafón/standings. Solo el flujo de resultado
--   (record_match→confirm_match, motor existente) mueve el rating, tras doble
--   confirmación. El matchmaking SUGIERE; jamás premia.
--
-- Decisiones incorporadas (confirmadas con el founder):
--   1. suggest_opponent_band = helper SOLO LECTURA derivado del rating (banda
--      de win-prob 35–65% ≈ ±108 de rating). Sin motor nuevo, sin tocar Glicko.
--   3. challenges = entidad nueva que SOLO negocia slots (aceptar/rechazar/
--      proponer). Al aceptarse fija agreed_slot + agenda; el partido se MATERIALIZA
--      con record_match en la carga de resultado (M5), enlazando challenges.match_id.
--      challenges nunca calcula resultado ni toca standings.
--   [Addendum A] compute_ascension_path = derivado de SOLO LECTURA del escalafón.
--   [Addendum B] match_agenda arranca SIN torneos (hooks de torneo en stub).
--   [Addendum C] flag_results_pending con fallback ON-READ garantizado (el estado
--      'vencido_sin_resultado' se DERIVA al leer la agenda; no requiere cron).
--   [Addendum D] privacidad de menor REUSA is_minor() (no crea noción propia).
--   [Addendum E] el matchmaking respeta el anti-farming del motor (solo sugiere).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · TABLAS NUEVAS
-- ----------------------------------------------------------------------------

-- Llamado abierto de disponibilidad (reemplazo del grupo de WhatsApp).
create table if not exists public.availability_calls (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  sport       text not null check (sport in ('tennis','padel')),
  slots       jsonb not null default '[]'::jsonb,   -- array de timestamps ISO propuestos
  space_id    uuid references public.space(id) on delete set null,
  scope       text not null default 'zone' check (scope in ('zone','open')),
  note        text,
  status      text not null default 'open' check (status in ('open','taken','expired')),
  taken_by    uuid references public.profiles(id) on delete set null,
  taken_at    timestamptz,
  created_at  timestamptz not null default now()
);

-- Reto entre jugadores: SOLO negociación previa (no resultado, no standings).
create table if not exists public.challenges (
  id             uuid primary key default gen_random_uuid(),
  from_user      uuid not null references public.profiles(id) on delete cascade,
  to_user        uuid not null references public.profiles(id) on delete cascade,
  sport          text not null check (sport in ('tennis','padel')),
  space_id       uuid references public.space(id) on delete set null,  -- LUGAR (club/espacio), NO cancha
  proposed_slots jsonb not null default '[]'::jsonb,                   -- día/hora REFERENCIAL
  status         text not null default 'pending'
                 check (status in ('pending','accepted','rejected','rescheduled')),
  agreed_slot    timestamptz,                                          -- fijado al aceptar
  match_id       uuid references public.matches(id) on delete set null, -- enlazado al cargar resultado (M5)
  note           text,
  source         text not null default 'direct' check (source in ('direct','availability')),
  created_at     timestamptz not null default now(),
  responded_at   timestamptz,
  constraint challenges_distinct_players check (from_user <> to_user)
);

-- Preferencias de privacidad del perfil público. NO define "es menor": eso se
-- deriva de is_minor() (Addendum D) — una sola fuente de verdad.
create table if not exists public.profile_privacy (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  show_record      boolean not null default true,
  show_ranking     boolean not null default true,
  show_streak      boolean not null default true,
  show_spaces      boolean not null default true,
  show_head_to_head boolean not null default true,
  updated_at       timestamptz not null default now()
);

create index if not exists idx_availability_open  on public.availability_calls (sport, status, created_at desc);
create index if not exists idx_availability_user  on public.availability_calls (user_id);
create index if not exists idx_challenges_to       on public.challenges (to_user, status);
create index if not exists idx_challenges_from     on public.challenges (from_user, status);
create index if not exists idx_challenges_agenda   on public.challenges (status, agreed_slot) where match_id is null;

-- ----------------------------------------------------------------------------
-- 2 · RLS (las escrituras pasan por RPCs security-definer; RLS protege acceso directo)
-- ----------------------------------------------------------------------------
alter table public.availability_calls enable row level security;
alter table public.challenges         enable row level security;
alter table public.profile_privacy    enable row level security;

-- availability_calls: el feed es "visible para todos" → SELECT a autenticados.
drop policy if exists availability_select_all on public.availability_calls;
create policy availability_select_all on public.availability_calls for select to authenticated using (true);
drop policy if exists availability_insert_own on public.availability_calls;
create policy availability_insert_own on public.availability_calls for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists availability_update_own on public.availability_calls;
create policy availability_update_own on public.availability_calls for update to authenticated
  using (user_id = auth.uid());

-- challenges: visibles solo para sus participantes.
drop policy if exists challenges_select_participant on public.challenges;
create policy challenges_select_participant on public.challenges for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

-- profile_privacy: cada quien gestiona la suya.
drop policy if exists privacy_select_own on public.profile_privacy;
create policy privacy_select_own on public.profile_privacy for select to authenticated
  using (user_id = auth.uid());
drop policy if exists privacy_upsert_own on public.profile_privacy;
create policy privacy_upsert_own on public.profile_privacy for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists privacy_update_own on public.profile_privacy;
create policy privacy_update_own on public.profile_privacy for update to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3 · ZONA DE JUEGO — helper de SOLO LECTURA (decisión 1)
-- Banda de win-prob 35–65% traducida a rating: E=0.65 ⇒ |Δrating| = 400·log10(0.65/0.35)
-- ≈ 108. Derivado del rating existente; no toca Glicko ni recalcula nada.
-- ----------------------------------------------------------------------------
create or replace function public.zona_rating_bounds(_rating numeric)
returns table (lo numeric, hi numeric)
language sql immutable set search_path = public as $$
  select _rating - 108.0, _rating + 108.0;
$$;

-- ----------------------------------------------------------------------------
-- 4 · suggest_partners — candidatos en Zona, ordenados por match% y cercanía.
-- [Addendum E] SOLO sugiere; no otorga nada. Despioriza (en el ORDEN, no en
-- economía) a rivales muy repetidos en la ventana reciente, para empujar variedad.
-- Proximidad real disponible hoy = "comparte espacio" (no hay comuna/lat-lng).
-- ----------------------------------------------------------------------------
create or replace function public.suggest_partners(_sport text default 'tennis', _limit int default 8)
returns table (
  user_id uuid, name text, avatar_url text, avatar_kind text, avatar_look text,
  nivel numeric, rating numeric, category text,
  match_pct int, shared_space_id uuid, shared_space_name text, recent_meetings int
)
language sql stable security definer set search_path = public as $$
  with sk as (
    select case when _sport = 'padel' then 'padel' else 'tennis' end as sport_key,
           case when _sport = 'padel' then 'doubles' else 'singles' end as fmt
  ),
  me as (
    select pr.rating
    from public.player_ratings pr
    where pr.user_id = auth.uid()
      and pr.sport = (select sport_key from sk) and pr.format = (select fmt from sk)
  ),
  band as (
    select (select rating from me) as r,
           (select lo from public.zona_rating_bounds((select rating from me))) as lo,
           (select hi from public.zona_rating_bounds((select rating from me))) as hi
  )
  -- Subconsulta `q` que NOMBRA las columnas derivadas, para poder ordenar por ellas
  -- (en una función RETURNS TABLE el ORDER BY no ve los nombres de la tabla de salida).
  select q.user_id, q.name, q.avatar_url, q.avatar_kind, q.avatar_look,
         q.nivel, q.rating, q.category, q.match_pct, q.shared_space_id, q.shared_space_name, q.recent_meetings
  from (
    select
      pr.user_id, pf.display_name as name, pf.avatar_url, pf.avatar_kind, pf.avatar_look,
      pr.nivel, pr.rating,
      (select cc.label from public.category_config cc
         where cc.sport = (select sport_key from sk)
           and cc.category_key = public.get_player_category(pr.nivel, (select sport_key from sk)) limit 1) as category,
      -- match%: 100% en rating igual, decae hacia los bordes de la banda (±108).
      greatest(0, least(100, round(100 * (1 - abs(pr.rating - (select r from band)) / 108.0))))::int as match_pct,
      -- proximidad real: ¿comparte algún espacio activo conmigo?
      shared.space_id as shared_space_id, shared.space_name as shared_space_name,
      -- anti-repetición (solo para el ORDEN): partidos contra este rival en 30 días.
      coalesce(rep.cnt, 0)::int as recent_meetings,
      abs(pr.rating - (select r from band)) as closeness
    from public.player_ratings pr
    join public.profiles pf on pf.id = pr.user_id
    left join lateral (
      select s.id as space_id, s.name as space_name
      from public.space_membership m1
      join public.space_membership m2 on m2.space_id = m1.space_id
      join public.space s on s.id = m1.space_id
      where m1.player_id = auth.uid() and m1.status = 'active'
        and m2.player_id = pr.user_id and m2.status = 'active'
        and s.type in ('club','escalerilla')
      order by case s.type when 'escalerilla' then 0 else 1 end
      limit 1
    ) shared on true
    left join lateral (
      select count(*)::int as cnt
      from public.matches mt
      where mt.played_at > now() - interval '30 days'
        and ((auth.uid() = any(mt.side_a) and pr.user_id = any(mt.side_b))
          or (auth.uid() = any(mt.side_b) and pr.user_id = any(mt.side_a)))
    ) rep on true
    where pr.user_id <> auth.uid()
      and pr.sport = (select sport_key from sk) and pr.format = (select fmt from sk)
      and pr.rating between (select lo from band) and (select hi from band)
      and not (public.is_minor(pf) and pf.id <> auth.uid())  -- menores no aparecen en matchmaking público
  ) q
  order by
    q.match_pct desc,
    (q.shared_space_id is not null) desc,   -- mismo espacio primero
    q.recent_meetings asc,                  -- variedad de oponentes
    q.closeness asc
  limit greatest(1, least(50, _limit));
$$;

-- ----------------------------------------------------------------------------
-- 5 · DISPONIBILIDAD: publicar + tomar (first-come ATÓMICO)
-- ----------------------------------------------------------------------------
create or replace function public.post_availability(
  _sport text, _slots jsonb, _space_id uuid default null, _scope text default 'zone', _note text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _id uuid; _sk text;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  _sk := case when _sport = 'padel' then 'padel' else 'tennis' end;
  if coalesce(_scope,'zone') not in ('zone','open') then raise exception 'Alcance inválido'; end if;
  insert into public.availability_calls (user_id, sport, slots, space_id, scope, note)
  values (_uid, _sk, coalesce(_slots,'[]'::jsonb), _space_id, coalesce(_scope,'zone'), _note)
  returning id into _id;
  return _id;
end $$;

-- Tomar un llamado: ATÓMICO (lock de fila) — el primero gana. Crea un challenge
-- 'accepted' (= agenda). Idempotente: rechaza si ya fue tomado. NO premia nada.
create or replace function public.take_availability(_call_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _call public.availability_calls%rowtype; _chid uuid; _slot timestamptz;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  -- Lock de fila: serializa a los que intentan tomar el mismo llamado.
  select * into _call from public.availability_calls where id = _call_id for update;
  if not found then raise exception 'Llamado no encontrado'; end if;
  if _call.status <> 'open' then raise exception 'Este llamado ya fue tomado'; end if;
  if _call.user_id = _uid then raise exception 'No puedes tomar tu propio llamado'; end if;

  update public.availability_calls
     set status = 'taken', taken_by = _uid, taken_at = now()
   where id = _call_id;

  _slot := nullif(_call.slots->>0, '')::timestamptz;  -- primer slot propuesto = acordado
  insert into public.challenges (from_user, to_user, sport, space_id, proposed_slots, status, agreed_slot, source, responded_at)
  values (_call.user_id, _uid, _call.sport, _call.space_id, _call.slots, 'accepted', _slot, 'availability', now())
  returning id into _chid;
  return _chid;
end $$;

-- ----------------------------------------------------------------------------
-- 6 · RETO: enviar + responder (aceptar/rechazar/proponer otro día-hora)
-- ----------------------------------------------------------------------------
create or replace function public.send_challenge(
  _to uuid, _space_id uuid, _slots jsonb, _sport text default 'tennis', _note text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _id uuid; _sk text;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  if _to is null or _to = _uid then raise exception 'Rival inválido'; end if;
  _sk := case when _sport = 'padel' then 'padel' else 'tennis' end;
  insert into public.challenges (from_user, to_user, sport, space_id, proposed_slots, status, note, source)
  values (_uid, _to, _sk, _space_id, coalesce(_slots,'[]'::jsonb), 'pending', _note, 'direct')
  returning id into _id;
  return _id;
end $$;

-- accept = fija agreed_slot + agenda; propose = reabre con nuevos slots; reject = cierra.
-- accept es ATÓMICO (lock de fila): el primero en cerrar gana.
create or replace function public.respond_challenge(
  _challenge_id uuid, _action text, _slot timestamptz default null, _slots jsonb default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _c public.challenges%rowtype; _agreed timestamptz;
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  select * into _c from public.challenges where id = _challenge_id for update;
  if not found then raise exception 'Reto no encontrado'; end if;
  if _uid <> _c.from_user and _uid <> _c.to_user then raise exception 'No participas en este reto'; end if;
  if _c.status not in ('pending','rescheduled') then raise exception 'El reto ya no admite respuesta'; end if;

  if _action = 'accept' then
    _agreed := coalesce(_slot, nullif(_c.proposed_slots->>0, '')::timestamptz);
    update public.challenges
       set status = 'accepted', agreed_slot = _agreed, responded_at = now()
     where id = _challenge_id;
  elsif _action = 'reject' then
    update public.challenges set status = 'rejected', responded_at = now() where id = _challenge_id;
  elsif _action = 'propose' then
    update public.challenges
       set status = 'rescheduled', proposed_slots = coalesce(_slots, _c.proposed_slots), responded_at = now()
     where id = _challenge_id;
  else
    raise exception 'Acción inválida: %', _action;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 7 · [Addendum A] compute_ascension_path — camino de ascenso (SOLO LECTURA)
-- points_needed es EXACTO (del escalafón): puntos de rating hasta el umbral de la
-- categoría siguiente. est_wins es APROXIMADO (estimación de victorias) y SIEMPRE
-- se presenta con "~". No escribe en rating/xp/fichas/escalafón.
-- ----------------------------------------------------------------------------
create or replace function public.compute_ascension_path(_sport text default 'tennis')
returns table (
  current_category_label text, next_category_label text,
  points_needed int, est_wins int, est_basis text, is_maxed boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  _sk text := case when _sport = 'padel' then 'padel' else 'tennis' end;
  _fmt text := case when _sport = 'padel' then 'doubles' else 'singles' end;
  _rating numeric; _nivel numeric; _rd numeric;
  _rank int; _maxrank int; _next_rank int;
  _target_rating numeric; _pts int;
  -- Glicko: ganancia aprox. por victoria vs rival parejo de la Zona (rd_opp ~ 80, E=0.5).
  q   constant numeric := 0.0057564627325;
  pi2 constant numeric := 9.8696044010893586;
  rd_opp constant numeric := 80.0;
  g numeric; d2 numeric; gain numeric; _est int;
  _cur_label text; _next_label text;
begin
  select rating, nivel, rd into _rating, _nivel, _rd
    from public.player_ratings where user_id = auth.uid() and sport = _sk and format = _fmt;
  if _rating is null then
    return query select null::text, null::text, 0, 0, 'sin rating aún'::text, false; return;
  end if;

  select max(rank_order) into _maxrank from public.category_config where sport = _sk;
  _rank := least(greatest(round(_nivel)::int, 1), _maxrank);
  select label into _cur_label from public.category_config where sport = _sk and rank_order = _rank limit 1;

  if _rank >= _maxrank then
    return query select _cur_label, _cur_label, 0, 0, 'ya estás en la categoría más alta'::text, true; return;
  end if;

  _next_rank := _rank + 1;
  select label into _next_label from public.category_config where sport = _sk and rank_order = _next_rank limit 1;

  -- Umbral EXACTO: el nivel mínimo que redondea a la categoría siguiente es (next_rank - 0.5).
  _target_rating := public.nivel_to_rating(_next_rank - 0.5);
  _pts := greatest(0, ceil(_target_rating - _rating))::int;

  -- est_wins APROXIMADO desde la ganancia Glicko por victoria vs rival parejo.
  g    := 1.0 / sqrt(1.0 + 3.0 * q * q * rd_opp * rd_opp / pi2);
  d2   := 1.0 / (q * q * g * g * 0.25);
  gain := (q / (1.0 / (_rd * _rd) + 1.0 / d2)) * g * 0.5;
  _est := greatest(1, least(99, ceil(_pts / greatest(gain, 1.0))))::int;

  return query select _cur_label, _next_label, _pts, _est, 'estimado vs rivales de tu Zona'::text, false;
end $$;

-- ----------------------------------------------------------------------------
-- 8 · [Addendum D] get_public_profile — perfil público con privacidad.
-- La condición de MENOR (is_minor) MANDA sobre las preferencias: un menor nunca
-- expone datos sensibles aunque profile_privacy esté en 'mostrar'.
-- ----------------------------------------------------------------------------
create or replace function public.get_public_profile(_user_id uuid, _sport text default 'tennis')
returns table (
  user_id uuid, name text, avatar_url text, avatar_kind text, avatar_look text,
  is_minor boolean,
  nivel numeric, category text,           -- ranking (gated)
  matches_played int,                      -- record (gated)
  show_record boolean, show_ranking boolean, show_streak boolean,
  show_spaces boolean, show_head_to_head boolean,
  h2h_wins int, h2h_losses int             -- head-to-head con el visitante (gated)
)
language plpgsql stable security definer set search_path = public as $$
declare
  _sk text := case when _sport = 'padel' then 'padel' else 'tennis' end;
  _fmt text := case when _sport = 'padel' then 'doubles' else 'singles' end;
  _p public.profiles%rowtype;
  _minor boolean;
  _sr boolean; _srk boolean; _sst boolean; _ssp boolean; _sh2h boolean;
  _nivel numeric; _cat text; _mc int; _w int; _l int;
begin
  select * into _p from public.profiles where id = _user_id;
  if not found then return; end if;
  _minor := public.is_minor(_p);

  -- Preferencias (default: todo visible si no hay fila). El menor fuerza todo a false.
  select coalesce(pp.show_record,true), coalesce(pp.show_ranking,true), coalesce(pp.show_streak,true),
         coalesce(pp.show_spaces,true), coalesce(pp.show_head_to_head,true)
    into _sr, _srk, _sst, _ssp, _sh2h
    from (select 1) z left join public.profile_privacy pp on pp.user_id = _user_id;
  if _minor then _sr := false; _srk := false; _sst := false; _ssp := false; _sh2h := false; end if;

  select pr.nivel into _nivel from public.player_ratings pr
    where pr.user_id = _user_id and pr.sport = _sk and pr.format = _fmt;
  select cc.label into _cat from public.category_config cc
    where cc.sport = _sk and cc.category_key = public.get_player_category(_nivel, _sk) limit 1;
  select pr.matches_count into _mc from public.player_ratings pr
    where pr.user_id = _user_id and pr.sport = _sk and pr.format = _fmt;

  -- Head-to-head vs el visitante (solo si está permitido y no es menor).
  if _sh2h then
    select
      count(*) filter (where (auth.uid() = any(m.side_a) and m.match_winner='a')
                           or (auth.uid() = any(m.side_b) and m.match_winner='b'))::int,
      count(*) filter (where (auth.uid() = any(m.side_a) and m.match_winner='b')
                           or (auth.uid() = any(m.side_b) and m.match_winner='a'))::int
      into _w, _l
    from public.matches m
    where m.confirmation_status = 'confirmed'
      and ((auth.uid() = any(m.side_a) and _user_id = any(m.side_b))
        or (auth.uid() = any(m.side_b) and _user_id = any(m.side_a)));
  end if;

  return query select
    _p.id, _p.display_name, _p.avatar_url, _p.avatar_kind, _p.avatar_look, _minor,
    case when _srk then _nivel else null end,
    case when _srk then _cat else null end,
    case when _sr then _mc else null end,
    _sr, _srk, _sst, _ssp, _sh2h,
    case when _sh2h then coalesce(_w,0) else null end,
    case when _sh2h then coalesce(_l,0) else null end;
end $$;

-- Upsert de las propias preferencias de privacidad.
create or replace function public.set_profile_privacy(
  _show_record boolean default null, _show_ranking boolean default null, _show_streak boolean default null,
  _show_spaces boolean default null, _show_head_to_head boolean default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'No autenticado'; end if;
  insert into public.profile_privacy as pp (user_id, show_record, show_ranking, show_streak, show_spaces, show_head_to_head)
  values (_uid, coalesce(_show_record,true), coalesce(_show_ranking,true), coalesce(_show_streak,true),
          coalesce(_show_spaces,true), coalesce(_show_head_to_head,true))
  on conflict (user_id) do update set
    show_record       = coalesce(_show_record, pp.show_record),
    show_ranking      = coalesce(_show_ranking, pp.show_ranking),
    show_streak       = coalesce(_show_streak, pp.show_streak),
    show_spaces       = coalesce(_show_spaces, pp.show_spaces),
    show_head_to_head = coalesce(_show_head_to_head, pp.show_head_to_head),
    updated_at        = now();
end $$;

-- ----------------------------------------------------------------------------
-- 9 · [Addendum B] AGENDA — challenges aceptados + retos de escalera. SIN torneos.
-- [Addendum C] El estado 'vencido_sin_resultado' se DERIVA al leer (fallback
-- on-read garantizado): no depende de ningún cron para ser correcto.
-- ----------------------------------------------------------------------------
create or replace function public.get_match_agenda()
returns table (
  kind text, ref_id uuid, opponent_id uuid, opponent_name text,
  opponent_avatar_url text, opponent_avatar_kind text, opponent_avatar_look text,
  sport text, space_id uuid, space_name text, slot timestamptz, state text, match_id uuid
)
language sql stable security definer set search_path = public as $$
  -- Fuente 1: challenges aceptados (flujo nuevo de Cancha).
  select
    'challenge'::text, c.id,
    case when c.from_user = auth.uid() then c.to_user else c.from_user end,
    pf.display_name, pf.avatar_url, pf.avatar_kind, pf.avatar_look,
    c.sport, c.space_id, s.name, c.agreed_slot,
    case
      when c.match_id is not null then 'confirmado'
      when c.agreed_slot is not null and c.agreed_slot < now() then 'vencido_sin_resultado'
      else 'por_jugar'
    end,
    c.match_id
  from public.challenges c
  join public.profiles pf
    on pf.id = case when c.from_user = auth.uid() then c.to_user else c.from_user end
  left join public.space s on s.id = c.space_id
  where c.status = 'accepted'
    and (c.from_user = auth.uid() or c.to_user = auth.uid())

  union all

  -- Fuente 2: retos de escalera (entidad existente) pendientes de confirmar.
  select
    'escalerilla'::text, m.id,
    case when auth.uid() = any(m.side_a) then m.side_b[1] else m.side_a[1] end,
    pf.display_name, pf.avatar_url, pf.avatar_kind, pf.avatar_look,
    m.sport, m.space_id, s.name, m.played_at,
    'por_confirmar'::text, m.id
  from public.matches m
  join public.profiles pf
    on pf.id = case when auth.uid() = any(m.side_a) then m.side_b[1] else m.side_a[1] end
  left join public.space s on s.id = m.space_id
  where m.source_type = 'escalerilla'
    and m.confirmation_status = 'pending'
    and auth.uid() = any(m.side_a || m.side_b)

  -- TODO: sumar partidos de torneo al cablear la vitrina (PENDIENTES.md · pieza 1).
  -- Es aditivo: un UNION ALL más, sin reestructurar esta vista.
  -- Orden por posición (col 11 = slot): en un UNION + RETURNS TABLE el alias de
  -- salida no es referenciable por nombre.
  order by 11 nulls last;
$$;

-- [Addendum C] flag_results_pending: lista los partidos vencidos sin resultado.
-- El estado ya se deriva on-read en get_match_agenda (fallback garantizado, sin
-- cron). Esta función existe para que un scheduler (pg_cron / Edge Function) pueda
-- disparar notificaciones; es de SOLO LECTURA y NO toca el motor.
-- Para activar pg_cron (opcional), cuando esté disponible en el proyecto:
--   select cron.schedule('cancha-overdue','*/20 * * * *',
--     $$ select public.flag_results_pending() $$);
create or replace function public.flag_results_pending()
returns table (challenge_id uuid, from_user uuid, to_user uuid, agreed_slot timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.from_user, c.to_user, c.agreed_slot
  from public.challenges c
  where c.status = 'accepted' and c.match_id is null
    and c.agreed_slot is not null and c.agreed_slot < now();
$$;

-- ----------------------------------------------------------------------------
-- 10 · GRANTS
-- ----------------------------------------------------------------------------
grant execute on function public.zona_rating_bounds(numeric) to authenticated;
grant execute on function public.suggest_partners(text, int) to authenticated;
grant execute on function public.post_availability(text, jsonb, uuid, text, text) to authenticated;
grant execute on function public.take_availability(uuid) to authenticated;
grant execute on function public.send_challenge(uuid, uuid, jsonb, text, text) to authenticated;
grant execute on function public.respond_challenge(uuid, text, timestamptz, jsonb) to authenticated;
grant execute on function public.compute_ascension_path(text) to authenticated;
grant execute on function public.get_public_profile(uuid, text) to authenticated;
grant execute on function public.set_profile_privacy(boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.get_match_agenda() to authenticated;
grant execute on function public.flag_results_pending() to authenticated;

-- Grants de TABLA: RLS solo aplica tras conceder el privilegio al rol. Habilita las
-- lecturas directas del feed/agenda/privacidad (las policies acotan las filas).
-- Las escrituras de challenges siguen siendo exclusivas de las RPCs definer.
grant select, insert, update on public.availability_calls to authenticated;
grant select on public.challenges to authenticated;
grant select, insert, update on public.profile_privacy to authenticated;

notify pgrst, 'reload schema';
