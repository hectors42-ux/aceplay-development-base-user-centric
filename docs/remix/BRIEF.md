# BRIEF de rebranding — preguntas para el desarrollador del club nuevo

El agente debe preguntar **bloque por bloque**, no todo de golpe. Para cada pregunta indica:
- **(obligatorio)** o **(opcional)**: si bloquea o no el avance.
- Formato esperado.
- Dónde se usará la respuesta (archivo/tabla).

Si el desarrollador no sabe una respuesta, usar los **defaults marcados con ⟂** y dejar el ítem en backlog.

---

## Bloque 1 — Identidad del club  *(obligatorio antes de tocar nada)*

| # | Pregunta | Formato | Usa en |
|---|---|---|---|
| 1.1 | Nombre legal completo del club | texto | `tenants.name` |
| 1.2 | Nombre corto / display (shortName, ≤12 chars, cabe en sidebar) | texto | `tenants.short_name`, `ClubBrandProvider.ACEPLAY_FALLBACK.shortName` |
| 1.3 | Slug del tenant (kebab-case, único, ej. `stade-francais`) | string | `tenants.slug` |
| 1.4 | País / ciudad / dirección | texto | landing, legales |
| 1.5 | RUT o equivalente fiscal | texto | facturación, legales |
| 1.6 | Web pública, email de contacto, teléfono | strings | landing, footer |
| 1.7 | Idioma y moneda ⟂ es-CL / CLP | enum | i18n, formato de precios |
| 1.8 | Label de la pirámide ⟂ "Pirámide" — ej: "Staderilla", "Escalera", "Top Liga" | texto | `tenants.ladder_label` (consumido vía `useLadderLabel()`) |
| 1.9 | Deportes activos ⟂ tenis + pádel | `tenis` / `padel` / `ambos` | onboarding, switcher, ranking |
| 1.10 | Año de fundación (opcional, para landing) | número | landing "historia" |

**No avanzar al Bloque 2 hasta tener 1.1 a 1.9.**

---

## Bloque 2 — Branding *(con adjuntos)*

Pedir los archivos como uploads en el chat. Cada adjunto se sube al CDN vía `lovable-assets create` y se referencia desde un `.asset.json`.

| # | Pregunta / Adjunto | Formato | Usa en |
|---|---|---|---|
| 2.1 | **Logo wordmark** (versión para fondo claro) | PNG/SVG, ≥1024px ancho, fondo transparente | `src/assets/brand/wordmark-primary.png.asset.json`, `tenants.logo_url` |
| 2.2 | Logo wordmark (versión para fondo oscuro) | PNG/SVG | `src/assets/brand/wordmark-reverse.png.asset.json` |
| 2.3 | Arc-mark / isotipo (símbolo sin texto) | PNG/SVG cuadrado | `src/assets/brand/mark-arc-primary.png.asset.json` (+ `mark-arc-ink`, `mark-arc-reverse`) |
| 2.4 | **App icon PWA** | PNG cuadrado ≥512px | `public/icon-512.png`, `icon-192.png`, `apple-touch-icon.png`, `favicon.png` |
| 2.5 | Lockup horizontal y stacked (opcional) | PNG | `src/assets/brand/lockup-horizontal.png.asset.json`, `lockup-stacked.png.asset.json` |
| 2.6 | Hero arcilla / cancha dura / césped — 1 por tema ⟂ usar heros del base si no hay | PNG/JPG ≥1024px | `src/assets/brand/hero-terre-battue.png.asset.json`, `hero-us-open.png.asset.json`, `hero-wimbledon.png.asset.json` |
| 2.7 | **Paleta de marca** — primary, primary-glow, primary-deep, accent(s), fondo, texto | HEX (preferido) o "saca los colores del logo" | `src/index.css` (HSL), `tailwind.config.ts`, `tenants.brand_primary*` |
| 2.8 | Tipografía display + body ⟂ Cormorant Garamond + DM Sans + DM Mono | Google Fonts o adjuntar WOFF2 | `index.html`, `tailwind.config.ts` |
| 2.9 | Tagline ⟂ "Tennis, gamified." | texto corto | landing hero, OG description |
| 2.10 | Fotos editoriales del club (opcional, para landing) | JPG/PNG | landing |
| 2.11 | Logos de partners / sponsors (opcional) | PNG/SVG fondo transparente | landing sección partners |

