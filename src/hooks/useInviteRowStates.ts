import { useMemo } from "react";
import { useMatchInvitations, type InvitationWithProfile } from "./useMatchInvitations";

export type InviteRowState =
  | { kind: "pending"; nextSlotISO?: string; expiresAt: string }
  | { kind: "accepted"; selectedSlotISO?: string; respondedAt: string }
  | { kind: "rejected"; respondedAt: string }
  | { kind: "expired" };

const ACCEPTED_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const REJECTED_WINDOW_MS = 12 * 60 * 60 * 1000; // 12h

/**
 * Deriva un mapa user_id → estado de invitación enviada por el usuario actual.
 * Considera sólo la invitación más reciente por contraparte y aplica ventanas
 * de visibilidad para los estados terminales (accepted/rejected).
 *
 * Exportado para poder testearlo sin React.
 */
export const deriveInviteRowStates = (
  sent: InvitationWithProfile[],
  now: number = Date.now(),
): Map<string, InviteRowState> => {
  const map = new Map<string, InviteRowState>();
  // Tomar la más reciente por invitee (sent ya viene ordenado por created_at desc desde el hook).
  const latestByInvitee = new Map<string, InvitationWithProfile>();
  for (const inv of sent) {
    if (!latestByInvitee.has(inv.invitee_user_id)) {
      latestByInvitee.set(inv.invitee_user_id, inv);
    }
  }

  for (const [userId, inv] of latestByInvitee) {
    const expiresAtMs = new Date(inv.expires_at).getTime();
    const respondedAtMs = inv.responded_at ? new Date(inv.responded_at).getTime() : 0;

    if (inv.status === "pending") {
      if (expiresAtMs > now) {
        // próximo slot futuro
        const nextSlot = (inv.proposed_slots ?? [])
          .map((s) => s.starts_at)
          .filter(Boolean)
          .map((iso) => ({ iso, t: new Date(iso).getTime() }))
          .filter((x) => x.t > now)
          .sort((a, b) => a.t - b.t)[0]?.iso;
        map.set(userId, { kind: "pending", nextSlotISO: nextSlot, expiresAt: inv.expires_at });
      } else {
        map.set(userId, { kind: "expired" });
      }
      continue;
    }

    if (inv.status === "accepted" && respondedAtMs && now - respondedAtMs < ACCEPTED_WINDOW_MS) {
      const selected = inv.selected_slot?.starts_at ?? undefined;
      map.set(userId, {
        kind: "accepted",
        selectedSlotISO: selected,
        respondedAt: inv.responded_at!,
      });
      continue;
    }

    if (inv.status === "rejected" && respondedAtMs && now - respondedAtMs < REJECTED_WINDOW_MS) {
      map.set(userId, { kind: "rejected", respondedAt: inv.responded_at! });
      continue;
    }

    // 'expired' (status enum) o 'cancelled' o ventanas vencidas → no se muestran.
  }

  return map;
};

/**
 * Hook React: devuelve el mapa derivado de invitaciones enviadas.
 * Reutiliza `useMatchInvitations` (que ya tiene realtime + debounce).
 */
export const useInviteRowStates = (): Map<string, InviteRowState> => {
  const { sent } = useMatchInvitations();
  return useMemo(() => deriveInviteRowStates(sent), [sent]);
};
