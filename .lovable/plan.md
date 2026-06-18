## Restaurar look & feel Clay sobre player-first

100% presentación. No toco backend, schema, RLS, motor ni queries existentes (`space`/`space_membership`/`profiles`). Solo recableo de UI.

### 1. Design system (verificar, no rehacer)
- `src/index.css` ya tiene la paleta Clay V3 completa (clay/cream/ink/olive, gradientes, sombras, `--font-display` Cormorant). Verifico que `tailwind.config.ts` expone los tokens necesarios; si faltan utilidades (`shadow-clay`, `bg-gradient-clay`, colores `cream/ink/clay/olive` semánticos), las agrego en `tailwind.config.ts` mapeadas a las vars CSS ya definidas.
- `index.html`: agregar `<link>` a Google Fonts para Cormorant Garamond (display) + DM Sans (sans) si no están cargadas.

### 2. AppShell rico
Reemplazo `src/components/AppShell.tsx` por una versión con:
- Fondo `bg-background` (crema) en toda la app.
- Header sticky crema con sombra suave, wordmark "AcePlay" en `font-display` clay + arc-mark simple (SVG inline).
- Bottom nav con 5 items: **Inicio** (`/`), **Compite** (`/compite`), **Descubrir** (`/descubrir`), **Reserva** (`/reserva`, placeholder), **Perfil** (`/perfil`). Activo en clay con pill de fondo `bg-primary/10`, íconos lucide.
- Layout mobile-first; en `md+` ancho ampliado.

Ajusto `src/App.tsx`: ruta `/` ahora es **Inicio**, Compite se mueve a `/compite`. Agrego rutas placeholder `/reserva` y `/torneos` (componente "Próximamente" estilizado).

### 3. Componentes de presentación
- **`SpaceCard`** (rehago `src/components/SpaceCard.tsx`): tarjeta con `rounded-2xl`, borde clay sutil, gradiente crema→clay/5 en hover, `name` en `font-display text-lg`, badge `type` (Club/Torneo/Escalerilla/Liga/Categoría) en clay, badge `role` (owner/admin/organizer) en olive, ícono de deporte (tennis/padel) lucide, sport en `text-mono uppercase tracking-wider`.
- **`Badge` variants Clay** (ya existe shadcn badge; añado variantes `clay`, `olive`, `outline-clay` vía `cva`).
- **`EmptyState`** (`src/components/EmptyState.tsx`): ícono grande en círculo clay/10, título display, copy cálido es-CL, CTA opcional. Reemplaza los "Aún no participas…" pelados.
- **`SectionHeader`** (`src/components/SectionHeader.tsx`): eyebrow mono uppercase + título display, opcional acción a la derecha.

### 4. Pantallas fase 1 (solo piel)
Sin tocar la lógica de datos ni los hooks/queries:
- **`Login`**: fondo con gradiente clay sutil, card cream con sombra, wordmark grande en display, tagline "Tennis, gamified.", botón Google con ícono, separador "o", input + botón magic link estilizados.
- **`Onboarding`**: layout con eyebrow + título display por sección, inputs cream, bloque de consentimiento Ley 21.719 en card destacada con borde clay y copy cálido.
- **`Compite`** (`/compite`): header con saludo `Hola, {display_name}` + subtítulo, secciones agrupadas con `SectionHeader` por tipo, grid de `SpaceCard`. `EmptyState` cuando no hay membresías.
- **`Space`**: header con gradiente clay, nombre en display XL, badges type/visibility/sport, tabs estilizados (Participantes/Info), lista de participantes con avatares h-10 + fila propia con anillo clay.
- **`Descubrir`**: buscador con ícono lupa, grid de `SpaceCard` con `JoinButton` integrado, `EmptyState` cuando no hay resultados.
- **`Perfil`**: header con avatar grande (h-20) + display_name en font-display + handle muted, secciones cards (Datos, Privacidad, Sesión), toggles tematizados, botón "Cerrar sesión" destructive outline.

### 5. Pantalla Inicio nueva (`/`)
`src/pages/Inicio.tsx` cableada al core nuevo:
- Hero: saludo "Buen día, {display_name}" en display + avatar a la derecha.
- Card resumen: count de `space_membership` activas (query existente reutilizada), CTA "Ver mis competencias" → `/compite`.
- Sección "Tus competencias" (top 3 SpaceCards desde la misma query, `slice(0,3)`), link "Ver todas".
- Card "Tu nivel" (placeholder elegante con skeleton-teaser, copy "Pronto verás tu rating cuando juegues tu primer partido oficial." — sin datos inventados).
- Card "Próximos partidos" (placeholder vacío con ícono calendar, copy "Aún no tienes partidos agendados.").

### 6. Rutas placeholder
`src/pages/ComingSoon.tsx` reutilizable para `/reserva` y `/torneos`: ícono grande, título display, copy "Estamos trabajando en esto. Vuelve pronto.", link a Inicio.

### Reglas que respeto
- Cero referencias a `tenant_id`/`tournaments`/`tournament_registrations` o tablas viejas.
- No restauro pantallas admin viejas.
- No invento rating/puntos/Fichas — solo teasers.
- No toco RLS, helpers, schema, edge functions.
- Mobile-first; QA visual en 375/768/1280 antes de cerrar.

### Archivos
- Editar: `tailwind.config.ts`, `index.html`, `src/App.tsx`, `src/components/AppShell.tsx`, `src/components/SpaceCard.tsx`, `src/components/ui/badge.tsx`, `src/pages/{Login,Onboarding,Compite,Descubrir,Space,Perfil}.tsx`.
- Crear: `src/pages/Inicio.tsx`, `src/pages/ComingSoon.tsx`, `src/components/EmptyState.tsx`, `src/components/SectionHeader.tsx`.

### Criterios de aceptación
Los 7 del prompt: app se ve Clay, nav y header estilizados, SpaceCard rica, Login/Onboarding cuidados, Inicio dashboard del jugador, modelo player-first intacto, app compila.
