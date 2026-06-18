---
name: PRD 3 Fase A · Rol de operador
description: Tabla tournament_operators, helpers RLS, tab Operadores en admin
type: feature
---

Tabla `public.tournament_operators` (PK `tournament_id + user_id`, FK cascade, `granted_by`, `granted_at`). Realtime activo.

RLS:
- SELECT: `is_tournament_admin(t,uid)` o `user_id = uid` (cada operador ve su propio rol).
- INSERT/DELETE: solo admins del torneo (`is_tournament_admin`).
- `tournament_matches` UPDATE y `tournament_sessions` UPDATE extendidos con policy "Operador del torneo …" usando `is_tournament_operator`.

Helpers SECURITY DEFINER (search_path = public):
- `tournament_tenant_id(_tournament_id)` → uuid
- `is_tournament_admin(_tournament_id, _user_id)` → boolean (super_admin global o club_admin del tenant)
- `is_tournament_operator(_tournament_id, _user_id)` → boolean

UI:
- Tab "Operadores" en `AdminTorneoDetalle.tsx` (grid-cols-7).
- `OperatorsTab.tsx` lista participantes confirmados (join via `tournament_categories.tournament_id`), botón "Dar vista" / badge "Operador" con AlertDialog de confirmación + `haptic('medium')`.
- Hook `useTournamentOperators(tournamentId)` con realtime sobre la tabla.

Pendiente fases B (tablero LIVE) y C (doble confirmación) — ver `.lovable/plan.md`.