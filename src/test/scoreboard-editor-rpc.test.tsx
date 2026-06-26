/**
 * E2E del ScoreboardEditor en los 3 diálogos de carga de resultado.
 *
 * Verifica que cargar un marcador "6-4 6-3" desde el editor visual
 * dispare la RPC correcta para:
 *   1. Torneos     → submit_match_result
 *   2. Amistosos   → submit_partner_match_result
 *   3. Pirámide    → submit_ladder_result
 *
 * Asegura además que:
 *   - el editor infiere automáticamente el ganador (no requiere clic manual)
 *   - el payload incluye los 2 sets en orden y los flags walkover/retired correctos
 *   - el orden de los sets se invierte para Pirámide cuando el usuario es el "desafiado"
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

// ---------- Mocks compartidos ----------
type RpcCall = { name: string; args: any };
const rpcCalls: RpcCall[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: { status: "propuesto" }, error: null });
    },
  },
}));

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...a: unknown[]) => toastMock(...a),
  useToast: () => ({ toast: toastMock }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(
    (...a: unknown[]) => toastMock(...a),
    {
      success: (...a: unknown[]) => toastMock("success", ...a),
      error: (...a: unknown[]) => toastMock("error", ...a),
    },
  ),
}));

let currentUser = { id: "user-me" };
let currentProfile: any = { first_name: "Yo", last_name: "Demo", avatar_url: null };
vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: currentUser, profile: currentProfile }),
}));

// Importar tras los mocks
import { ResultDialog } from "@/components/tournaments/ResultDialog";
import { PartnerMatchResultDialog } from "@/components/partner/PartnerMatchResultDialog";
import { LadderResultDialog } from "@/components/ladder/LadderResultDialog";
import type { Match, Registration, Player } from "@/hooks/useCategoryData";
import type { ChallengeRow, ProfileLite } from "@/hooks/useLadderData";

// ---------- Helpers ----------
/**
 * Llena los inputs del ScoreboardEditor con un marcador 6-4 6-3 desde la
 * perspectiva de `meName` (gana el dueño del editor).
 */
function fillTwoSetWin(meName: string, opponentName: string) {
  const setMe = (idx: number, val: string) =>
    fireEvent.change(screen.getByLabelText(new RegExp(`^Set ${idx} ${meName}$`)), {
      target: { value: val },
    });
  const setOpp = (idx: number, val: string) =>
    fireEvent.change(screen.getByLabelText(new RegExp(`^Set ${idx} ${opponentName}$`)), {
      target: { value: val },
    });
  setMe(1, "6");
  setOpp(1, "4");
  setMe(2, "6");
  setOpp(2, "3");
}

beforeEach(() => {
  rpcCalls.length = 0;
  toastMock.mockClear();
  currentUser = { id: "user-me" };
  currentProfile = { first_name: "Yo", last_name: "Demo", avatar_url: null };
  cleanup();
});

// =====================================================================
// 1. TORNEOS — RPC vivo por quién carga (submit_match_result está MUERTA):
//    jugador del partido → play_bracket_match · organizador → org_record_bracket_result
// =====================================================================

