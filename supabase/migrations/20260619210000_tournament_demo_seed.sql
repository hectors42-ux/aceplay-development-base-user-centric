-- FASE 4.1: seed a demo single-elimination tournament inside the AcePlay Demo Club.
-- One tournament (defaults via tournament_config), one category (its own config = the
-- competitive unit), 8 demo players enrolled, and the bracket generated. Idempotent.

do $$
declare
  _club uuid; _org uuid; _tour uuid; _cat uuid;
  r record;
begin
  select id, organizer_id into _club, _org from public.space where slug = 'demo-club' and type = 'club';
  if _club is null then return; end if;

  -- Tournament container (discoverable via the club's hierarchy visibility).
  select id into _tour from public.space where slug = 'torneo-demo' and parent_space_id = _club;
  if _tour is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('tournament', _club, 'demo_club.torneo_demo', 'Torneo Demo · Pádel', 'torneo-demo',
            'members', 'request', null, _org, 'active')
    returning id into _tour;
    -- Tournament-level DEFAULTS.
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_tour, 'single_elimination', 'manual', 'padel', 'best_of_3', 'puntual', 1.2);
  end if;

  -- Category = the competitive unit; its own config inherits the tournament's and overrides prestige.
  select id into _cat from public.space where slug = 'torneo-demo-open' and parent_space_id = _tour;
  if _cat is null then
    insert into public.space (type, parent_space_id, path, name, slug, visibility, join_policy, sport, organizer_id, status)
    values ('category', _tour, 'demo_club.torneo_demo.open', 'Categoría OPEN', 'torneo-demo-open',
            'members', 'request', 'padel', _org, 'active')
    returning id into _cat;
    insert into public.tournament_config (space_id, motor, agendamiento, disciplina, scoring, ciclo, prestige_mult)
    values (_cat, 'single_elimination', 'manual', 'padel', 'best_of_3', 'puntual', 1.3);  -- override
  end if;

  -- Enroll 8 demo players into the category.
  for r in
    select p.id
    from public.profiles p join auth.users u on u.id = p.id
    where u.email in ('demouser@aceplay.cl','demo01@demo.local','demo02@demo.local','demo03@demo.local',
                      'demo04@demo.local','demo05@demo.local','demo06@demo.local','demo07@demo.local')
  loop
    insert into public.space_membership (player_id, space_id, role, status)
    values (r.id, _cat, 'player'::public.membership_role, 'active')
    on conflict (player_id, space_id) do nothing;
  end loop;

  -- Generate the bracket (seed by global rating, byes to top seeds) if not already generated.
  if not exists (select 1 from public.tournament_bracket where category_id = _cat) then
    perform public._generate_bracket(_cat);
  end if;
end $$;

notify pgrst, 'reload schema';
