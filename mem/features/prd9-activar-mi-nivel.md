---
name: PRD 9 · Activar mi nivel
description: Captación de socios — flow guest→trial desde la share card del torneo
type: feature
---

## Modelo
- `profiles.membership_type` (`guest|trial|member`), `membership_activated_at`, `membership_expires_at`, `membership_source_tournament`.
- `tournament_membership_offer` (PK = `tournament_id`): `offer_type`, `offer_label`, `offer_terms_md`, `active`, `expires_at`.
- RLS: lectura pública si `active=true and (expires_at is null or > now())`; escritura solo managers.

## RPCs
- `get_tournament_membership_offer(_tournament_id)` SECURITY DEFINER, GRANT anon+authenticated.
- `activate_trial_membership(_tournament_id, _phone)` SECURITY DEFINER, GRANT authenticated. Idempotente: no degrada `member`. Setea `expires_at = now()+30d`, emite `tournament_events.guest_to_member_converted` y `analytics_events`.

## Trial limits
- Trigger `enforce_trial_booking_limit` en `bookings BEFORE INSERT`: máx 2/mes para `membership_type='trial'`.

## Frontend
- `useTournamentMembershipOffer(tournamentId)` → llama al RPC público.
- `useViewerMembership()` lee `profile.membership_type` desde AuthProvider.
- `ActivateLevelBlock` (en `SharePage` cuando `kind=profile`): solo visible si hay oferta y viewer es guest autenticado.
- `ActivateLevelSheet`: bottom sheet con `offer_terms_md`, input opcional `phone`, llama `activate_trial_membership`, `celebrateMajorOnce('trial:${id}')`, redirect a `/torneos?welcome={slug}`.
- Tab admin "Captación" en `AdminTorneoDetalle.tsx` → `MembershipOfferTab`.

## Métricas (PRD 7)
`activate_level_clicked`, `activate_level_sheet_dismissed`, `guest_to_member_converted`, `trial_expired`. Ya consumidos por `tournament_report_metrics.captacion`.

## Cron
Edge function `trial-expiry-check`: diario. Avisa -7d, degrada vencidos. Cron de Supabase pendiente de configurar.

## NO hacer
- No degradar a un `member` real desde el flow trial.
- No mostrar la oferta si no está activa o ya venció.
- No bypassear RLS de bookings — el trial sigue con permisos extendidos (2/mes vía trigger).