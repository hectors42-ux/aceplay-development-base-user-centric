# AcePlay · Handoff de diseño para Claude Code

**Por qué seguías viendo heros y botones del pasado:** los prompts A–L eran instrucciones de
texto. Sin el CSS real ni las imágenes de referencia EN EL REPO, Claude Code reprodujo su propia
interpretación. Claude Code **no puede ver las imágenes del chat de diseño** — solo ve archivos.
Este paquete corrige eso: son los **artefactos reales**, para commitear y referenciar.

## Cómo darle acceso (3 pasos)

1. **Copia esta carpeta al repo**, por ejemplo en `docs/design/`:
   ```
   docs/design/
     tokens/aceplay-arena.css      ← FUENTE DE VERDAD de tokens/clases (colores, glass, nav, hero)
     reference/*.png               ← capturas objetivo de cada pantalla
     README.md                     ← este archivo
   ```
2. **Commitea y pushea.** A partir de ahí las imágenes y el CSS viven en el repo.
3. **Apunta a Claude Code** con un prompt como:
   > "Lee `docs/design/tokens/aceplay-arena.css` y las imágenes en `docs/design/reference/`.
   > Son la verdad visual. Ajusta los componentes para que el resultado coincida pixel-a-pixel:
   > mismos tokens de color, el HERO de categoría (anillo volt + insignia), los botones (naranja
   > AcePlay #EC6E2E con la rampa exacta), y las barras Liquid Glass (header + nav-burbuja).
   > Reemplaza cualquier hero/botón antiguo que no coincida."

## Qué es la fuente de verdad

- **`tokens/aceplay-arena.css`** manda. Si un valor del repo difiere, se alinea a este archivo:
  - Naranja AcePlay (marca + CTA): `--clay` / `--crimson` = **#EC6E2E** (glow #FF8A4D, deep #B8521C / #C2541C).
  - Skill/XP volt **#C6FF1A** · Fichas oro **#FFC53D** · info azul **#6E86FF** · verde **#2BD17E**.
  - Liquid Glass: `--glass-bg/-brd/-hi` + clases `.hud` (header) y `.nav` (burbuja) — valores exactos.
  - Hero de categoría: clase `.arena` (gradiente `--arena-grad` + anillo `.ring`).
  - Temas de superficie: bloques `[data-theme="cement|clay|grass"]` + modo estacional.
- **`reference/*.png`** son el objetivo visual por pantalla.

## Checklist de homologación (pídele a Code que lo verifique)

- [ ] Ningún `#FF234A` / rojo de CTA: todo botón primario usa **#EC6E2E**.
- [ ] El hero de Inicio es el `.arena` (anillo volt + "TERCERA" + camino 7 pasos), no un card viejo.
- [ ] Header y bottom-nav son **Liquid Glass** flotante (no barras sólidas pegadas al borde).
- [ ] Las barras quedan FIJAS y solo el contenido central scrollea.
- [ ] El cristal se tinta por tema (Arena/Cemento/Arcilla/Pasto).
- [ ] FAB Desafío naranja sobresaliendo de la nav.

> Nota: `aceplay-arena.css` usa clases propias (`.arena`, `.hud`, `.nav`, `.btn.crimson`…). En el
> repo (Tailwind + shadcn) tradúcelas a tu sistema, pero **conserva los valores exactos** (hex,
> blur, radius, sombras). Es más fiable copiar los valores que “interpretar” el look.
