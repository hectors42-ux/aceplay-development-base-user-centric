# AcePlay · Brand Foundation V3 · Definitive

Esta carpeta contiene la propuesta definitiva de marca para AcePlay.

## Estructura

```
foundation-v3/
├── index.html        ← Brand book HTML (long-scroll)
├── svg/              ← Fuentes vectoriales · 12 SVG
├── png/              ← Rasterizados hi-res · 12 PNG
└── README.md
```

## La propuesta

**The Mark: "The Serve"** — un único arco ascendente que termina en un punto.
Refiere a la trayectoria de un saque perfecto, a una progresión, a un level-up.

**The Wordmark: AcePlay** — Cormorant Garamond, Ace upright, Play italic.
La tensión entre disciplina (Ace, roman) y juego (Play, italic) es el ADN de la marca.

**The Tagline:** *Tennis, gamified.*

## Sistema

- Mark = el arco (primario) o la letra A en Cormorant (monograma, app icon)
- Wordmark = Cormorant Garamond Ace + italic Play
- Tagline = DM Mono all caps, 0.32em tracking
- 3 paletas conectadas con el ThemeContext de la app: Terre Battue (primario), US Open (seasonal), Wimbledon (seasonal)

## Tipografía

| Rol | Familia | Pesos |
|-----|---------|-------|
| Display · Wordmark · Headlines | Cormorant Garamond | 500–700, Roman & Italic |
| UI · Body · Buttons | DM Sans | 400 / 500 / 600 / 700 |
| Data · Eyebrows · Scoreboards | DM Mono | 400 / 500 ALL CAPS |

## Archivos clave

- `svg/v3-mark-arc-primary.svg` — el mark principal (vector)
- `svg/v3-wordmark-primary.svg` — wordmark
- `svg/v3-lockup-horizontal.svg` — lockup completo + tagline
- `svg/v3-app-icon-light.svg` — app icon iOS/Android (clay squircle)
- `svg/v3-app-icon-letter.svg` — app icon alternativo (A Cormorant)
- `svg/v3-hero.svg` — composición hero para portadas

## Próximos pasos sugeridos

1. **Aplicación en la app**: usar `v3-mark-arc-primary.svg` como logo del header, `v3-app-icon-light.svg` como icon en PWA manifest.
2. **Material comercial**: lockup horizontal en email/firma, hero composition en presentación.
3. **Versiones por tema**: rasterizar variantes en US Open / Wimbledon cuando se necesiten para ediciones.
4. **Motion**: el arco puede animarse con `stroke-dashoffset` para splash screens y videos.
