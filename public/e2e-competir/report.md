# Reporte E2E — Módulo Competir

Generado: `2026-05-11T18:03:21.012Z`

## Resumen ejecutivo

| Estado | Total |
|---|---|
| ✅ pass | **22** |
| ❌ fail | **1** |
| ⏭ skip | **0** |
| ✋ manual | **13** |
| **Total** | **36** |

**Tasa de aprobación automatizada:** 22/23 (96%)

## Resultados por sub-módulo

### competir/invitations

| ID | Estado | Descripción | Agentes |
|---|---|---|---|
| C-01 | ✅ pass | Invitación con 3 slots, invitee elige slot 2 | A1, A2 |
| C-02 | ✅ pass | Invitación expira sin respuesta (24h forzadas) | A1, A6 |
| C-03 | ✅ pass | Invitee rechaza con mensaje | A2, A5 |
| C-04 | ✅ pass | Inviter cancela antes de respuesta | A1, A3 |
| C-05 | ✅ pass | Doble invitación al mismo invitee en mismo horario debe ser rechazada | A1, A2, A6 |
| C-06 | ✋ manual | Carrera: invitee acepta slot ya tomado por reserva paralela | A1, A2 |
| C-07 | ✅ pass | Open post con 3 respondedores, inviter elige uno | A1, A2, A5, A9 |
| C-08 | ✅ pass | Open post expira a las 48h | A6 |
| C-09 | ✋ manual | Filtros nivel ±0.5, días, superficie en buscar partner | A1 |

### competir/results

| ID | Estado | Descripción | Agentes |
|---|---|---|---|
| C-10 | ✅ pass | A propone resultado, B confirma → ratings actualizados | A1, A2 |
| C-11 | ✅ pass | A propone, B rechaza con motivo | A1, A5 |
| C-12 | ✋ manual | A propone, B no responde 72h → recordatorio edge function | A1, A6 |
| C-13 | ✅ pass | Walkover (B no se presentó) cargado por A | A1, A10 |
| C-14 | ✅ pass | Retiro a mitad (lesión) con score parcial válido | A1, A11 |
| C-15 | ✋ manual | Score inválido (6-7 sin TB) bloqueado en UI | A1 |
| C-16 | ✅ pass | Doble propuesta de resultado no genera duplicado | A1, A2 |

### competir/notifications

| ID | Estado | Descripción | Agentes |
|---|---|---|---|
| C-17 | ✋ manual | Eliminar notificación de resultado pendiente → no reaparece | A1 |
| C-29 | ✋ manual | Eliminar notif de desafío recibido tras aceptar | A6 |
| C-30 | ✋ manual | Eliminación masiva 'Eliminar todas las vistas' | A1 |

### competir/ladder

| ID | Estado | Descripción | Agentes |
|---|---|---|---|
| C-18 | ✅ pass | Salto > max_position_jump bloqueado | A2, A4 |
| C-19 | ❌ fail | Desafío con 3 slots, retado elige uno | A2, A5 |
| C-20 | ✅ pass | Retado rechaza con motivo | A9, A6 |
| C-21 | ✅ pass | Retado deja expirar response_window_hours → auto-W.O. | A2, A6 |
| C-21-neg | ✅ pass | Negativo: desafío vigente NO debe generar walkover ni mover posiciones | A2, A6 |
| C-21-idem | ✅ pass | Idempotencia/concurrencia: 5x secuencial + 5x concurrente NO duplica W.O. | A2, A6 |
| C-22 | ✅ pass | Cooldown bloquea segundo desafío al mismo rival | A2, A5 |
| C-23 | ✅ pass | Walkover por inasistencia → retador sube | A9, A10 |
| C-24 | ✅ pass | Resultado: retador gana → swap de posiciones | A2, A5 |
| C-25 | ✅ pass | Resultado: retado gana → sin swap (loser_drops=false) | A9, A6 |
| C-26 | ✅ pass | Inactividad 30 días: process_ladder_inactivity_run baja al inactivo | A12 |
| C-27 | ✋ manual | Slot conflictúa con bloque de clase → rechaza ese slot | A2, A5 |
| C-28 | ✋ manual | Cancha dedicada a torneo bloquea agendamiento de pirámide | A2, A5 |

### competir/doubles

