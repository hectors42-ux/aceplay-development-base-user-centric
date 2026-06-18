#!/usr/bin/env bash
# E2E completo de La Pirámide Pádel — Fase 3 del plan de integración pádel.
#
# Simula el ciclo completo de un desafío de dobles:
#   1. Demo (#4) reta a Héctor (#2) eligiendo a Antoine como compañero
#   2. Héctor acepta un slot y elige a Lucas como compañero
#   3. Demo carga el resultado (pareja Demo/Antoine gana 6-4 6-3)
#   4. Héctor confirma el resultado
#   5. Validamos: swap solo entre Demo y Héctor, partners quedan en su lugar,
#      ELO actualizado para los 4 jugadores en player_ratings(sport='padel')
#
# Cada acción corre en una transacción aparte seteando request.jwt.claims
# para reproducir auth.uid() del usuario que actúa.
set -euo pipefail

LADDER=ef5be00b-b833-4027-b2b3-eb8fdc9bb63c
DEMO=e1b1724e-71f4-455b-9482-350ef950fdc8     # #4
HECTOR=afdfa252-f446-435b-bbf2-237f4da03376   # #2
ANTOINE=e817e629-ac4f-4f17-be8e-13eed3928072  # #5 (partner de Demo)
LUCAS=ccd4a6d9-9216-40fa-a4c3-3bb49839b9de    # #6 (partner de Héctor)
BRUNO=e04b6339-6dbc-4bec-9656-9740d4b77dbf    # #1 (no debe moverse)
CAMILLE=d8162e3e-3928-4de5-a97e-8a32a8ded2af  # #3 (no debe moverse)

step() { echo; echo "─── $* ───"; }

as_user() {
  # $1 = uuid, resto = SQL
  local uid="$1"; shift
  psql -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub','$uid','role','authenticated')::text, true);
$*
COMMIT;
SQL
}

step "0. Estado inicial"
psql -c "SELECT position, p.first_name FROM ladder_positions lp JOIN profiles p ON p.user_id=lp.user_id WHERE ladder_id='$LADDER' ORDER BY position"

# Capturar ELO inicial (rating o 1500 default)
psql -c "
WITH players(uid,name) AS (VALUES
 ('$DEMO'::uuid,'Demo'),('$HECTOR'::uuid,'Héctor'),
 ('$ANTOINE'::uuid,'Antoine'),('$LUCAS'::uuid,'Lucas'))
SELECT p.name, COALESCE(pr.level,1500) AS level_antes, COALESCE(pr.matches_played,0) AS partidos
FROM players p LEFT JOIN player_ratings pr ON pr.user_id=p.uid AND pr.sport='padel'
ORDER BY p.name"

step "0.1 Reset del ladder pádel (idempotente)"
psql -c "SELECT public._e2e_reset_padel_ladder()"

step "1. Demo (#4) reta a Héctor (#2) con Antoine como compañero"
SLOT1=$(date -u -d '+2 days 10:00' +"%Y-%m-%dT%H:00:00Z")
SLOT2=$(date -u -d '+2 days 18:00' +"%Y-%m-%dT%H:00:00Z")
SLOT3=$(date -u -d '+3 days 10:00' +"%Y-%m-%dT%H:00:00Z")
COURT=$(psql -tA -c "SELECT id FROM courts WHERE tenant_id='ad61e9b5-2107-4b44-b9d6-f87ebd41ec1d' AND sport='padel' AND is_active LIMIT 1")
echo "Slots: $SLOT1 / $SLOT2 / $SLOT3 (court=$COURT)"

