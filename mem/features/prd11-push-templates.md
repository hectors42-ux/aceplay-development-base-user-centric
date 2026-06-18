---
name: PRD 11 · Push templates
description: Catálogo central de notificaciones, helper enqueue con anti-spam y preferencias por categoría
type: feature
---

**Catálogo:** `src/lib/push-templates.ts` (FE) + `supabase/functions/_shared/push-templates.ts` (Deno mirror). 15 kinds; categorías `juego` | `marketing` | `sistema`.

**RPC central:** `public.enqueue_user_notification(_user, _tenant, _kind, _category, _title, _body, _link, _ref_id, _tournament_id)`. SECURITY DEFINER. Respeta `user_push_preferences` y aplica cap anti-spam de 3 notificaciones de torneo / usuario / 24h. Toda inserción nueva a `user_notifications` debe ir por este RPC.

**Preferencias:** tabla `public.user_push_preferences` (PK user_id, juego/marketing/sistema bool default true). RLS: dueño ve/edita. Hook `useUserPushPreferences()`. UI: `NotificationPreferencesCard` en `/perfil`.

**Triggers nuevos:**
- `trg_notify_tournament_drawing_published` → AFTER UPDATE `tournament_categories.bracket_generated_at`.
- `trg_notify_operator_assigned` → AFTER INSERT `tournament_operators`.
- `trg_notify_tournament_ended` → AFTER UPDATE `tournaments.status` → `finalizado`.

**Edge function `trial-expiry-check`:** ahora usa RPC + kind `trial_ending` (antes `trial_expiring_soon`) en categoría `marketing`.

**Tabla user_notifications:** columna real es `description` (no `body`). Cuidado al editar inserts legacy.

**TODO documentados** en `docs/push-catalog.md`: `your_match_in_10`, `round_started`, `result_pending_confirmation`, `match_disputed`, `result_auto_confirmed`, `you_won_match`, `climbed_positions`, `session_ended_share_day` (requieren cron/snapshots). Refactor de los 18 sitios SQL legacy a `enqueue_user_notification` queda para una segunda pasada.

**Regla de copy:** voseo si el sentimiento es alto, neutro si es informativo; sin emojis salvo 🔥 (streak_started) y 🏆 (tournament_champion); ≤2 oraciones; acción al final con flecha.