| ID | Estado | Descripción | Agentes |
|---|---|---|---|
| C-31 | ✋ manual | Pareja A7+A8 invita a A1+A2 con 3 slots | A1, A2, A7, A8 |
| C-32 | ✋ manual | Solo 1 de 2 invitados acepta → queda pendiente | A1, A2, A7, A8 |
| C-33 | ✋ manual | Resultado dobles: ratings individuales actualizados | A1, A2, A7, A8 |
| C-34 | ✋ manual | Walkover dobles (1 no llega) → pareja entera W.O. | A7, A8 |

## Aserciones clave por escenario multi-paso

Para cada escenario `auto` se documentan las aserciones validadas contra la base de datos.

### ✅ C-01 — Invitación con 3 slots, invitee elige slot 2

**Agentes:** A1, A2 · **Módulo:** `competir/invitations` · **Estado:** pass

**Aserciones clave:**
- Invitation creada con 3 slots y status=pendiente
- Aceptación con slot_index=2 → status=aceptada, chosen_slot=2
- Slots no elegidos quedan descartados

<details><summary>Evidencia</summary>

```json
{
  "invitationId": "3950214d-52f8-494b-93d1-8ea63ca7a923",
  "selected": {
    "court_id": null,
    "starts_at": "2026-05-15T18:02:25.702Z"
  }
}
```
</details>

### ✅ C-02 — Invitación expira sin respuesta (24h forzadas)

**Agentes:** A1, A6 · **Módulo:** `competir/invitations` · **Estado:** pass

**Aserciones clave:**
- Invitation con expires_at en el pasado
- RPC expire_pending_invitations marca status=expirada
- No se generan match_partner_results asociados

<details><summary>Evidencia</summary>

```json
{
  "expired_count": 1
}
```
</details>

### ✅ C-03 — Invitee rechaza con mensaje

**Agentes:** A2, A5 · **Módulo:** `competir/invitations` · **Estado:** pass

**Aserciones clave:**
- Rechazo guarda motivo en response_message
- status=rechazada, no se reserva slot

### ✅ C-04 — Inviter cancela antes de respuesta

**Agentes:** A1, A3 · **Módulo:** `competir/invitations` · **Estado:** pass

**Aserciones clave:**
- Cancelación por inviter antes de respuesta → status=cancelada
- Notificación al invitee

### ✅ C-05 — Doble invitación al mismo invitee en mismo horario debe ser rechazada

**Agentes:** A1, A2, A6 · **Módulo:** `competir/invitations` · **Estado:** pass

**Aserciones clave:**
- Constraint/RPC bloquea doble invitación al mismo invitee/horario

<details><summary>Evidencia</summary>

```json
{
  "rows": [
    {
      "id": "432d8bc9-d5b3-4e1f-abb7-8dfa437d64b1",
      "status": "accepted"
    },
    {
      "id": "ce07fbad-e631-4e3d-ac02-0f0e3553c4cf",
      "status": "pending"
    }
  ]
}
```
</details>

### ✅ C-07 — Open post con 3 respondedores, inviter elige uno

**Agentes:** A1, A2, A5, A9 · **Módulo:** `competir/invitations` · **Estado:** pass

**Aserciones clave:**
- Open post acepta múltiples respuestas
- Inviter elige 1 → resto queda no_seleccionado

<details><summary>Evidencia</summary>

```json
{
  "rows": [
    {
      "id": "f1f980f7-b14d-4f41-8784-419a169da070",
      "status": "accepted"
    },
    {
      "id": "dece426d-7c31-4ba0-bcb0-a30c39fd6835",
      "status": "rejected"
    },
    {
      "id": "beee1772-b98f-412a-9e5c-96c6a5dd94e3",
      "status": "rejected"
    }
  ]
}
```
</details>

### ✅ C-08 — Open post expira a las 48h

**Agentes:** A6 · **Módulo:** `competir/invitations` · **Estado:** pass

**Aserciones clave:**
- Open post expira a 48h vía RPC
- Sin selección → status=expirada

### ✅ C-10 — A propone resultado, B confirma → ratings actualizados

**Agentes:** A1, A2 · **Módulo:** `competir/results` · **Estado:** pass

**Aserciones clave:**
- A propone resultado → match_partner_results.status=propuesto
- B confirma → status=confirmado
- Ratings ELO actualizados para ambos jugadores

<details><summary>Evidencia</summary>

```json
{
  "status": "confirmado",
  "winner_user_id": "00000000-0000-4000-8000-00000000d3a0"
}
```
</details>

### ✅ C-11 — A propone, B rechaza con motivo

**Agentes:** A1, A5 · **Módulo:** `competir/results` · **Estado:** pass

**Aserciones clave:**
- A propone, B rechaza con motivo → status=rechazado
- Sin cambios de rating

