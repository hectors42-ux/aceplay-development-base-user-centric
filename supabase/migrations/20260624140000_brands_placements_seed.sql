-- Seed Épica C: una marca CLUB-SPONSOR (financiada por el club, no por AcePlay)
-- + placements con distintas prioridades para ver prioridad pagada y rotación.
-- (Wilson/Head/Babolat ya existen de la Épica B como marcas de producto.)
do $$
declare _club_norte uuid; _bclub uuid; _wilson uuid; _head uuid; _babolat uuid;
begin
  select id into _club_norte from public.space where slug = 'club-norte' and type = 'club';
  select id into _wilson from public.brands where slug = 'wilson';
  select id into _head from public.brands where slug = 'head';
  select id into _babolat from public.brands where slug = 'babolat';

  -- Marca club-sponsor: el inventario lo financia el club (club_id), no AcePlay.
  insert into public.brands (name, slug, status, club_id, contact)
  values ('Club Norte', 'club-norte-sponsor', 'active', _club_norte, jsonb_build_object('owner', 'club-norte'))
  on conflict (slug) do nothing;
  select id into _bclub from public.brands where slug = 'club-norte-sponsor';

  -- Un premio financiado por el club (entra como inventario del club-sponsor).
  if _bclub is not null and not exists (select 1 from public.reward_items where brand_id = _bclub) then
    insert into public.reward_items (brand_id, title, benefit_label, cost_fichas, stock, terms, sport_scope)
    values (_bclub, 'Beneficio del club', 'Tubo de pelotas en Club Norte', 50, 10, 'Retira en Club Norte con tu código. Financiado por el club.', null);
  end if;

  if not exists (select 1 from public.sponsor_placements) then
    insert into public.sponsor_placements (brand_id, scope, ref_id, slot, priority, paid_priority, weight, active) values
      -- HOME: Wilson con prioridad PAGADA gana sobre Head.
      (_wilson,  'home',     null, 'default', 0, true,  5, true),
      (_head,    'home',     null, 'default', 0, false, 3, true),
      -- DISCOVER: Babolat y Head EMPATAN (mismo peso, sin pago) → rotación por ventana.
      (_babolat, 'discover', null, 'default', 0, false, 5, true),
      (_head,    'discover', null, 'default', 0, false, 5, true),
      -- TOURNAMENT: el club-sponsor presente de forma global.
      (_bclub,   'tournament', null, 'default', 0, false, 4, true);
  end if;
end $$;

notify pgrst, 'reload schema';