---

## Bloque 3 — Estructura operativa

| # | Pregunta | Formato | Usa en |
|---|---|---|---|
| 3.1 | Lista de canchas: nombre, superficie (arcilla/dura/césped/sintético), indoor/outdoor, horario | tabla | tabla `courts` |
| 3.2 | Categorías de socios (titular, junior, honorario, etc.) | lista | tabla `categories` |
| 3.3 | Reglas de cuotas y estados (al_día / pendiente / moroso) | texto | `profiles.dues_status`, gating |
| 3.4 | Reglas de reserva: anticipación máxima (días), duración de slot (min), cupos simultáneos por socio, costo invitado | tabla | tabla `bookings_rules` / config |
| 3.5 | Coaches iniciales: nombre, email, especialidad ⟂ vacío | tabla | seed `coaches` + invitación |
| 3.6 | Pirámide inicial: ¿sembrar con socios reales (adjuntar CSV) o partir vacía? ⟂ vacía | CSV o "vacía" | tabla `ladder_positions` |
| 3.7 | Torneos activos a migrar (opcional) | descripción | tabla `tournaments` |

---

## Bloque 4 — Integraciones y dominios

| # | Pregunta | Formato | Usa en |
|---|---|---|---|
| 4.1 | Dominio definitivo de la PWA (ej. `app.stadefrancais.cl`) ⟂ subdominio Lovable | hostname | publicación, manifest, OG |
| 4.2 | Pasarela de pago ⟂ Webpay stub (modo demo) | enum: `webpay-stub` / `webpay-prod` / `none` | si `webpay-prod`, pedir credenciales vía secret manager |
| 4.3 | Proveedor externo de reservas (si el club ya usa uno y quiere link-out) ⟂ ninguno | URL | `BookingsProviderCard`, `ExternalBookingCTA` |
| 4.4 | Email transaccional: dominio del remitente y proveedor SMTP (Resend, etc.) | dominio + API key vía secret | edge functions de notificaciones |
| 4.5 | Google OAuth ⟂ habilitado | sí/no | config auth providers |

---

## Bloque 5 — Documentos legales *(adjuntar)*

| # | Adjunto | Formato | Usa en |
|---|---|---|---|
| 5.1 | Términos y Condiciones | PDF, MD o texto plano | `legal_documents` kind `terms`, scoped al tenant |
| 5.2 | Política de Privacidad | PDF/MD/texto | `legal_documents` kind `privacy` |
| 5.3 | Reglamento interno del club (opcional) | PDF/MD/texto | `legal_documents` kind `rules` |
| 5.4 | Política de cookies (opcional) | PDF/MD/texto | `legal_documents` kind `cookies` |

Si no se entregan, dejar los documentos globales del base (`tenant_id = null`) hasta que el cliente envíe los suyos.

---

## Bloque 6 — Usuarios admin iniciales *(obligatorio antes de publicar)*

| # | Pregunta | Formato | Usa en |
|---|---|---|---|
| 6.1 | Email + nombre del/los admin(s) del club que deben poder loguearse el día 1 | lista | invitación + `user_roles.role = 'admin'` |
| 6.2 | ¿Sembrar también un usuario de prueba (player) para QA del cliente? ⟂ sí | sí/no | seed E2E |
| 6.3 | Método de login inicial: magic link, password temporal, o Google OAuth | enum | flujo de invitación |

---

## Resumen del estado del BRIEF

Al cerrar cada bloque, el agente debe responder con un bloque tipo:

```
✅ Bloque 1 completo — Stade Français / `stade-francais` / es-CL / CLP / label "Staderilla" / tenis+pádel
⏳ Bloque 2 — esperando: arc-mark (2.3), heros (2.6 — opcional, ¿usamos los del base?)
```

Esto le da visibilidad al desarrollador de qué falta antes de generar el plan.