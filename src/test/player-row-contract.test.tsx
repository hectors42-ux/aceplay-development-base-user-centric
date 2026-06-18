/**
 * Contrato visual del "player row" (verificación en el DOM).
 *
 * Renderiza cada tarjeta con React Testing Library y comprueba que los
 * elementos clave (avatar, nombre, línea secundaria, badges) llevan las
 * clases definidas en docs/design-contracts/player-row.md.
 *
 * Si una tarjeta deja de cumplir el contrato, este test falla con un
 * mensaje claro indicando qué clase falta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import { RankingList } from "@/components/ranking/RankingList";
import { SuggestedRivalCard } from "@/components/ladder/SuggestedRivalCard";
import { PartnerCard } from "@/components/partner/PartnerCard";
import { InvitationItem } from "@/components/partner/InvitationItem";
import { OpenChallengeCard } from "@/components/partner/OpenChallengeCard";

import type { ClubRankingRow } from "@/hooks/useClubRanking";
import type { ChallengeablePlayer } from "@/hooks/useChallengeablePlayers";
import type { PartnerSuggestion } from "@/hooks/usePartnerSuggestions";
import type { InvitationWithProfile } from "@/hooks/useMatchInvitations";
import type { OpenPost } from "@/hooks/useMatchOpenPosts";

// Mocks ligeros para no tocar Supabase ni toasts en este test visual.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

// ---------- helpers ----------

const renderCard = (node: ReactElement) => render(node).container;

const expectClasses = (
  el: Element | null,
  classes: string[],
  label: string,
) => {
  expect(el, `[${label}] elemento no encontrado`).toBeTruthy();
  for (const c of classes) {
    expect(
      el!.className,
      `[${label}] falta clase "${c}" en: ${el!.className}`,
    ).toContain(c);
  }
};

const findName = (root: HTMLElement, name: string) =>
  Array.from(root.querySelectorAll("p")).find((p) =>
    p.textContent?.includes(name),
  ) ?? null;

// ---------- fixtures ----------

const rankingRow: ClubRankingRow = {
  user_id: "u-1",
  first_name: "Ada",
  last_name: "Lovelace",
  avatar_url: null,
  level: 4.25,
  reliability: 0.9,
  matches_played: 12,
  category: "B",
  rank_position: 3,
  prev_rank_position: 4,
  streak: 0,
  last_match_at: null,
};

const rival: ChallengeablePlayer = {
  user_id: "u-2",
  pos: 5,
  first_name: "Grace",
  last_name: "Hopper",
  avatar_url: null,
  level: 4.1,
  level_diff: 0.2,
  last_played_at: null,
  schedule_match: true,
  rematch: true,
  cooldown_blocked: false,
  score: 82,
};

const partner: PartnerSuggestion = {
  user_id: "u-3",
  first_name: "Linus",
  last_name: "Torvalds",
  avatar_url: null,
  level: 4.0,
  level_diff: 0.1,
  compat_score: 78,
  reasons: ["Horarios", "Cercano"],
  breakdown: null,
};

const invitation: InvitationWithProfile = {
  id: "inv-1",
  inviter_user_id: "x",
  invitee_user_id: "y",
  status: "pending",
  proposed_slots: [{ starts_at: new Date().toISOString() }],
  selected_slot: null,
  message: "¿Jugamos?",
  compat_score: 70,
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  responded_at: null,
  created_at: new Date().toISOString(),
  counterpart: {
    user_id: "y",
    first_name: "Marie",
    last_name: "Curie",
    avatar_url: null,
  },
};

const openPost: OpenPost = {
  id: "op-1",
  user_id: "u-4",
  format: "best_of_3",
  available_slots: [{ starts_at: new Date().toISOString() }],
  note: null,
  status: "open",
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  created_at: new Date().toISOString(),
  match_type: "singles",
  mode: "open_slots",
  slots_total: 2,
  sport: "tenis",
  gender_filter: "any",
  level_min: null,
  level_max: null,
  court_id: null,
  partner_user_id: null,
  slots: [],
  author: {
    first_name: "Alan",
    last_name: "Turing",
    avatar_url: null,
  },
};

// ---------- contratos compartidos ----------

interface CardCase {
  name: string;
  render: () => HTMLElement;
  /** Texto presente en el nombre del jugador para localizar el <p>. */
  nameText: string;
  /** Texto (o fragmento) presente en la línea secundaria. */
  secondaryText: string;
  /** Si tiene badges (motivos/estado/categoría) que deben cumplir el contrato. */
  hasBadges: boolean;
}

