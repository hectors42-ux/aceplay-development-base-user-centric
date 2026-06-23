-- Seed demo de la capa de enganche: 3 misiones, catálogo de insignias, 1 liga
-- de pádel ACTIVA con 12 usuarios y xp_week variado, rachas mixtas, algo de
-- progreso de misión e insignias para demouser. Idempotente.

-- Misiones (códigos que award_xp ya sabe rastrear).
insert into public.missions (code, title, target, reward_xp, period, active) values
  ('jugar_semana',     'Juega 3 partidos esta semana',     3, 100, 'weekly', true),
  ('confirmar_semana', 'Confirma 2 resultados de rivales',  2,  40, 'weekly', true),
  ('invita_un_amigo',  'Invita a 1 jugador nuevo',          1, 200, 'weekly', true)
on conflict (code) do nothing;

-- Catálogo de insignias.
insert into public.badges (code, title, description, icon) values
  ('first_win', 'Primera victoria', 'Ganaste tu primer partido confirmado', 'trophy'),
  ('streak_4',  'Racha de 4',       '4 semanas seguidas en cancha',          'flame'),
  ('social',    'Conector',         'Invitaste a un jugador nuevo a la red',  'users')
on conflict (code) do nothing;

do $$
declare
  _league uuid;
  _wk date := date_trunc('week', now())::date;
  _we date := (date_trunc('week', now()) + interval '6 days')::date;
  _emails text[] := array['demouser@aceplay.cl','demo01@demo.local','demo02@demo.local','demo03@demo.local',
                          'demo04@demo.local','demo05@demo.local','demo06@demo.local','demo07@demo.local',
                          'demo08@demo.local','demo09@demo.local','demo10@demo.local','demo11@demo.local'];
  _xps int[] := array[860, 740, 690, 620, 560, 505, 430, 360, 300, 240, 170, 80];
  _streakW int[] := array[6, 4, 0, 2, 9, 1, 0, 3, 5, 0, 1, 2];
  _i int; _uid uuid; _did uuid; _bid uuid;
begin
  if exists (select 1 from public.leagues where sport_id = 'padel' and status = 'active') then
    return;  -- ya sembrada
  end if;

  insert into public.leagues (sport_id, tier, week_start, week_end, status)
  values ('padel', 2, _wk, _we, 'active') returning id into _league;

  for _i in 1 .. array_length(_emails, 1) loop
    select id into _uid from auth.users where email = _emails[_i];
    if _uid is null then continue; end if;
    insert into public.league_members (league_id, user_id, xp_week)
    values (_league, _uid, _xps[_i]) on conflict (league_id, user_id) do nothing;
    -- Racha mixta por deporte pádel.
    insert into public.streaks (user_id, sport_id, current_weeks, longest_weeks, last_active_week, freezes_available)
    values (_uid, 'padel', _streakW[_i], greatest(_streakW[_i], 4), case when _streakW[_i] > 0 then _wk else null end, 2)
    on conflict (user_id, sport_id) do update set current_weeks = excluded.current_weeks,
      longest_weeks = excluded.longest_weeks, last_active_week = excluded.last_active_week;
  end loop;

  -- Rank inicial por xp_week (para mostrar tabla antes del primer cierre).
  update public.league_members lm set rank = r.rn
  from (select id, row_number() over (order by xp_week desc) rn from public.league_members where league_id = _league) r
  where r.id = lm.id;

  -- demouser: progreso de misión + un par de insignias (estado "vivo" en el home).
  select id into _did from auth.users where email = 'demouser@aceplay.cl';
  if _did is not null then
    insert into public.mission_progress (user_id, mission_id, progress)
      select _did, m.id, 2 from public.missions m where m.code = 'jugar_semana'
      on conflict (user_id, mission_id) do nothing;
    insert into public.mission_progress (user_id, mission_id, progress, completed_at)
      select _did, m.id, m.target, now() from public.missions m where m.code = 'confirmar_semana'
      on conflict (user_id, mission_id) do nothing;
    for _bid in select id from public.badges where code in ('first_win', 'streak_4') loop
      insert into public.user_badges (user_id, badge_id) values (_did, _bid) on conflict (user_id, badge_id) do nothing;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';
