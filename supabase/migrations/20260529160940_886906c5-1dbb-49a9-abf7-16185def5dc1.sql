INSERT INTO public.courts (tenant_id, name, surface, sport, is_indoor, slot_minutes, opens_at, closes_at, sort_order, is_active)
VALUES ('ad61e9b5-2107-4b44-b9d6-f87ebd41ec1d', 'Pádel 1', 'arcilla', 'padel', false, 90, '08:00', '23:00', 100, true)
ON CONFLICT DO NOTHING;