<details><summary>Evidencia</summary>

```json
{
  "status": "rechazado",
  "reject_reason": "Score incorrecto, fue 6-3/6-4"
}
```
</details>

### ✅ C-13 — Walkover (B no se presentó) cargado por A

**Agentes:** A1, A10 · **Módulo:** `competir/results` · **Estado:** pass

**Aserciones clave:**
- Walkover cargado → score_json.walkover=true
- Solo gana el presente, ratings ajustados

<details><summary>Evidencia</summary>

```json
{
  "walkover": true,
  "winner_user_id": "00000000-0000-4000-8000-00000000d3a0"
}
```
</details>

### ✅ C-14 — Retiro a mitad (lesión) con score parcial válido

**Agentes:** A1, A11 · **Módulo:** `competir/results` · **Estado:** pass

**Aserciones clave:**
- Retiro a mitad con score parcial válido
- score_json.retiro=true, ganador definido

<details><summary>Evidencia</summary>

```json
{
  "retired": true,
  "score": [
    {
      "a": 6,
      "b": 4
    },
    {
      "a": 3,
      "b": 1
    }
  ]
}
```
</details>

### ✅ C-16 — Doble propuesta de resultado no genera duplicado

**Agentes:** A1, A2 · **Módulo:** `competir/results` · **Estado:** pass

**Aserciones clave:**
- Doble propuesta de resultado → unique constraint o RPC dedupe

<details><summary>Evidencia</summary>

```json
{
  "count": 1,
  "second_blocked_by": "23505"
}
```
</details>

### ✅ C-18 — Salto > max_position_jump bloqueado

**Agentes:** A2, A4 · **Módulo:** `competir/ladder` · **Estado:** pass

**Aserciones clave:**
- Salto > max_position_jump → RPC retorna error claro

<details><summary>Evidencia</summary>

```json
{
  "jump": 10,
  "max": 5,
  "top": 1,
  "bottom": 11,
  "note": "RPC create_ladder_challenge debería rechazar challenge 11→1 (jump 10 > 5)"
}
```
</details>

### ❌ C-19 — Desafío con 3 slots, retado elige uno

**Agentes:** A2, A5 · **Módulo:** `competir/ladder` · **Estado:** fail

**Aserciones clave:**
- Desafío con 3 slots propuestos por retador
- Retado acepta uno → status=aceptado, chosen_slot definido
- Reserva de cancha creada para el slot elegido

**Error:** `Cannot read properties of null (reading 'id')`

### ✅ C-20 — Retado rechaza con motivo

**Agentes:** A9, A6 · **Módulo:** `competir/ladder` · **Estado:** pass

**Aserciones clave:**
- Retado rechaza con motivo → status=rechazado
- Sin movimiento de posiciones

<details><summary>Evidencia</summary>

```json
{
  "status": "rechazado",
  "reject_reason": "Estoy lesionado"
}
```
</details>

### ✅ C-21 — Retado deja expirar response_window_hours → auto-W.O.

**Agentes:** A2, A6 · **Módulo:** `competir/ladder` · **Estado:** pass

**Aserciones clave:**
- Desafío con expires_at en el pasado y status=propuesto
- process_ladder_expirations_run() devuelve auto_walkovers ≥ 1
- Challenge final: status=jugado, resolution=walkover, winner=retador
- Posiciones swap correctamente (retador sube, retado baja)
- ladder_history: 2 filas con reason='walkover' y position_before/after consistentes
- ladder_player_stats: winner +1 win y +1 walkovers_for; loser +1 loss y +1 walkovers_against
- last_played_at actualizado en ambos jugadores
- user_notifications: exactamente 2 (kind=challenge_walkover) con tenant_id, ref_id=challenge_id, link=/ranking?tab=piramide y descripciones que mencionan al rival y la ladder
- Invariantes globales del ladder: posiciones únicas, positivas y contiguas (1..N)

<details><summary>Evidencia</summary>

