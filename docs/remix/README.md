# Kit de Remix — AcePlay → Club nuevo

Este directorio contiene todo lo necesario para convertir un **remix** del proyecto base AcePlay en un club real (Stade Français, Providencia, etc.) sin reinventar el proceso.

## ¿Qué es AcePlay base?

- Proyecto Lovable neutro con tenant único `aceplay-demo` ("AcePlay Demo Club").
- Branding V3: clay `#b6502b` / cream `#f8f6f2` / ink `#2b1b12`, tipografía Cormorant Garamond + DM Sans + DM Mono, tagline _"Tennis, gamified."_
- Stack: React + Vite + Tailwind + Lovable Cloud (Supabase) con RLS por `tenant_id`.
- Todas las features (reservas, pirámide, torneos, partner, clases, analytics, legales) ya están construidas y parametrizadas por tenant.

## ¿Qué es un remix?

Un fork del repo + una BD Lovable Cloud **nueva** (no compartida con el base). El objetivo del rebranding es:

1. Dejar **un solo tenant** en `tenants` con la identidad del club real.
2. Reemplazar assets de marca (logo, ícono PWA, heros) en el CDN.
3. Ajustar tokens de color/tipografía y strings hardcoded.
4. Sembrar canchas, categorías, coaches, legales y admin(s) iniciales.
5. QA en mobile (375) / tablet (768) / desktop (1280) y publicar.

No se toca lógica de negocio. Si el rebranding "necesita" tocar features, primero se discute si va al base o se mantiene como divergencia del remix.

## Cómo usar este kit

1. Crea el remix desde el proyecto base AcePlay (botón Remix). Esto te da repo + BD nuevos.
2. Abre el nuevo proyecto y verifica que `docs/remix/` viajó con el remix (este README incluido).
3. En el **primer mensaje** al agente Lovable, pega el bloque PROMPT INICIAL de abajo (o el contenido de `PROMPT.md`).
4. El agente leerá `BRIEF.md` y empezará a preguntar bloque por bloque. Responde con texto + adjuntos según pida.
5. Cuando tenga Bloque 1 + adjuntos de Bloque 2 listos, el agente generará el **plan de rebranding** siguiendo `CHECKLIST.md`.
6. Apruebas el plan y el agente lo ejecuta fase por fase. Al cerrar cada fase, marca los `[ ]` del checklist.

## PROMPT INICIAL (copy-paste en el primer mensaje del remix)

```
Hola. Este proyecto es un remix del base AcePlay y vamos a rebrandearlo para
un club real. Antes de tocar código:

1. Lee `docs/remix/README.md`, `docs/remix/BRIEF.md` y `docs/remix/CHECKLIST.md`.
2. Pregúntame las preguntas del **Bloque 1 — Identidad del club** del BRIEF,
   una por una, sin avanzar al Bloque 2 hasta tenerlas todas respondidas.
3. Luego pídeme los adjuntos del **Bloque 2 — Branding** (logo, ícono PWA,
   heros opcionales) y la paleta/tipografía.
4. Con Bloques 1 y 2 completos, propón un plan siguiendo el orden de fases
   de CHECKLIST.md. Bloques 3-6 los preguntas durante la ejecución del plan,
   en el momento que correspondan a cada fase.
5. No edites nada hasta que apruebe el plan.

Memoria del proyecto (`mem://index.md`) describe la base AcePlay; cuando el
rebranding esté listo, actualízala con los datos del club nuevo (Fase 7).
```

## Archivos del kit

| Archivo | Para qué sirve |
|---|---|
| `README.md` | Este documento. Punto de entrada. |
| `PROMPT.md` | Solo el bloque copy-paste anterior, aislado. |
| `BRIEF.md` | Cuestionario al desarrollador, en 6 bloques. |
| `CHECKLIST.md` | Pasos técnicos para el agente, ordenados por fase. |

## Fuera de alcance del kit

- No hay wizard automático ni edge function de provisioning. Es un flujo agente + humano.
- No se proveen migrations parametrizadas; el agente escribe la migration de Fase 1 usando las respuestas del Bloque 1 como input.
- No cubre features nuevas — solo rebranding y seed inicial.