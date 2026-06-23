-- Seed demo de la capa de Premio: 3 marcas, 6 premios con beneficios variados
-- (texto, SIN precios) y stock, y un saldo de Fichas para demouser. Idempotente.

insert into public.brands (name, slug, active) values
  ('Wilson', 'wilson', true),
  ('Head', 'head', true),
  ('Babolat', 'babolat', true)
on conflict (slug) do nothing;

do $$
declare _wilson uuid; _head uuid; _babolat uuid; _demo uuid;
begin
  select id into _wilson from public.brands where slug = 'wilson';
  select id into _head from public.brands where slug = 'head';
  select id into _babolat from public.brands where slug = 'babolat';

  if not exists (select 1 from public.reward_items) then
    insert into public.reward_items (brand_id, title, benefit_label, cost_fichas, stock, terms, sport_scope) values
      (_wilson,  'Descuento en raquetas',  '20% en Wilson',            120, null, 'Válido en tienda oficial Wilson. Un uso por código.', null),
      (_wilson,  'Tubo de pelotas',        'Tubo de pelotas Wilson',    60, 10,   'Retira en el club asociado presentando el código.',   null),
      (_head,    'Descuento en accesorios','15% en Head',                90, null, 'No acumulable con otras promociones.',                 null),
      (_head,    'Pack de grips',          'Grips Head x3',              40, 20,   'Sujeto a disponibilidad en tienda.',                  null),
      (_babolat, 'Descuento en línea',     '10% en Babolat',             70, null, 'Aplica a productos seleccionados.',                   'padel'),
      (_babolat, 'Bolso de viaje',         'Bolso Babolat con beneficio',150, 5,    'Hasta agotar stock.',                                 null);
  end if;

  -- demouser parte con saldo suficiente para 1-2 canjes.
  select id into _demo from auth.users where email = 'demouser@aceplay.cl';
  if _demo is not null then
    perform public.grant_fichas(_demo, 300, 'seed', 'seed', 'demo-balance');
  end if;
end $$;

notify pgrst, 'reload schema';