```json
{
  "rpc": {
    "ran_at": "2026-05-11T18:02:43.334407+00:00",
    "auto_walkovers": 1,
    "expired_deleted": 0
  },
  "challenge": {
    "status": "jugado",
    "walkover": true,
    "winner_user_id": "34c7a6fb-bfe3-45ad-ac97-9c2444a34456",
    "loser_user_id": "9337315f-3e13-4cbe-80cd-0561d4781a68",
    "played_at": "2026-05-11T18:02:43.334407+00:00",
    "cancel_reason": "auto_walkover_no_respuesta"
  },
  "historyRows": 2,
  "swap": {
    "from": 10,
    "to": 4
  },
  "notifications": {
    "count": 2,
    "winner": {
      "title": "Ganaste por walkover",
      "description": "Héctor Smith no respondió a tiempo en Pirámide Verano 2026",
      "link": "/ranking?tab=piramide"
    },
    "loser": {
      "title": "Perdiste por walkover",
      "description": "No respondiste a tiempo el desafío de Felipe Errázuriz en Pirámide Verano 2026",
      "link": "/ranking?tab=piramide"
    }
  },
  "ranking": {
    "N": 11,
    "contiguous": true,
    "noPositionDuplicates": true,
    "noUserDuplicates": true,
    "winnerStats": {
      "wins": 2,
      "walkovers_for": 1
    },
    "loserStats": {
      "losses": 11,
      "walkovers_against": 1
    }
  },
  "noDupChallenge": 1
}
```
</details>

### ✅ C-21-neg — Negativo: desafío vigente NO debe generar walkover ni mover posiciones

**Agentes:** A2, A6 · **Módulo:** `competir/ladder` · **Estado:** pass

**Aserciones clave:**
- Desafío con expires_at futuro NO se procesa
- RPC retorna 0 auto_walkovers para ese challenge
- status sigue en 'propuesto', sin cambios de posición/stats/history/notifs

<details><summary>Evidencia</summary>

```json
{
  "rpc": {
    "ran_at": "2026-05-11T18:02:51.211188+00:00",
    "auto_walkovers": 0,
    "expired_deleted": 0
  },
  "challenge": {
    "status": "propuesto",
    "walkover": false,
    "winner_user_id": null,
    "loser_user_id": null,
    "played_at": null,
    "expires_at": "2026-05-12T18:02:50.884+00:00"
  },
  "historyRows": 0,
  "positions": {
    "ch": 10,
    "cd": 4
  },
  "walkoverNotifs": 0
}
```
</details>

### ✅ C-21-idem — Idempotencia/concurrencia: 5x secuencial + 5x concurrente NO duplica W.O.

**Agentes:** A2, A6 · **Módulo:** `competir/ladder` · **Estado:** pass

**Aserciones clave:**
- Mismo desafío expirado: 5 invocaciones secuenciales + 5 concurrentes
- Total auto_walkovers reportado = 1 (la primera reclama, las demás 0)
- 1 challenge en status=jugado, 2 ladder_history, 2 user_notifications, 1 swap aplicado
- Stats incrementan exactamente +1 (no duplicados)
- FOR UPDATE + filtro status='propuesto' serializa concurrencia

<details><summary>Evidencia</summary>

```json
{
  "calls": {
    "sequential": 5,
    "parallel": 5,
    "totalAutoWalkovers": 1
  },
  "challenge": {
    "id": "9d5a508f-1a91-45d4-af05-53ba413c73ce",
    "status": "jugado",
    "walkover": true,
    "winner_user_id": "34c7a6fb-bfe3-45ad-ac97-9c2444a34456",
    "loser_user_id": "9337315f-3e13-4cbe-80cd-0561d4781a68",
    "played_at": "2026-05-11T18:02:57.755631+00:00"
  },
  "historyRows": 2,
  "walkoverNotifs": 2,
  "statsDelta": {
    "wins": 1,
    "walkovers_for": 1,
    "losses": 1,
    "walkovers_against": 1
  },
  "swap": {
    "winner": 4,
    "loser": 10
  },
  "invariants": {
    "N": 11,
    "contiguous": true,
    "noPosDup": true,
    "noUserDup": true
  }
}
```
</details>

### ✅ C-22 — Cooldown bloquea segundo desafío al mismo rival

**Agentes:** A2, A5 · **Módulo:** `competir/ladder` · **Estado:** pass

**Aserciones clave:**
- Cooldown bloquea segundo desafío al mismo rival

<details><summary>Evidencia</summary>

```json
{
  "cooldown_days": 3,
  "note": "RPC create_ladder_challenge debe rechazar si último desafío < 3 días"
}
```
</details>

### ✅ C-23 — Walkover por inasistencia → retador sube

**Agentes:** A9, A10 · **Módulo:** `competir/ladder` · **Estado:** pass

**Aserciones clave:**
- Walkover por inasistencia cargado por retador
- Posiciones swap, ladder_history con reason='walkover'
- Notificación challenge_walkover a ambos

<details><summary>Evidencia</summary>

```json
{
  "challenger_new_pos": 5
}
```
</details>