describe("ScoreboardEditor · Torneos", () => {
  const players = new Map<string, Player>([
    ["user-a", { user_id: "user-a", first_name: "Ana", last_name: "Pérez" } as Player],
    ["user-b", { user_id: "user-b", first_name: "Bruno", last_name: "Soto" } as Player],
  ]);
  const regA = {
    id: "reg-a",
    tournament_id: "tour-1",
    tournament_category_id: "cat-1",
    player1_user_id: "user-a",
    player2_user_id: null,
    status: "confirmada",
  } as unknown as Registration;
  const regB = {
    id: "reg-b",
    tournament_id: "tour-1",
    tournament_category_id: "cat-1",
    player1_user_id: "user-b",
    player2_user_id: null,
    status: "confirmada",
  } as unknown as Registration;
  const match: Match = {
    id: "match-1",
    registration_a_id: "reg-a",
    registration_b_id: "reg-b",
    status: "pendiente",
  } as unknown as Match;

  it("jugador del partido: 6-4 6-3 llama play_bracket_match (slot + winner_is_me + sets vivos)", async () => {
    currentUser = { id: "user-a" }; // el ganador es Ana (user-a) → es jugador y ganó
    render(
      <ResultDialog open onOpenChange={vi.fn()} match={match} registrations={[regA, regB]} players={players} onSubmitted={vi.fn()} />,
    );
    fillTwoSetWin("Ana Pérez", "Bruno Soto");
    fireEvent.click(screen.getByRole("button", { name: /Enviar resultado/i }));

    await waitFor(() => {
      const call = rpcCalls.find((c) => c.name === "play_bracket_match");
      expect(call).toBeTruthy();
      expect(rpcCalls.find((c) => c.name === "submit_match_result")).toBeUndefined(); // RPC muerta no se llama
      expect(call!.args._slot_id).toBe("match-1");
      expect(call!.args._winner_is_me).toBe(true);
      expect(call!.args._sets).toEqual([
        { games_a: 6, games_b: 4, is_tiebreak: false },
        { games_a: 6, games_b: 3, is_tiebreak: false },
      ]);
    });
  });

  it("organizador (no juega el partido): llama org_record_bracket_result con winner_side explícito", async () => {
    currentUser = { id: "user-me" }; // no es ni user-a ni user-b → organizador
    render(
      <ResultDialog open onOpenChange={vi.fn()} match={match} registrations={[regA, regB]} players={players} onSubmitted={vi.fn()} />,
    );
    fillTwoSetWin("Ana Pérez", "Bruno Soto");
    fireEvent.click(screen.getByRole("button", { name: /Enviar resultado/i }));

    await waitFor(() => {
      const call = rpcCalls.find((c) => c.name === "org_record_bracket_result");
      expect(call).toBeTruthy();
      expect(rpcCalls.find((c) => c.name === "submit_match_result")).toBeUndefined();
      expect(call!.args._slot_id).toBe("match-1");
      expect(call!.args._winner_side).toBe("a"); // ganó reg-a
      expect(call!.args._sets).toEqual([
        { games_a: 6, games_b: 4, is_tiebreak: false },
        { games_a: 6, games_b: 3, is_tiebreak: false },
      ]);
    });
  });
});

// =====================================================================
// 2. AMISTOSOS — submit_partner_match_result
// =====================================================================

describe("ScoreboardEditor · Amistosos", () => {
  it("cargar 6-4 6-3 llama submit_partner_match_result con _winner_user_id = meId", async () => {
    render(
      <PartnerMatchResultDialog
        open
        onOpenChange={vi.fn()}
        invitationId="inv-1"
        meId="user-me"
        meName="Yo Demo"
        opponentId="user-opp"
        opponentName="Rival Test"
        onSubmitted={vi.fn()}
      />,
    );

    fillTwoSetWin("Yo Demo", "Rival Test");
    fireEvent.click(screen.getByRole("button", { name: /Enviar resultado/i }));

    await waitFor(() => {
      const call = rpcCalls.find((c) => c.name === "submit_partner_match_result");
      expect(call).toBeTruthy();
      expect(call!.args._invitation_id).toBe("inv-1");
      expect(call!.args._winner_user_id).toBe("user-me");
      expect(call!.args._walkover).toBe(false);
      expect(call!.args._retired).toBe(false);
      expect(call!.args._score).toEqual([
        { a: 6, b: 4 },
        { a: 6, b: 3 },
      ]);
    });
  });
});

// =====================================================================
// 3. PIRÁMIDE — submit_ladder_result (incluye swap challenger/challenged)
// =====================================================================

