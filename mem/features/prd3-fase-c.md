---
name: PRD 3 Fase C · Doble confirmación de resultados
description: confirmation_status en tournament_matches, RPCs confirm/dispute, cron auto-confirm, página /resultado-pendiente
type: feature
---

`tournament_matches`: nuevas columnas `confirmation_status` (`pendiente_confirmacion|confirmado|disputado`), `reported_by/at`, `confirmed_by/at`, `disputed_by/at`, `dispute_reason`.
`tournaments.auto_confirm_after_minutes` int default 10.

Flujo:
- Operador carga via `submit_americano_result` → pendiente_confirmacion + reported_by.
- Manager/admin carga el mismo RPC → confirmado directo.
- Jugador del partido (no reporter) llama `player_confirm_result(_match_id)` o `player_dispute_result(_match_id, _reason)`.
- pg_cron `auto-confirm-tournament-results` cada minuto ejecuta `auto_confirm_pending_results()` (nunca toca disputados).

UI:
- `usePendingConfirmations()` (realtime) lista partidos pendientes donde user es jugador y NO reporter.
- `<PendingConfirmationsCard />` en Index home (debajo de HeroCard).
- Ruta `/resultado-pendiente/:matchId` → `ResultadoPendiente.tsx` con AlertDialog para disputa + textarea.

Backfill: partidos ya jugado/walkover quedan confirmado automáticamente.
