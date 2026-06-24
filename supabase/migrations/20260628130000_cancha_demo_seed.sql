-- ============================================================================
-- ÉPICA M · Cancha — M1 seed demo (idempotente).
-- Pone la sección "viva" para demouser: llamados de disponibilidad (uno propio),
-- retos (1 recibido pending, 1 enviado pending) y 1 partido en agenda
-- 'vencido_sin_resultado' (agreed_slot en el pasado, sin match cargado).
-- NO toca rating/xp/fichas: solo availability_calls + challenges.
-- Deporte = tennis (el primario de demouser).
-- ============================================================================
do $$
declare
  _me uuid; _p1 uuid; _p2 uuid; _p3 uuid; _p4 uuid;
begin
  select id into _me from auth.users where email = 'demouser@aceplay.cl';
  if _me is null then return; end if;
  select id into _p1 from auth.users where email = 'demo01@demo.local';
  select id into _p2 from auth.users where email = 'demo02@demo.local';
  select id into _p3 from auth.users where email = 'demo03@demo.local';
  select id into _p4 from auth.users where email = 'demo04@demo.local';

  -- Guarda de idempotencia: si demouser ya tiene datos de Cancha, no re-sembrar.
  if exists (select 1 from public.challenges where from_user = _me or to_user = _me)
     or exists (select 1 from public.availability_calls where user_id = _me) then
    return;
  end if;

  -- ---- Llamados de disponibilidad (feed) -----------------------------------
  -- Uno propio (de demouser), abierto a la Zona.
  insert into public.availability_calls (user_id, sport, slots, scope, note, status)
  values (_me, 'tennis',
          jsonb_build_array((now() + interval '2 days' + interval '18 hours')::text,
                            (now() + interval '3 days' + interval '19 hours')::text),
          'zone', 'Busco singles parejo, nivel Honor/Primera.', 'open');

  -- Algunos de otros jugadores (visibles para todos).
  if _p1 is not null then
    insert into public.availability_calls (user_id, sport, slots, scope, note, status)
    values (_p1, 'tennis', jsonb_build_array((now() + interval '1 day' + interval '20 hours')::text),
            'open', 'Cancha disponible, ¿alguien para un set?', 'open');
  end if;
  if _p2 is not null then
    insert into public.availability_calls (user_id, sport, slots, scope, note, status)
    values (_p2, 'tennis', jsonb_build_array((now() + interval '4 days' + interval '08 hours')::text),
            'zone', 'Mañana de sábado.', 'open');
  end if;
  if _p3 is not null then
    insert into public.availability_calls (user_id, sport, slots, scope, note, status)
    values (_p3, 'tennis', jsonb_build_array((now() + interval '2 days' + interval '07 hours')::text),
            'open', 'Antes del trabajo.', 'open');
  end if;

  -- ---- Retos ----------------------------------------------------------------
  -- 1 recibido (demo01 → demouser), pendiente de respuesta.
  if _p1 is not null then
    insert into public.challenges (from_user, to_user, sport, proposed_slots, status, note, source)
    values (_p1, _me, 'tennis',
            jsonb_build_array((now() + interval '5 days' + interval '19 hours')::text,
                              (now() + interval '6 days' + interval '10 hours')::text),
            'pending', 'Te debo la revancha 😏', 'direct');
  end if;

  -- 1 enviado (demouser → demo02), pendiente.
  if _p2 is not null then
    insert into public.challenges (from_user, to_user, sport, proposed_slots, status, source)
    values (_me, _p2, 'tennis',
            jsonb_build_array((now() + interval '3 days' + interval '18 hours')::text),
            'pending', 'direct');
  end if;

  -- ---- Agenda: 1 partido acordado VENCIDO sin resultado --------------------
  -- agreed_slot en el pasado + match_id null ⇒ get_match_agenda lo deriva como
  -- 'vencido_sin_resultado' (sin cron, fallback on-read).
  if _p4 is not null then
    insert into public.challenges (from_user, to_user, sport, proposed_slots, status, agreed_slot, source, responded_at)
    values (_me, _p4, 'tennis',
            jsonb_build_array((now() - interval '2 days' + interval '19 hours')::text),
            'accepted', (now() - interval '2 days' + interval '19 hours'), 'direct', now() - interval '3 days');
  end if;
end $$;

notify pgrst, 'reload schema';
