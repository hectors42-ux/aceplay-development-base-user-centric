# Contrato visual: Player Row

Toda tarjeta que muestre **un socio/jugador** (Buscar, Invitaciones, Retos, Pirámide, Ranking) debe seguir este patrón. Es la "fuente de verdad" para QA y futuros cambios.

Referencia maestra: `src/components/ranking/RankingList.tsx`.

## Reglas

| Elemento | Clases obligatorias |
|---|---|
| Avatar | `h-9 w-9 shrink-0` |
| Avatar fallback | `text-[11px]` |
| Nombre | `truncate text-sm font-medium` (sans, **no** `font-display`) |
| Línea secundaria (texto) | `text-[10px] text-muted-foreground` |
| Badge categoría / estado / motivo | `h-4 rounded-md px-1.5 text-[9px] font-semibold` |
| Contadores (ej. "33 partidos") | `text-[10px] text-muted-foreground` |
| Indicador numérico lateral (#pos, score) | `font-display text-sm font-bold leading-none` |
| Gap entre avatar y contenido | `gap-2.5` o `gap-3` |
| Borde tarjeta (default) | `rounded-2xl border border-border bg-card shadow-card` |

## Componentes que cumplen este contrato

- `RankingList` — referencia
- `SuggestedRivalCard` (pirámide)
- `PartnerCard` (sugeridos disponibles)
- `InvitationItem` (invitaciones recibidas/enviadas)
- `OpenChallengeCard` (retos abiertos)

## Checklist al modificar

- [ ] Avatar sigue siendo `h-9 w-9`
- [ ] Nombre usa `text-sm font-medium` sans
- [ ] Línea secundaria `text-[10px]`
- [ ] Badges `h-4 text-[9px] font-semibold`
- [ ] No introducir `font-display` en el nombre
- [ ] QA en mobile (390), tablet (768), desktop (1280)
- [ ] Correr `bunx vitest run player-row-contract`