describe("ScoreboardEditor · Pirámide", () => {
  const opponent: ProfileLite = {
    user_id: "user-opp",
    first_name: "Rival",
    last_name: "Test",
    avatar_url: null,
  };

  it("desafiante (challenger=me): _score mantiene orden me/opponent", async () => {
    const challenge = {
      id: "ch-1",
      challenger_user_id: "user-me",
      challenged_user_id: "user-opp",
    } as unknown as ChallengeRow;

    render(
      <LadderResultDialog
        challenge={challenge}
        opponent={opponent}
        onClose={vi.fn()}
        onSubmitted={vi.fn()}
      />,
    );

    fillTwoSetWin("Yo Demo", "Rival Test");
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      const call = rpcCalls.find((c) => c.name === "submit_ladder_result");
      expect(call).toBeTruthy();
      expect(call!.args._challenge_id).toBe("ch-1");
      expect(call!.args._winner_user_id).toBe("user-me");
      expect(call!.args._walkover).toBe(false);
      expect(call!.args._retired).toBe(false);
      // challenger=me → orden { a: me, b: opp } sin swap
      expect(call!.args._score).toEqual([
        { a: 6, b: 4 },
        { a: 6, b: 3 },
      ]);
    });
  });

  it("desafiado (challenged=me): _score se invierte para quedar en orden challenger/challenged", async () => {
    const challenge = {
      id: "ch-2",
      challenger_user_id: "user-opp",
      challenged_user_id: "user-me",
    } as unknown as ChallengeRow;

    render(
      <LadderResultDialog
        challenge={challenge}
        opponent={opponent}
        onClose={vi.fn()}
        onSubmitted={vi.fn()}
      />,
    );

    fillTwoSetWin("Yo Demo", "Rival Test");
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => {
      const call = rpcCalls.find((c) => c.name === "submit_ladder_result");
      expect(call).toBeTruthy();
      expect(call!.args._winner_user_id).toBe("user-me");
      // challenger=opp, challenged=me → orden { a: opp, b: me }
      expect(call!.args._score).toEqual([
        { a: 4, b: 6 },
        { a: 3, b: 6 },
      ]);
    });
  });
});

// =====================================================================
// 4. TIE-BREAK + EMPATES → inferencia y payload
// =====================================================================

import {
  inferEditorWinner,
  validateScoreboardValue,
  setHasTieBreakSlot,
  editorToSetScores,
  type ScoreboardEditorValue,
} from "@/components/match/ScoreboardEditor";

describe("ScoreboardEditor · tie-break y empates (unit)", () => {
  const me = "user-me";
  const opp = "user-opp";

  it("setHasTieBreakSlot detecta 7-6 y 6-7 únicamente", () => {
    expect(setHasTieBreakSlot({ me: 7, opp: 6 })).toBe(true);
    expect(setHasTieBreakSlot({ me: 6, opp: 7 })).toBe(true);
    expect(setHasTieBreakSlot({ me: 6, opp: 4 })).toBe(false);
    expect(setHasTieBreakSlot({ me: null, opp: 6 })).toBe(false);
  });

  it("editorToSetScores incluye tb solo cuando está definido", () => {
    const v: ScoreboardEditorValue = {
      outcome: "score",
      winnerId: me,
      sets: [
        { me: 7, opp: 6, tb: 5 },
        { me: 6, opp: 3 },
      ],
    };
    expect(editorToSetScores(v)).toEqual([
      { a: 7, b: 6, tb: 5 },
      { a: 6, b: 3 },
    ]);
  });

  it("inferEditorWinner sigue contando por sets ganados (TB no altera la inferencia)", () => {
    const v: ScoreboardEditorValue = {
      outcome: "score",
      winnerId: null,
      sets: [
        { me: 7, opp: 6, tb: 4 },
        { me: 6, opp: 7, tb: 5 },
        { me: 6, opp: 4 },
      ],
    };
    expect(inferEditorWinner(v, me, opp)).toBe(me);
  });

  it("empate de sets (1-1) → inferred=null y validación pide ganador manual", () => {
    const v: ScoreboardEditorValue = {
      outcome: "score",
      winnerId: null,
      sets: [
        { me: 6, opp: 4 },
        { me: 4, opp: 6 },
      ],
    };
    expect(inferEditorWinner(v, me, opp)).toBeNull();
    const res = validateScoreboardValue(v, me, opp);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("tied_set");
  });

  it("set 7-6 con tb pasa validación cuando hay ganador inferido", () => {
    const v: ScoreboardEditorValue = {
      outcome: "score",
      winnerId: me,
      sets: [
        { me: 7, opp: 6, tb: 5 },
        { me: 6, opp: 4 },
      ],
    };
    expect(validateScoreboardValue(v, me, opp).ok).toBe(true);
  });
});
