# CHECKLIST técnico de rebranding — para el agente Lovable

Marcar `[x]` cuando cada ítem esté cerrado y verificado. Las fases son secuenciales: no avanzar a la siguiente sin cerrar todos los `[ ]` obligatorios de la anterior.

Referencias rápidas:
- Memoria base: `mem://index.md`, `mem://features/prd`, `mem://features/roadmap`
- Hook ladder label: `src/hooks/useLadderLabel.ts`
- Provider de marca: `src/components/providers/ClubBrandProvider.tsx`
- Provider de temas: `src/contexts/ThemeContext.tsx`, `src/lib/themes.ts`
- Tokens CSS: `src/index.css`, `tailwind.config.ts`

---

## Fase 0 — Pre-flight

- [ ] Confirmar que el remix tiene **BD Lovable Cloud propia** (no compartida con el proyecto base). Verificar con `supabase--project_info` que el `project_ref` es distinto al del base.
- [ ] Confirmar que `docs/remix/` viajó con el remix.
- [ ] Recibir respuestas del **Bloque 1** completo y adjuntos del **Bloque 2** (mínimo logo wordmark 2.1, app icon 2.4, paleta 2.7).
- [ ] Hacer un snapshot mental del estado base antes de mutar: `rg "AcePlay|aceplay-demo"` en `src/` para tener inventario.

---

## Fase 1 — Base de datos del nuevo tenant

Crear una migration única (`supabase--migration`) que:

- [ ] Borra (o renombra) el tenant `aceplay-demo` y todos sus datos seed (ladders, courts, bookings, tournaments) usando los FK con CASCADE.
- [ ] Inserta el tenant nuevo con: `slug`, `name`, `short_name`, `brand_primary` (HSL), `brand_primary_glow`, `brand_primary_deep`, `logo_url` (CDN del wordmark — se completa luego de Fase 2), `ladder_label`.
- [ ] Reasigna `profiles.tenant_id` de cualquier usuario existente al nuevo tenant (o los borra si son solo seed).
- [ ] Siembra (según Bloque 3): `courts`, `categories`, `coaches` (opcional), `legal_documents` con `tenant_id` (según Bloque 5).
- [ ] Verifica: `SELECT slug, name, short_name, ladder_label FROM tenants;` → 1 sola fila con el club nuevo.
- [ ] Verifica counts en 0 para tablas operativas que no se sembraron (`ladders`, `bookings`, `tournaments`).

> No ejecutar la migration hasta tener el plan aprobado.

---

## Fase 2 — Assets a CDN

Subir vía `lovable-assets create --file <path>` y escribir el `.asset.json` de salida. Reemplazar pointers existentes.

- [ ] `src/assets/brand/wordmark-primary.png.asset.json` (2.1)
- [ ] `src/assets/brand/wordmark-reverse.png.asset.json` (2.2, si vino)
- [ ] `src/assets/brand/mark-arc-primary.png.asset.json` + `mark-arc-ink` + `mark-arc-reverse` (2.3, si vino)
- [ ] `src/assets/brand/lockup-horizontal.png.asset.json` + `lockup-stacked.png.asset.json` (2.5, si vino)
- [ ] **App icon PWA** (2.4) — copiar a `public/`: `favicon.png`, `apple-touch-icon.png`, `icon-192.png` (resize), `icon-512.png`. NO usar `.asset.json` para íconos PWA: deben servirse desde paths fijos del manifest.
- [ ] Heros (2.6, si vinieron): `hero-terre-battue.png.asset.json`, `hero-us-open.png.asset.json`, `hero-wimbledon.png.asset.json`. Si no vinieron, dejar los del base.
- [ ] Una vez subido el wordmark, actualizar `tenants.logo_url` de la migration de Fase 1 con la URL CDN definitiva.

---

## Fase 3 — Tokens y tipografía

- [ ] `src/index.css`: actualizar variables HSL (`--primary`, `--primary-glow`, `--primary-deep`, `--background`, `--foreground`, `--accent`, `--border`) según paleta del Bloque 2.7. Mantener formato HSL (sin `hsl()`).
- [ ] `src/index.css`: ajustar el bloque de modo dark con las mismas tonalidades invertidas.
- [ ] `tailwind.config.ts`: si cambia la tipografía (Bloque 2.8), actualizar `fontFamily.serif`, `sans`, `mono`.
- [ ] `index.html`: actualizar `<link>` de Google Fonts si cambia tipografía; actualizar `<title>`, `<meta name="description">`, `<meta name="theme-color">`, `apple-mobile-web-app-title`, OG/Twitter (con `og:image` apuntando al CDN del lockup).
- [ ] `public/manifest.json`: `name`, `short_name`, `description`, `theme_color`, `background_color`, `icons[].src` (apuntando a los nuevos `/icon-192.png` y `/icon-512.png`).
- [ ] `src/components/providers/ClubBrandProvider.tsx`: renombrar `ACEPLAY_FALLBACK` → `<CLUB>_FALLBACK` con `slug`, `name`, `shortName`, paleta HSL, `logoUrl` (CDN del wordmark), `ladderLabel`.
- [ ] `src/lib/themes.ts`: si el club tiene "tema de la casa" distinto a arcilla, ajustar los swatches del tema `terre-battue` o renombrar (recordar que `THEME_IDS` y `LEGACY_THEME_MAP` requieren migración silenciosa de localStorage si renombras).

