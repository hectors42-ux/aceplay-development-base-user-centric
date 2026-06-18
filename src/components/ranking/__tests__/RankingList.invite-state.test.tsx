import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RankingList } from "@/components/ranking/RankingList";
import type { ClubRankingRow } from "@/hooks/useClubRanking";
import type { InviteRowState } from "@/hooks/useInviteRowStates";

const mkRow = (overrides: Partial<ClubRankingRow> = {}): ClubRankingRow =>
  ({
    user_id: "u1",
    first_name: "Ana",
    last_name: "Pérez",
    avatar_url: null,
    rank_position: 5,
    prev_rank_position: 5,
    level: 4.5,
    matches_played: 10,
    reliability: 80,
    streak: 0,
    category: "A",
    ...overrides,
  }) as ClubRankingRow;

const renderList = (
  rows: ClubRankingRow[],
  opts: {
    onInvite?: (row: ClubRankingRow) => void;
    states?: Map<string, InviteRowState>;
    currentUserId?: string;
  } = {},
) =>
  render(
    <TooltipProvider>
      <RankingList
        rows={rows}
        currentUserId={opts.currentUserId}
        onInvite={opts.onInvite ?? vi.fn()}
        inviteStateByUserId={opts.states}
      />
    </TooltipProvider>,
  );

describe("RankingList · InviteRowAction integration", () => {
  it("sin estado: muestra botón Send habilitado y dispara onInvite", () => {
    const onInvite = vi.fn();
    renderList([mkRow()], { onInvite });
    const btn = screen.getByRole("button", { name: /invitar a jugar a ana/i });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onInvite).toHaveBeenCalledTimes(1);
  });

  it("pending: pill 'Pendiente' visible y no dispara onInvite", () => {
    const onInvite = vi.fn();
    const states = new Map<string, InviteRowState>([
      [
        "u1",
        {
          kind: "pending",
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
          nextSlotISO: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        },
      ],
    ]);
    renderList([mkRow()], { onInvite, states });
    expect(screen.getByText(/pendiente/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /invitación pendiente con ana/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onInvite).not.toHaveBeenCalled();
  });

  it("expired: pill 'Expirada' clickable que reintenta la invitación", () => {
    const onInvite = vi.fn();
    const states = new Map<string, InviteRowState>([["u1", { kind: "expired" }]]);
    renderList([mkRow()], { onInvite, states });
    const btn = screen.getByRole("button", { name: /expirada.*volver a invitar/i });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onInvite).toHaveBeenCalledTimes(1);
  });

  it("accepted: pill 'Aceptada' deshabilitada (sólo informativa)", () => {
    const onInvite = vi.fn();
    const states = new Map<string, InviteRowState>([
      [
        "u1",
        {
          kind: "accepted",
          respondedAt: new Date().toISOString(),
          selectedSlotISO: new Date(Date.now() + 3600 * 1000).toISOString(),
        },
      ],
    ]);
    renderList([mkRow()], { onInvite, states });
    expect(screen.getByText(/aceptada/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /ana aceptó tu invitación/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onInvite).not.toHaveBeenCalled();
  });

  it("rejected: pill 'Rechazada' permite reintentar", () => {
    const onInvite = vi.fn();
    const states = new Map<string, InviteRowState>([
      ["u1", { kind: "rejected", respondedAt: new Date().toISOString() }],
    ]);
    renderList([mkRow()], { onInvite, states });
    const btn = screen.getByRole("button", { name: /rechazó tu invitación.*volver a invitar/i });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onInvite).toHaveBeenCalledTimes(1);
  });

  it("la fila propia nunca muestra acción de invitación", () => {
    const states = new Map<string, InviteRowState>([
      ["u1", { kind: "pending", expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() }],
    ]);
    renderList([mkRow()], { currentUserId: "u1", states });
    expect(screen.queryByText(/pendiente/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /invitar a jugar/i }),
    ).not.toBeInTheDocument();
  });
});
