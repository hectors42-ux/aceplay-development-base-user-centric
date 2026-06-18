## UI Fase 1 — Player-first (AcePlay)

Construyo el esqueleto de navegación centrado en el jugador sobre el schema existente. Sin motor de torneos, sin rating/puntos, sin tablas nuevas.

### 0. Pre-requisito SQL (1 migración)
Ampliar policy de lectura de `space_membership` para que un miembro/admin/usuario-con-acceso pueda ver a los demás:
```sql
drop policy if exists sm_read on public.space_membership;
create policy sm_read on public.space_membership for select
  using (player_id = auth.uid() or public.space_admin(space_id) or public.can_access_space(space_id));
```

### 1. Setup base
- Instalar shadcn/ui (button, card, input, tabs, badge, avatar, dialog, checkbox, label, sonner, skeleton).
- Tailwind tokens Clay: primary `#C85C2D`, background `#FDF9F4`, foreground `#2A1F17` mapeados en `index.css` como HSL semantic tokens. Serif (Georgia) para titulares, sans system para cuerpo.
- React Router + TanStack Query providers en `App.tsx`.
- Provider `AuthProvider` con `supabase.auth.onAuthStateChange` + sesión inicial.
- Configurar Google OAuth en backend (provider) y URL redirect a `${origin}/`.

### 2. Rutas
```
/login          público
/onboarding     auth obligatorio, sin onboarded
/               Compite (home, mis espacios)
/descubrir      Descubrir + unirse
/space/:id      Vista de espacio
/perfil         Perfil + privacidad + logout
```
- `<RequireAuth>` redirige a `/login` si no hay sesión.
- `<RequireOnboarded>` redirige a `/onboarding` si `profiles.data_consent->>'onboarded'` es null.
- Tras login completo: redirect a `/`.

### 3. Layout
- `AppShell` con `<Outlet/>` + `BottomNav` mobile-first con 3 items: **Compite** (/) · **Descubrir** (/descubrir) · **Perfil** (/perfil). Reservar slots Reserva/Ranking/Torneos para fases futuras (no renderizar).

### 4. Pantallas

**`/login`** — Card centrada. Botón "Continuar con Google" (`signInWithOAuth`) + input email → "Enviar magic link" (`signInWithOtp`). Toast de confirmación.

**`/onboarding`** — Form: `handle` (validación en blur con `select id from profiles where handle = ?` excluyendo propio; slugify minúsculas, sin espacios, `[a-z0-9_]`), `display_name`, avatar opcional (upload a bucket `avatars`, guardar `avatar_url`), checkboxes Ley 21.719: `terms` (requerido), `analytics` (opt-in), `brand_targeting` (opt-in). Submit → `update profiles set handle, display_name, avatar_url, data_consent = { onboarded:true, analytics, brand_targeting, accepted_at: ISO } where id = auth.uid()` → navigate `/`.

**`/` Compite** — Query `space_membership` con `status='active'` join `space`. Agrupar por `space.type` en secciones: Clubes, Torneos, Escalerillas, Ligas. Card: nombre + badge type + badge role (si owner/admin/organizer) + sport. Para `type='category'` resolver nombre del torneo padre (`parent_space_id`). Vacío → CTA Descubrir. Tap → `/space/:id`.

**`/space/:id`** — Fetch single space (RLS gobierna; error → 403 amable "No tienes acceso a este espacio"). Header: nombre, badge type, ícono candado/globo según visibility, sport. Tabs:
- **Participantes**: lista `space_membership` del espacio con `profiles` (handle, display_name, avatar, role). Fila propia destacada (`ring-2 ring-primary`). Si existe `space_standing` propia, mostrar `local_rank` como "Posición #N" (sin rating).
- **Info**: `settings.description` si hay, `join_policy`, organizador resuelto.
- Si `type='club'` y `visibility='hierarchy'`: sección "Competencias del club" listando hijos (`parent_space_id = :id`), cada uno con CTA según §5.
- Si `space_admin(id)`: botón "Gestionar" (placeholder/disabled "Próximamente").

**`/descubrir`** — Lista `space` con `visibility='public'` y `type in ('tournament','escalerilla','liga')` + hijos por herencia (los retorna RLS automáticamente al `select * from space`, basta con un filtro amplio). Search por código: input → `select where slug ilike ? or settings->>'code' = ?`. Botón Unirme por card:
- `open` → insert directo `status='active'`.
- club-hijo con membership activa en padre → insert directo.
- `request`/`invite` → insert `status='pending'`, toast "Solicitud enviada".
- `code` → exige código.
- `socios_only` → verificar membership activa en padre; si no, error "Solo para socios del club".
Tras join active → invalidar query de Compite.

**`/perfil`** — display_name/avatar editables. Sección Privacidad con toggles `analytics` y `brand_targeting` que hacen update a `data_consent`. Botón Cerrar sesión.

### 5. Reglas que respeto
- Sin tablas nuevas. Sin tocar motor (`matches`, `player_ratings`, `ladder_state`, ledgers).
- Sin mostrar rating/Glicko/puntos/XP/Fichas en ningún lugar.
- Sin filtrar por `tenant_id`/club en el cliente — RLS gobierna.
- Español de Chile en toda la microcopy.
- Mobile-first, shadcn, sin animaciones hero.

### Archivos a crear (resumen)
- 1 migración SQL (sm_read policy).
- `src/index.css` (tokens Clay + serif), `tailwind.config.ts` (font-display Georgia).
- `src/App.tsx` (providers + router).
- `src/lib/auth.tsx` (AuthProvider, hooks).
- `src/components/AppShell.tsx`, `BottomNav.tsx`, `RequireAuth.tsx`, `RequireOnboarded.tsx`, `SpaceCard.tsx`, `JoinButton.tsx`.
- `src/pages/{Login,Onboarding,Compite,Descubrir,Space,Perfil,NotFound}.tsx`.
- shadcn components vía CLI.

### Criterios de aceptación que validaré
Los 7 del prompt (login, onboarding gating, multi-pertenencia visible, 403, hierarchy, join open, sin rating).