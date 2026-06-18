---
name: PRD 7 · Notificaciones del torneo
description: Feed de señales (racha, campeón) integrado al NotificationCenter. RPC tournament_signals_feed merge-eado en useNotificationsFeed.
type: feature
---

## Estado
Fase 1 (MVP) entregada — señales derivadas en vivo, sin push web/email todavía.

## Backend
- `tournament_signals_feed()` SECURITY DEFINER, GRANT a `authenticated`. Devuelve la misma shape que `notifications_feed`.
  - `tournament_streak`: `consecutive_wins >= 3` en torneo `en_curso`/`inscripciones_cerradas`. Link → `/torneos/:slug/compartir?kind=moment`.
  - `tournament_champion`: posición 1 en última snapshot de categoría `finalizado` (últimos 30 días). Link → `/torneos/:slug/compartir?kind=champion`.
- No se duplica data — todo se calcula desde `tournament_registrations` y `standings_snapshots`.

## Frontend
- `useNotificationsFeed` llama ambos RPCs en paralelo y mergea antes del filtro de dismissals.
- `NotificationKind` añade `tournament_streak`, `tournament_champion`.
- `NotificationCenter` mapea ambos kinds a icono Trophy (gold/amber).
- Dismissal funciona automáticamente porque usa `kind+ref_id`.

## Pendiente (Fase 2 — fuera de scope MVP)
- Push web (service worker + VAPID + suscripción por usuario).
- Email transaccional para resultados/champion.
- Triggers desde `tournament_events` que inserten en `user_notifications` para `partner_swap`, `rounds_regenerated`, `session_blocked` con copy específico (hoy esos eventos solo viven en telemetría).
- Preferencias por kind (silenciar racha, campeón, etc.) — tabla `notification_preferences`.

## Reglas
- Cualquier nuevo kind del feed DEBE estar en `NotificationKind` union y tener entrada en `KIND_META` de `NotificationCenter.tsx`, o el typecheck falla.
- Las señales se filtran por dismissal (`notification_dismissals`), así que reaparecen si el usuario las descarta y vuelve a cumplir la condición — comportamiento aceptado (no idempotente por diseño).
