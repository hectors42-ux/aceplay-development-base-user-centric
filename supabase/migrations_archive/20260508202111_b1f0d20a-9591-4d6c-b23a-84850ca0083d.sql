
DELETE FROM tournament_matches WHERE id='aaaaaaaa-1111-4111-aaaa-dddddddddd04';

INSERT INTO tournament_registrations (id, tournament_id, category_id, player1_user_id, status, tenant_id)
SELECT 'aaaaaaaa-1111-4111-aaaa-bbbbbbbbbb06', 'aaaaaaaa-1111-4111-aaaa-aaaaaaaaaa01', 'aaaaaaaa-1111-4111-aaaa-cccccccccc01',
       '33a40462-76f8-4126-8cf3-fdf543fe4dc0', 'confirmada', tenant_id
FROM tournaments WHERE id='aaaaaaaa-1111-4111-aaaa-aaaaaaaaaa01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO tournament_matches (id, tournament_id, category_id, round, bracket_position, status, scheduled_at, registration_a_id, registration_b_id, tenant_id)
SELECT 'aaaaaaaa-1111-4111-aaaa-dddddddddd05', 'aaaaaaaa-1111-4111-aaaa-aaaaaaaaaa01', 'aaaaaaaa-1111-4111-aaaa-cccccccccc01',
       3, 99, 'pendiente', now() - interval '2 days',
       'aaaaaaaa-1111-4111-aaaa-bbbbbbbbbb04', 'aaaaaaaa-1111-4111-aaaa-bbbbbbbbbb06', tenant_id
FROM tournaments WHERE id='aaaaaaaa-1111-4111-aaaa-aaaaaaaaaa01'
ON CONFLICT (id) DO NOTHING;