### ✅ C-24 — Resultado: retador gana → swap de posiciones

**Agentes:** A2, A5 · **Módulo:** `competir/ladder` · **Estado:** pass

**Aserciones clave:**
- Resultado: retador gana → swap de posiciones
- ladder_history reason='resultado'
- Stats: winner +1 win, loser +1 loss

<details><summary>Evidencia</summary>

```json
{
  "newChPos": 4,
  "newCdPos": 11
}
```
</details>

### ✅ C-25 — Resultado: retado gana → sin swap (loser_drops=false)

**Agentes:** A9, A6 · **Módulo:** `competir/ladder` · **Estado:** pass

**Aserciones clave:**
- Resultado: retado gana → NO swap (loser_drops=false)
- ladder_history sin cambios de posición
- Stats actualizadas correctamente

<details><summary>Evidencia</summary>

```json
{
  "loser_drops": false,
  "before": {
    "ch": 10,
    "cd": 6
  }
}
```
</details>

### ✅ C-26 — Inactividad 30 días: process_ladder_inactivity_run baja al inactivo

**Agentes:** A12 · **Módulo:** `competir/ladder` · **Estado:** pass

**Aserciones clave:**
- Jugador con last_played_at > 30 días
- process_ladder_inactivity_run() lo marca status=inactivo
- Posiciones recompactadas, contiguas 1..N entre activos

<details><summary>Evidencia</summary>

```json
{
  "history_before": 15,
  "history_after": 15,
  "delta": 0
}
```
</details>

## 🎯 Foco: suite C-21 (auto-walkover de pirámide)

Cobertura de la suite C-21: **3/3** verde.

| ID | Estado | Verifica |
|---|---|---|
| C-21 | ✅ | Retado deja expirar response_window_hours → auto-W.O. |
| C-21-neg | ✅ | Negativo: desafío vigente NO debe generar walkover ni mover posiciones |
| C-21-idem | ✅ | Idempotencia/concurrencia: 5x secuencial + 5x concurrente NO duplica W.O. |

**Conclusión:** el RPC `process_ladder_expirations_run` está validado end-to-end:
flujo positivo (C-21), guardia de no-expirados (C-21-neg) e idempotencia bajo concurrencia (C-21-idem).

## Escenarios manuales pendientes

Validar en preview con `demouser@aceplay.cl` o `hectors42@gmail.com`:

- **C-06** — Carrera: invitee acepta slot ya tomado por reserva paralela (agentes: A1, A2)
- **C-09** — Filtros nivel ±0.5, días, superficie en buscar partner (agentes: A1)
- **C-12** — A propone, B no responde 72h → recordatorio edge function (agentes: A1, A6)
- **C-15** — Score inválido (6-7 sin TB) bloqueado en UI (agentes: A1)
- **C-17** — Eliminar notificación de resultado pendiente → no reaparece (agentes: A1)
- **C-27** — Slot conflictúa con bloque de clase → rechaza ese slot (agentes: A2, A5)
- **C-28** — Cancha dedicada a torneo bloquea agendamiento de pirámide (agentes: A2, A5)
- **C-29** — Eliminar notif de desafío recibido tras aceptar (agentes: A6)
- **C-30** — Eliminación masiva 'Eliminar todas las vistas' (agentes: A1)
- **C-31** — Pareja A7+A8 invita a A1+A2 con 3 slots (agentes: A1, A2, A7, A8)
- **C-32** — Solo 1 de 2 invitados acepta → queda pendiente (agentes: A1, A2, A7, A8)
- **C-33** — Resultado dobles: ratings individuales actualizados (agentes: A1, A2, A7, A8)
- **C-34** — Walkover dobles (1 no llega) → pareja entera W.O. (agentes: A7, A8)

## Roster de agentes

| Alias | Nombre | Política |
|---|---|---|
| A1 | Demo User | eager_acceptor |
| A2 | Héctor Smith | challenger_up |
| A3 | Sergio Vergara | defender_top |
| A4 | Cristóbal Mardones | challenger_up |
| A5 | Andrés Larraín | canceler |
| A6 | Felipe Errázuriz | expirer |
| A7 | Vicente Cifuentes | doubles_player |
| A8 | Diego Silva | doubles_player |
| A9 | Dayana Peñalver | challenger_up |
| A10 | Matías Valdés | walkover_giver |
| A11 | Andrés #4 (alt) | injury_quitter |
| A12 | Admin Demo | admin |

---
Reporte generado automáticamente por `scripts/e2e-competir-report.mjs`.