---

## Fase 4 — Strings hardcoded

- [ ] `rg -i "aceplay|aceplay demo|tennis, gamified|demouser@aceplay"` en `src/`, `public/`, `index.html` → reemplazar por strings del club o por consumo dinámico de `brand.name` / `brand.shortName`.
- [ ] Archivos clave a revisar (donde el nombre del club aparecía en base):
  - `src/components/AppSidebar.tsx`
  - `src/components/onboarding/WelcomeTour.tsx`
  - `src/pages/Install.tsx`
  - `src/pages/Index.tsx`, `src/pages/Perfil.tsx`
  - `src/components/tournaments/TournamentStats.tsx` (hashtag default)
  - `index.html`, `public/manifest.json`
- [ ] Si `ladder_label` cambia (ej. "Staderilla"), **no tocar React**: el hook `useLadderLabel()` ya lo consume desde BD. Verificar con `rg "Pirámide|Staderilla"` que no quedaron strings hardcoded en componentes/tests.
- [ ] Tests que validan strings exactos (`src/test/ladder-*.test.tsx`, `scripts/e2e-multiagent/scenarios.mjs`): ajustar fixtures si rompen.

---

## Fase 5 — Landing pública

- [ ] Reemplazar copy genérico (historia AcePlay, equipo placeholder) por contenido real del club: historia, equipo, fotos del Bloque 2.10.
- [ ] Subir fotos editoriales como assets CDN.
- [ ] Logos de partners (Bloque 2.11) en sección sponsors.
- [ ] Eliminar dominios del base si quedaron referenciados (`rg "aceplay" docs/ src/ public/`).

---

## Fase 6 — Admin inicial y QA

- [ ] Invitar al/los admin(s) del Bloque 6.1 vía Auth (magic link por defecto).
- [ ] Asignar `app_role = 'admin'` en `user_roles` para cada uno (insert directo, no exponer endpoint público).
- [ ] Si Google OAuth (4.5) está habilitado, configurar el provider en el dashboard del proyecto **el mismo turno** para evitar "Unsupported provider" en el primer login.
- [ ] **QA responsive obligatorio** en preview, en los 3 viewports: 375 (mobile), 768 (tablet), 1280 (desktop).
- [ ] **QA de flujos críticos** con el admin del club:
  - Login y onboarding (selección de deporte + nivel)
  - Reservar cancha
  - Crear desafío en la pirámide
  - Inscribirse a un torneo (si hay uno seed)
  - Solicitar partner
  - Ver perfil con rating
- [ ] `rg -i "aceplay|demo club"` en `src/`, `public/`, `index.html` → **0 resultados** en código de producto. (En `docs/remix/` sí pueden quedar referencias al base.)
- [ ] Build verde (`bun run build` lo corre automático el harness — confirmar que el último build pasó).
- [ ] Tests verdes (`bunx vitest run`).

---

## Fase 7 — Memoria del proyecto remix

Actualizar `mem://index.md` para que el nuevo agente que trabaje en este remix tenga el contexto correcto:

- [ ] Reemplazar en **Core** la línea "Base neutra: AcePlay Demo Club" por: "Proyecto del club <NOMBRE> (`<slug>`). Remix del base AcePlay."
- [ ] Reemplazar paleta y tipografía Core por los del club.
- [ ] Actualizar la regla del ladder label: cambiar el ejemplo "Pirámide" por el label real del club si difiere.
- [ ] Borrar/archivar memorias específicas que ya no aplican (p.ej. `mem://test-users` con los usuarios del base).
- [ ] Crear `mem://test-users` nuevo con los admins reales del club (Bloque 6) para futuros E2E.
- [ ] Archivar `mem://reference/aceplay-base` (opcional) con un puntero al repo base para trazabilidad.

---

## Criterios de "remix listo para publicar"

- [ ] Build verde, tests verdes
- [ ] Login del admin del club funciona end-to-end
- [ ] Sidebar, AppHeader y landing muestran branding del club (logo, colores, nombre)
- [ ] PWA instalable con ícono del club (verificar en Chrome DevTools → Application → Manifest)
- [ ] Pirámide se llama como el cliente pidió, sin código React tocado
- [ ] Solo existe 1 tenant en `tenants`
- [ ] `mem://index.md` actualizada
- [ ] Cliente probó el login y aprobó visual + flujo crítico en mobile y desktop

Cuando todo lo anterior esté `[x]`, sugerir publicación con:

```
<presentation-actions><presentation-open-publish>Publish your app</presentation-open-publish></presentation-actions>
```