const CASES: CardCase[] = [
  {
    name: "RankingList",
    render: () => renderCard(<RankingList rows={[rankingRow]} />),
    nameText: "Ada Lovelace",
    secondaryText: "partidos",
    hasBadges: true, // CategoryBadge
  },
  {
    name: "SuggestedRivalCard",
    render: () =>
      renderCard(<SuggestedRivalCard player={rival} onChallenge={() => {}} />),
    nameText: "Grace Hopper",
    secondaryText: "Nivel",
    hasBadges: true,
  },
  {
    name: "PartnerCard",
    render: () =>
      renderCard(
        <PartnerCard partner={partner} onSkip={() => {}} onInvite={() => {}} />,
      ),
    nameText: "Linus Torvalds",
    secondaryText: "Nivel",
    hasBadges: true,
  },
  {
    name: "InvitationItem",
    render: () =>
      renderCard(
        <InvitationItem
          invitation={invitation}
          side="received"
          onChanged={() => {}}
        />,
      ),
    nameText: "Marie Curie",
    secondaryText: "Jugamos",
    hasBadges: true,
  },
  {
    name: "OpenChallengeCard",
    render: () =>
      renderCard(
        <OpenChallengeCard
          post={openPost}
          overlapCount={2}
          isOwn={false}
          onInvite={() => {}}
        />,
      ),
    nameText: "Alan Turing",
    secondaryText: "Formato",
    hasBadges: true,
  },
];

describe("player-row visual contract (DOM)", () => {
  for (const c of CASES) {
    describe(c.name, () => {
      let root: HTMLElement;
      beforeEach(() => {
        root = c.render();
      });

      it("avatar usa h-9 w-9", () => {
        const avatar =
          root.querySelector('[class*="h-9"][class*="w-9"]') ??
          root.querySelector("span.h-9.w-9, div.h-9.w-9");
        expectClasses(avatar, ["h-9", "w-9"], `${c.name} avatar`);
      });

      it("nombre usa text-sm font-medium (sans, no font-display)", () => {
        const nameEl = findName(root, c.nameText);
        expectClasses(
          nameEl,
          ["truncate", "text-sm", "font-medium"],
          `${c.name} nombre`,
        );
        expect(
          nameEl!.className,
          `[${c.name} nombre] no debe usar font-display`,
        ).not.toContain("font-display");
      });

      it("línea secundaria usa text-[10px] text-muted-foreground", () => {
        const secondary = Array.from(root.querySelectorAll("*")).find(
          (el) =>
            el.textContent?.includes(c.secondaryText) &&
            el.className?.toString().includes("text-[10px]") &&
            el.className?.toString().includes("text-muted-foreground"),
        );
        expect(
          secondary,
          `[${c.name}] no se encontró línea secundaria text-[10px] muted con "${c.secondaryText}"`,
        ).toBeTruthy();
      });

      if (c.hasBadges) {
        it("badges cumplen h-4 rounded-md text-[9px] font-semibold", () => {
          const badges = Array.from(root.querySelectorAll("*")).filter((el) => {
            const cls = el.className?.toString() ?? "";
            return (
              cls.includes("h-4") &&
              cls.includes("rounded-md") &&
              cls.includes("text-[9px]") &&
              cls.includes("font-semibold")
            );
          });
          expect(
            badges.length,
            `[${c.name}] no se encontró ningún badge que cumpla el contrato`,
          ).toBeGreaterThan(0);
        });
      }
    });
  }
});
