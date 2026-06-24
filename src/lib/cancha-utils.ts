// Utilidades de presentación de la sección Cancha. SOLO cálculo de display
// (match% de Zona, razón del match, slots referenciales, formato de fecha).
// No tocan el motor: el match% es el mismo criterio que suggest_partners (banda
// de win-prob 35–65% ≈ ±108 de rating; 1 nivel = 100 de rating).

export const matchPct = (myNivel?: number | null, theirNivel?: number | null): number => {
  if (myNivel == null || theirNivel == null) return 0;
  const dRating = Math.abs(myNivel - theirNivel) * 100;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - dRating / 108))));
};

// "Por qué" del match: nivel parejo + proximidad real disponible (espacio en común).
export const partnerReason = (sharedSpaceName?: string | null): string =>
  sharedSpaceName ? `Nivel parejo · ${sharedSpaceName}` : "Nivel parejo · tu Zona";

// Fecha/hora legible para slots (referenciales). Hoy/Ayer/EEE d MMM HH:mm.
export const formatSlot = (iso: string | null | undefined): string => {
  if (!iso) return "por coordinar";
  const d = new Date(iso);
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Hoy ${time}`;
  if (d.toDateString() === yest.toDateString()) return `Ayer ${time}`;
  return `${d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })} ${time}`;
};

// Slots referenciales sugeridos: próximos días en horarios habituales.
export interface SlotPreset {
  iso: string;
  label: string;
}
export const buildSlotPresets = (): SlotPreset[] => {
  const now = new Date();
  const times = [18, 19, 10];
  const out: SlotPreset[] = [];
  for (let day = 1; day <= 3 && out.length < 6; day++) {
    for (const h of times) {
      if (out.length >= 6) break;
      const dt = new Date(now);
      dt.setDate(now.getDate() + day);
      dt.setHours(h, 0, 0, 0);
      out.push({
        iso: dt.toISOString(),
        label: `${dt.toLocaleDateString("es-CL", { weekday: "short" })} ${String(h).padStart(2, "0")}:00`,
      });
    }
  }
  return out;
};
