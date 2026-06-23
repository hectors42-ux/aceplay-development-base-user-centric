-- ============================================================================
-- RPCs de la capa de enganche. FIREWALL: ninguna de estas funciones toca
-- player_ratings / rating_history / points_ledger ni llama al motor Glicko
-- (apply_match_to_ratings). Solo leen `matches` (dirección única partido→XP) y
-- escriben en las tablas de XP/liga/misión/racha. Tenis y pádel separados por
-- sport_id. Todos los parámetros vienen de economy_config.
-- ============================================================================

-- Avance de misiones activas que rastrean una acción (mapeo documentado abajo).
-- Si una misión se completa, otorga su reward como una fila propia de xp_ledger
-- (idempotente por ref=mission) — los rewards de misión son hitos y NO pasan por
-- los topes diarios/semanales (intencional).
create or replace function public._advance_missions(_user_id uuid, _sport_id text, _action text)
returns void language plpgsql security definer set search_path = public as $$
declare m record; _prog record; _tracks boolean; _new_prog int;
begin
  for m in select * from public.missions where active = true loop
    _tracks := case m.code
      when 'jugar_semana'     then _action in ('partido_torneo_verificado', 'reto_escalerilla', 'amistoso_confirmado')
      when 'confirmar_semana' then _action = 'confirmar_partido_rival'
      when 'invita_un_amigo'  then _action = 'invitado_activado'
      else false end;
    if not _tracks then continue; end if;

    insert into public.mission_progress (user_id, mission_id, progress)
    values (_user_id, m.id, 0)
    on conflict (user_id, mission_id) do nothing;

    update public.mission_progress
      set progress = progress + 1
      where user_id = _user_id and mission_id = m.id and completed_at is null
      returning progress into _new_prog;

    if _new_prog is not null and _new_prog >= m.target then
      update public.mission_progress set completed_at = now()
        where user_id = _user_id and mission_id = m.id and completed_at is null;
      if found and m.reward_xp > 0 then
        insert into public.xp_ledger (user_id, sport_id, action, base_xp, weight, final_xp, ref_type, ref_id)
        values (_user_id, _sport_id, 'mission_reward', m.reward_xp, 1.0, m.reward_xp, 'mission', m.id::text)
        on conflict (user_id, action, ref_type, ref_id) where ref_id is not null do nothing;
        update public.league_members lm set xp_week = lm.xp_week + m.reward_xp
        from public.leagues l
        where l.id = lm.league_id and lm.user_id = _user_id and l.sport_id = _sport_id and l.status = 'active';
      end if;
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- award_xp: aplica peso + anti-gaming + topes, inserta en xp_ledger, actualiza
-- liga y misiones. Idempotente por (user, action, ref). Devuelve el XP otorgado.
-- ----------------------------------------------------------------------------
create or replace function public.award_xp(_user_id uuid, _sport_id text, _action text, _ref_type text default null, _ref_id text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  _faucet jsonb; _ag jsonb; _a jsonb;
  _base int; _weight numeric; _once boolean;
  _decay numeric; _window int; _daily_cap int; _weekly_cap int;
  _final int; _factor numeric := 1.0;
  _opp uuid; _repeat_count int := 0;
  _day_spent int; _week_spent int;
  _wk date := date_trunc('week', now())::date;
begin
  if _user_id is null or _sport_id is null or _action is null then return 0; end if;

  -- Idempotencia por ref: un (user, action, ref) se otorga una sola vez.
  if _ref_id is not null and exists (
    select 1 from public.xp_ledger
    where user_id = _user_id and action = _action and ref_type is not distinct from _ref_type and ref_id = _ref_id
  ) then return 0; end if;

  select value into _faucet from public.economy_config where key = 'xp_faucet';
  _a := _faucet -> _action;
  if _a is null then return 0; end if;  -- acción fuera del faucet → 0 XP
  _base := (_a->>'base')::int;
  _weight := coalesce((_a->>'weight')::numeric, 1.0);
  _once := coalesce((_a->>'once')::boolean, false);

  -- Acciones "once" (p.ej. perfil+calibración): una sola vez por usuario.
  if _once and exists (select 1 from public.xp_ledger where user_id = _user_id and action = _action) then
    return 0;
  end if;

  select value into _ag from public.economy_config where key = 'xp_anti_gaming';
  _decay := coalesce((_ag->>'repeat_decay')::numeric, 0.5);
  _window := coalesce((_ag->>'repeat_window_days')::int, 7);
  _daily_cap := coalesce((_ag->>'daily_cap_per_action')::int, 600);
  _weekly_cap := coalesce((_ag->>'weekly_cap_total')::int, 3000);

  -- Retornos DECRECIENTES vs el MISMO rival (protege la densidad del dato:
  -- repetir partidos con el mismo amigo rinde cada vez menos XP).
  if _ref_type = 'match' and _ref_id is not null then
    select case when _user_id = any(m.side_a) then m.side_b[1] else m.side_a[1] end
      into _opp from public.matches m where m.id = _ref_id::uuid;
    if _opp is not null then
      select count(*) into _repeat_count
      from public.xp_ledger xl
      join public.matches m2 on m2.id = xl.ref_id::uuid
      where xl.user_id = _user_id and xl.action = _action and xl.ref_type = 'match'
        and xl.created_at > now() - (_window || ' days')::interval
        and (_opp = any(m2.side_a) or _opp = any(m2.side_b));
      _factor := power(_decay, _repeat_count);
    end if;
  end if;

  _final := floor(_base * _weight * _factor)::int;

  -- Tope POR ACCIÓN / DÍA (protege grindear una sola acción).
  select coalesce(sum(final_xp), 0) into _day_spent
    from public.xp_ledger where user_id = _user_id and action = _action and created_at::date = now()::date;
  _final := least(_final, greatest(0, _daily_cap - _day_spent));

  -- Tope TOTAL / SEMANA.
  select coalesce(sum(final_xp), 0) into _week_spent
    from public.xp_ledger where user_id = _user_id and created_at >= _wk;
  _final := least(_final, greatest(0, _weekly_cap - _week_spent));

  if _final <= 0 then return 0; end if;

  insert into public.xp_ledger (user_id, sport_id, action, base_xp, weight, final_xp, ref_type, ref_id)
  values (_user_id, _sport_id, _action, _base, _weight, _final, _ref_type, _ref_id);

  -- Liga activa del usuario para ese deporte (no-op si no está en ninguna).
  update public.league_members lm set xp_week = lm.xp_week + _final
  from public.leagues l
  where l.id = lm.league_id and lm.user_id = _user_id and l.sport_id = _sport_id and l.status = 'active';

  perform public._advance_missions(_user_id, _sport_id, _action);
  return _final;
end $$;

-- ----------------------------------------------------------------------------
-- touch_streak: racha SEMANAL por deporte. Consume un freeze si se perdió
-- exactamente una semana y hay freezes; si el hueco es mayor, reinicia.
-- ----------------------------------------------------------------------------
create or replace function public.touch_streak(_user_id uuid, _sport_id text)
returns void language plpgsql security definer set search_path = public as $$
declare s public.streaks%rowtype; _wk date := date_trunc('week', now())::date; _prev date := (date_trunc('week', now()) - interval '7 days')::date; _cfg jsonb; _freezes int;
begin
  select value into _cfg from public.economy_config where key = 'streak';
  _freezes := coalesce((_cfg->>'freezes_default')::int, 2);
  select * into s from public.streaks where user_id = _user_id and sport_id = _sport_id;
  if not found then
    insert into public.streaks (user_id, sport_id, current_weeks, longest_weeks, last_active_week, freezes_available)
    values (_user_id, _sport_id, 1, 1, _wk, _freezes);
    return;
  end if;
  if s.last_active_week = _wk then
    return;  -- ya activo esta semana
  elsif s.last_active_week = _prev then
    update public.streaks set current_weeks = s.current_weeks + 1,
      longest_weeks = greatest(s.longest_weeks, s.current_weeks + 1), last_active_week = _wk, updated_at = now()
      where user_id = _user_id and sport_id = _sport_id;
  elsif s.last_active_week = (_prev - interval '7 days')::date and s.freezes_available > 0 then
    -- exactamente una semana perdida + hay freeze → mantener racha, consumir freeze.
    update public.streaks set current_weeks = s.current_weeks + 1,
      longest_weeks = greatest(s.longest_weeks, s.current_weeks + 1), last_active_week = _wk,
      freezes_available = s.freezes_available - 1, updated_at = now()
      where user_id = _user_id and sport_id = _sport_id;
  else
    update public.streaks set current_weeks = 1, last_active_week = _wk, updated_at = now()
      where user_id = _user_id and sport_id = _sport_id;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- close_league_week: cierra la semana, calcula ascensos/descensos y abre la
-- siguiente. Reagrupa por tier en ligas del tamaño de config. xp_week vuelve a 0.
-- ----------------------------------------------------------------------------
create or replace function public.close_league_week(_sport_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  _cfg jsonb; _promote int; _relegate int; _size int; _max_tier int;
  _ns date := (date_trunc('week', now()) + interval '7 days')::date;
  _ne date := (date_trunc('week', now()) + interval '13 days')::date;
  r record; _tier int; _league uuid; _i int; _prev_tier int := -1; _count int := 0;
begin
  select value into _cfg from public.economy_config where key = 'league';
  _promote := coalesce((_cfg->>'promote')::int, 7);
  _relegate := coalesce((_cfg->>'relegate')::int, 7);
  _size := coalesce((_cfg->>'size')::int, 30);
  _max_tier := coalesce(jsonb_array_length(_cfg->'tiers'), 5);

  -- 1) Rankear y marcar movimiento dentro de cada liga activa, luego cerrarla.
  update public.league_members lm
    set rank = r.rn,
        movement = case when r.rn <= _promote then 'promoted'
                        when r.rn > r.total - _relegate then 'relegated'
                        else 'same' end
  from (
    select lm2.id, row_number() over (partition by lm2.league_id order by lm2.xp_week desc) rn,
           count(*) over (partition by lm2.league_id) total
    from public.league_members lm2
    join public.leagues l2 on l2.id = lm2.league_id
    where l2.sport_id = _sport_id and l2.status = 'active'
  ) r
  where r.id = lm.id;

  update public.leagues set status = 'closed' where sport_id = _sport_id and status = 'active';

  -- 2) Reagrupar a todos por su nuevo tier (clamp [1, max]) en ligas nuevas.
  for r in
    select lm.user_id,
      least(_max_tier, greatest(1,
        l.tier + case lm.movement when 'promoted' then 1 when 'relegated' then -1 else 0 end)) as new_tier
    from public.league_members lm
    join public.leagues l on l.id = lm.league_id
    where l.sport_id = _sport_id and l.status = 'closed' and l.week_end < _ns
    order by new_tier, lm.user_id
  loop
    if r.new_tier <> _prev_tier or _count >= _size then
      insert into public.leagues (sport_id, tier, week_start, week_end, status)
      values (_sport_id, r.new_tier, _ns, _ne, 'active') returning id into _league;
      _prev_tier := r.new_tier; _count := 0;
    end if;
    insert into public.league_members (league_id, user_id, xp_week)
    values (_league, r.user_id, 0) on conflict (league_id, user_id) do nothing;
    _count := _count + 1;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Trigger ADITIVO: al confirmarse un partido, otorga XP (separado por sport) y
