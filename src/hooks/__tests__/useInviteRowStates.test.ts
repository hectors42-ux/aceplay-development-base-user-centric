import { describe, it, expect } from "vitest";
import { deriveInviteRowStates } from "@/hooks/useInviteRowStates";
import type { InvitationWithProfile } from "@/hooks/useMatchInvitations";

const NOW = new Date("2026-06-05T12:00:00.000Z").getTime();

const inv = (overrides: Partial<InvitationWithProfile>): InvitationWithProfile => ({
  id: overrides.id ?? "inv-" + Math.random().toString(36).slice(2),
  inviter_user_id: "me",
  invitee_user_id: overrides.invitee_user_id ?? "user-a",
  status: overrides.status ?? "pending",
  proposed_slots: overrides.proposed_slots ?? [],
  selected_slot: overrides.selected_slot ?? null,
  message: null,
  compat_score: null,
  expires_at: overrides.expires_at ?? new Date(NOW + 3600 * 1000).toISOString(),
  responded_at: overrides.responded_at ?? null,
  created_at: overrides.created_at ?? new Date(NOW - 60 * 1000).toISOString(),
  counterpart: null,
  ...overrides,
});

describe("deriveInviteRowStates", () => {
  it("marca pending vigente con próximo slot futuro", () => {
    const slotISO = new Date(NOW + 2 * 3600 * 1000).toISOString();
    const map = deriveInviteRowStates(
      [
        inv({
          invitee_user_id: "u1",
          status: "pending",
          proposed_slots: [
            { starts_at: new Date(NOW - 3600 * 1000).toISOString() }, // pasado
            { starts_at: slotISO },
          ],
        }),
      ],
      NOW,
    );
    const s = map.get("u1");
    expect(s?.kind).toBe("pending");
    if (s?.kind === "pending") expect(s.nextSlotISO).toBe(slotISO);
  });

  it("convierte pending vencido en expired", () => {
    const map = deriveInviteRowStates(
      [
        inv({
          invitee_user_id: "u1",
          status: "pending",
          expires_at: new Date(NOW - 1000).toISOString(),
        }),
      ],
      NOW,
    );
    expect(map.get("u1")?.kind).toBe("expired");
  });

  it("muestra accepted sólo dentro de la ventana de 24h", () => {
    const fresh = deriveInviteRowStates(
      [
        inv({
          invitee_user_id: "u1",
          status: "accepted",
          responded_at: new Date(NOW - 60 * 1000).toISOString(),
          selected_slot: { starts_at: new Date(NOW + 3600 * 1000).toISOString() },
        }),
      ],
      NOW,
    );
    expect(fresh.get("u1")?.kind).toBe("accepted");

    const stale = deriveInviteRowStates(
      [
        inv({
          invitee_user_id: "u1",
          status: "accepted",
          responded_at: new Date(NOW - 25 * 3600 * 1000).toISOString(),
        }),
      ],
      NOW,
    );
    expect(stale.get("u1")).toBeUndefined();
  });

  it("muestra rejected sólo dentro de la ventana de 12h", () => {
    const fresh = deriveInviteRowStates(
      [
        inv({
          invitee_user_id: "u1",
          status: "rejected",
          responded_at: new Date(NOW - 60 * 1000).toISOString(),
        }),
      ],
      NOW,
    );
    expect(fresh.get("u1")?.kind).toBe("rejected");

    const stale = deriveInviteRowStates(
      [
        inv({
          invitee_user_id: "u1",
          status: "rejected",
          responded_at: new Date(NOW - 13 * 3600 * 1000).toISOString(),
        }),
      ],
      NOW,
    );
    expect(stale.get("u1")).toBeUndefined();
  });

  it("ignora cancelled y mantiene sólo la más reciente por contraparte", () => {
    const map = deriveInviteRowStates(
      [
        // más reciente: rejected hace 1h
        inv({
          id: "new",
          invitee_user_id: "u1",
          status: "rejected",
          responded_at: new Date(NOW - 3600 * 1000).toISOString(),
          created_at: new Date(NOW - 2 * 3600 * 1000).toISOString(),
        }),
        // más antigua: accepted hace 2h (debe ignorarse)
        inv({
          id: "old",
          invitee_user_id: "u1",
          status: "accepted",
          responded_at: new Date(NOW - 4 * 3600 * 1000).toISOString(),
          created_at: new Date(NOW - 10 * 3600 * 1000).toISOString(),
        }),
        // cancelled de otro user
        inv({ id: "c", invitee_user_id: "u2", status: "cancelled" }),
      ],
      NOW,
    );
    expect(map.get("u1")?.kind).toBe("rejected");
    expect(map.get("u2")).toBeUndefined();
  });
});
