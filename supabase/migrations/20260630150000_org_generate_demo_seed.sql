-- ============================================================================
-- SEED B.1 · Escenario de prueba para "Generar llave" como organizador.
-- "Torneo Gestión Demo" en AcePlay Demo Club, organizer = demouser, con DOS
-- categorías del motor vivo SIN llave generada (single_elimination + round_robin),
-- cada una con 4 inscritos (space_membership). Así demouser puede probar el botón
-- "Generar llave" de punta a punta (un formato de bracket + un round-robin del motor).
-- Idempotente.
-- ============================================================================
do $$
declare
  _club uuid; _me uuid; _tour uuid; _cat_se uuid; _cat_rr uuid;
  _members uuid[]; _u uuid;
begin
  select id into _club from public.space where slug = 'demo-club' and type = 'club';
  select id into _me from auth.users where email = 'demouser@aceplay.cl';
  if _club is null or _me is null then return; end if;

  -- inscritos: demouser + 3 demo users.
  select array_agg(p.id) into _members
  from public.profiles p join auth.users u on u.id = p.id
  where u.email in ('demouser@aceplay.cl', 'demo01@demo.local', 'demo03@demo.local', 'demo05@demo.local');
  if coalesce(array_length(_members, 1), 0) < 2 then return; end if;

  -- torneo (organizer = demouser para que pueda gestionar).
  select id into _tour from public.space where slug = 'torneo-gestion-demo' and parent_space_id = _club;
  if _tour is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('tournament', _club, 'demo_club.gestion_demo', 'Torneo Gestión Demo', 'torneo-gestion-demo',
            'hierarchy', 'request', null, _me, 'active')
    returning id into _tour;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_tour, 'single_elimination', 'manual', 'tennis', 'best_of_3', 'puntual', 1.0);
  end if;

  -- categoría single_elimination (sin llave).
  select id into _cat_se from public.space where slug = 'cat-gestion-se' and parent_space_id = _tour;
  if _cat_se is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('category', _tour, 'demo_club.gestion_demo.se', 'Eliminación · Demo', 'cat-gestion-se',
            'hierarchy', 'request', 'tennis', _me, 'active')
    returning id into _cat_se;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_cat_se, 'single_elimination', 'manual', 'tennis', 'best_of_3', 'puntual', 1.0);
    foreach _u in array _members loop
      insert into public.space_membership (player_id, space_id, role, status)
      values (_u, _cat_se, 'player'::public.membership_role, 'active')
      on conflict (player_id, space_id) do nothing;
    end loop;
  end if;

  -- categoría round_robin del MOTOR (space_membership), sin llave.
  select id into _cat_rr from public.space where slug = 'cat-gestion-rr' and parent_space_id = _tour;
  if _cat_rr is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('category', _tour, 'demo_club.gestion_demo.rr', 'Round Robin · Demo', 'cat-gestion-rr',
            'hierarchy', 'request', 'tennis', _me, 'active')
    returning id into _cat_rr;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_cat_rr, 'round_robin', 'manual', 'tennis', 'best_of_3', 'puntual', 1.0);
    foreach _u in array _members loop
      insert into public.space_membership (player_id, space_id, role, status)
      values (_u, _cat_rr, 'player'::public.membership_role, 'active')
      on conflict (player_id, space_id) do nothing;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';