-- toca la racha. NO toca rating: solo invoca award_xp/touch_streak. Convive con
-- el trigger del motor (trg_match_confirmed) sin modificarlo.
-- ----------------------------------------------------------------------------
create or replace function public._award_xp_on_match_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
declare _action text; _p uuid; _confirmer uuid := auth.uid();
begin
  if new.confirmation_status = 'confirmed'
     and (tg_op = 'INSERT' or coalesce(old.confirmation_status, '') <> 'confirmed') then
    _action := case new.source_type
      when 'tournament' then 'partido_torneo_verificado'
      when 'escalerilla' then 'reto_escalerilla'
      else 'amistoso_confirmado' end;
    foreach _p in array (coalesce(new.side_a, '{}'::uuid[]) || coalesce(new.side_b, '{}'::uuid[])) loop
      perform public.award_xp(_p, new.sport, _action, 'match', new.id::text);
      perform public.touch_streak(_p, new.sport);
    end loop;
    if _confirmer is not null and (_confirmer = any(new.side_a) or _confirmer = any(new.side_b)) then
      perform public.award_xp(_confirmer, new.sport, 'confirmar_partido_rival', 'match_confirm', new.id::text);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_award_xp_on_match on public.matches;
create trigger trg_award_xp_on_match
  after insert or update of confirmation_status on public.matches
  for each row execute function public._award_xp_on_match_confirm();

grant execute on function public.award_xp(uuid, text, text, text, text) to authenticated;
grant execute on function public.touch_streak(uuid, text) to authenticated;
-- close_league_week es operación de admin/cron: NO se concede a authenticated.

notify pgrst, 'reload schema';
