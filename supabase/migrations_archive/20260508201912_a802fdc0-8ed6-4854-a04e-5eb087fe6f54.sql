
INSERT INTO tournament_registrations (id, tournament_id, category_id, player1_user_id, status, tenant_id)
SELECT 'aaaaaaaa-1111-4111-aaaa-bbbbbbbbbb05', 'aaaaaaaa-1111-4111-aaaa-aaaaaaaaaa01', 'aaaaaaaa-1111-4111-aaaa-cccccccccc01',
       '6941983e-5b48-4253-bff8-74a46dc7a538', 'confirmada', tenant_id
FROM tournaments WHERE id='aaaaaaaa-1111-4111-aaaa-aaaaaaaaaa01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO tournament_matches (id, tournament_id, category_id, round, bracket_position, status, scheduled_at, registration_a_id, registration_b_id, tenant_id)
SELECT 'aaaaaaaa-1111-4111-aaaa-dddddddddd04', 'aaaaaaaa-1111-4111-aaaa-aaaaaaaaaa01', 'aaaaaaaa-1111-4111-aaaa-cccccccccc01',
       3, 99, 'pendiente', now() - interval '2 days',
       'aaaaaaaa-1111-4111-aaaa-bbbbbbbbbb03', 'aaaaaaaa-1111-4111-aaaa-bbbbbbbbbb05', tenant_id
FROM tournaments WHERE id='aaaaaaaa-1111-4111-aaaa-aaaaaaaaaa01'
ON CONFLICT (id) DO NOTHING;
