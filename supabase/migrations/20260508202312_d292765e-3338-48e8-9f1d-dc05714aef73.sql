
INSERT INTO tournament_matches (id, tournament_id, category_id, round, bracket_position, status, scheduled_at, registration_a_id, registration_b_id, tenant_id, acceptance_a, acceptance_b)
SELECT 'aaaaaaaa-1111-4111-aaaa-dddddddddd06', 'aaaaaaaa-1111-4111-aaaa-aaaaaaaaaa01', 'aaaaaaaa-1111-4111-aaaa-cccccccccc01',
       2, 50, 'programado', now() + interval '3 days',
       'aaaaaaaa-1111-4111-aaaa-bbbbbbbbbb02', 'aaaaaaaa-1111-4111-aaaa-bbbbbbbbbb05', tenant_id,
       'accepted', 'accepted'
FROM tournaments WHERE id='aaaaaaaa-1111-4111-aaaa-aaaaaaaaaa01'
ON CONFLICT (id) DO NOTHING;