CHALLENGE=$(as_user "$DEMO" "
SELECT (create_ladder_challenge_with_slots(
  '$LADDER'::uuid,
  '$HECTOR'::uuid,
  '[{\"starts_at\":\"$SLOT1\",\"court_id\":\"$COURT\"},{\"starts_at\":\"$SLOT2\",\"court_id\":\"$COURT\"},{\"starts_at\":\"$SLOT3\",\"court_id\":\"$COURT\"}]'::jsonb,
  '$ANTOINE'::uuid
)).id;
" | grep -E '^ [a-f0-9-]{36}$' | tr -d ' ')
echo "Challenge creado: $CHALLENGE"

psql -c "SELECT id, slot1_starts_at, slot2_starts_at, slot3_starts_at, status FROM ladder_challenge_schedule_proposals WHERE challenge_id='$CHALLENGE'"

step "2a. Héctor acepta el desafío (transición propuesto → aceptado)"
as_user "$HECTOR" "SELECT respond_ladder_challenge('$CHALLENGE'::uuid, true);"

step "2b. Héctor confirma slot 1 + elige a Lucas como compañero"
PROP=$(psql -tA -c "SELECT id FROM ladder_challenge_schedule_proposals WHERE challenge_id='$CHALLENGE'")
echo "Propuesta: $PROP"

as_user "$HECTOR" "
SELECT confirm_ladder_challenge_slot('$PROP'::uuid, 1::smallint, '$LUCAS'::uuid);
"

psql -c "SELECT status, scheduled_at, challenger_partner_user_id, challenged_partner_user_id FROM ladder_challenges WHERE id='$CHALLENGE'"

step "3. Demo submite resultado (Demo/Antoine ganan 6-4 6-3)"
as_user "$DEMO" "
SELECT submit_ladder_result(
  '$CHALLENGE'::uuid,
  '$DEMO'::uuid,
  '{\"sets\":[{\"home\":6,\"away\":4},{\"home\":6,\"away\":3}]}'::jsonb
);
"
psql -c "SELECT status, winner_user_id, result_proposed_by, result_proposed_at FROM ladder_challenges WHERE id='$CHALLENGE'"

step "4. Héctor confirma el resultado"
as_user "$HECTOR" "
SELECT confirm_ladder_result('$CHALLENGE'::uuid);
"
psql -c "SELECT status, played_at, result_confirmed_at FROM ladder_challenges WHERE id='$CHALLENGE'"

step "5. Validación de swap (Demo↔Héctor; partners quedan)"
psql -c "SELECT position, p.first_name FROM ladder_positions lp JOIN profiles p ON p.user_id=lp.user_id WHERE ladder_id='$LADDER' ORDER BY position"

step "6. ELO después"
psql -c "
WITH players(uid,name) AS (VALUES
 ('$DEMO'::uuid,'Demo (W)'),('$HECTOR'::uuid,'Héctor (L)'),
 ('$ANTOINE'::uuid,'Antoine (W partner)'),('$LUCAS'::uuid,'Lucas (L partner)'))
SELECT p.name, pr.level AS level_despues, pr.matches_played, pr.last_change_delta, pr.last_match_at::date
FROM players p LEFT JOIN player_ratings pr ON pr.user_id=p.uid AND pr.sport='padel'
ORDER BY p.name"

step "7. Asserts automáticos"
psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE
  demo_pos int; hector_pos int; antoine_pos int; lucas_pos int;
  bruno_pos int; camille_pos int;
BEGIN
  SELECT position INTO demo_pos    FROM ladder_positions WHERE ladder_id='$LADDER' AND user_id='$DEMO';
  SELECT position INTO hector_pos  FROM ladder_positions WHERE ladder_id='$LADDER' AND user_id='$HECTOR';
  SELECT position INTO antoine_pos FROM ladder_positions WHERE ladder_id='$LADDER' AND user_id='$ANTOINE';
  SELECT position INTO lucas_pos   FROM ladder_positions WHERE ladder_id='$LADDER' AND user_id='$LUCAS';
  SELECT position INTO bruno_pos   FROM ladder_positions WHERE ladder_id='$LADDER' AND user_id='$BRUNO';
  SELECT position INTO camille_pos FROM ladder_positions WHERE ladder_id='$LADDER' AND user_id='$CAMILLE';

  ASSERT demo_pos    = 2, format('Demo debería estar en #2, está en #%s', demo_pos);
  ASSERT hector_pos  = 4, format('Héctor debería estar en #4, está en #%s', hector_pos);
  ASSERT antoine_pos = 5, format('Antoine (partner) debería seguir en #5, está en #%s', antoine_pos);
  ASSERT lucas_pos   = 6, format('Lucas (partner) debería seguir en #6, está en #%s', lucas_pos);
  ASSERT bruno_pos   = 1, format('Bruno debería seguir en #1, está en #%s', bruno_pos);
  ASSERT camille_pos = 3, format('Camille debería seguir en #3, está en #%s', camille_pos);

  -- ELO: 4 jugadores con sport='padel' actualizado al menos a 1 match jugado
  IF (SELECT COUNT(*) FROM player_ratings WHERE sport='padel'
      AND user_id IN ('$DEMO','$HECTOR','$ANTOINE','$LUCAS')
      AND matches_played >= 1) <> 4 THEN
    RAISE EXCEPTION 'No se aplicó ELO a los 4 jugadores en sport=padel';
  END IF;

  RAISE NOTICE '✅ Todos los asserts pasaron';
END \$\$;
SQL

echo
echo "✅ E2E PADEL LADDER COMPLETO"
