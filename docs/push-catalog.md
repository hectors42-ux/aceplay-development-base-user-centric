# Catálogo de push notifications · AcePlay

Single source of truth: `src/lib/push-templates.ts`. Mirror Deno: `supabase/functions/_shared/push-templates.ts`.

En este repo "push" se materializa como filas en `public.user_notifications` (feed in-app). El helper SQL `public.enqueue_user_notification(...)` aplica:
- Filtro por preferencia de categoría (`user_push_preferences`).
- Cap anti-spam: máx 3 notificaciones de torneo por usuario por torneo en 24h.
- No re-notifica al `reporter_id` en `result_pending_confirmation` (regla §6 del PRD).

## Estado por evento

| Kind | Categoría | Estado | Disparador | Notas |
|---|---|---|---|---|
| `tournament_drawing_published` | juego | ✅ Implementado | trigger AFTER UPDATE `tournament_categories.bracket_generated_at` | Notifica a todos los inscritos confirmados |
| `partner_changed` | juego | ✅ Ya existía (PRD 2) | swap/regenerate americano | Migrar a `enqueue_user_notification` en próxima pasada |
| `your_match_in_10` | juego | 🟡 TODO | cron 10 min antes del match | Requiere job de scheduling |
| `round_started` | juego | 🟡 TODO | cuando una ronda pasa a `en_curso` | Requiere hook |
| `result_pending_confirmation` | juego | 🟡 TODO | operador cargó resultado (PRD 3) | Disparador SQL pendiente |
| `match_disputed` | juego | 🟡 TODO | jugador disputó | Disparador SQL pendiente |
| `result_auto_confirmed` | juego | 🟡 TODO | cron auto-confirm a los 10 min | Requiere cron |
| `you_won_match` | juego | 🟡 TODO | resultado confirmado + ganador | Requiere cálculo points/pos |
| `streak_started` | juego | 🟠 Parcial vía `tournament_signals_feed` | `consecutive_wins == 3` | Feed sí lo muestra; falta persistir |
| `climbed_positions` | juego | 🟡 TODO | diff standings ≥3 | Requiere snapshots |
| `session_ended_share_day` | juego | 🟡 TODO | última ronda agendada del día | Requiere cron |
| `tournament_champion` | juego | 🟠 Parcial vía `tournament_signals_feed` | cierre del torneo | Feed sí lo muestra |
| `tournament_ended` | juego | ✅ Implementado | trigger AFTER UPDATE `tournaments.status -> 'finalizado'` | Notifica a todos los inscritos |
| `trial_ending` | marketing | ✅ Implementado | `trial-expiry-check` (cron diario) | Respeta toggle marketing |
| `operator_assigned` | sistema | ✅ Implementado | trigger AFTER INSERT `tournament_operators` | |

## Reglas de copy

- Voseo si el sentimiento es alto, neutro si es informativo.
- Sin emojis salvo 🔥 en `streak_started` y 🏆 en `tournament_champion`.
- ≤2 oraciones, ~60 chars en el body para evitar truncar.
- Un solo `!` como máximo.
- Acción al final con flecha (`→ Ver`, `→ Revisar`, `→ Compartir`).

## Preferencias del usuario

`/perfil → Notificaciones` permite silenciar por categoría. Default ON en las tres.
Los kinds de categoría `juego` son esenciales — no recomendable silenciar.

## Anti-spam

`enqueue_user_notification` cuenta filas con `kind` en el conjunto torneo durante las últimas 24h por usuario. Al llegar a 3, descarta las siguientes (return `NULL`).

## Fuera de alcance (no implementado en esta entrega)

- Push OS-level (web-push / OneSignal): el repo no tiene infra de service worker push.
- Refactor masivo de los 18 sitios SQL que insertan directo a `user_notifications` para usar el RPC nuevo. Sólo los nuevos triggers del PRD 11 lo usan.
- Crons faltantes para `your_match_in_10`, `result_auto_confirmed`, `session_ended_share_day`.