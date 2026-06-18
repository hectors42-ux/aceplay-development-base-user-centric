import { useMemo } from "react";
import type { Match, Registration } from "@/hooks/useCategoryData";

export interface MyPathResult {
  myPathMatchIds: Set<string>;
  stepsAhead: number;
  totalRounds: number;
  isOut: boolean;
  hasPath: boolean;
}

function userInReg(reg: Registration | undefined, userId: string): boolean {
  if (!reg) return false;
  return reg.player1_user_id === userId || reg.player2_user_id === userId;
}

export function useMyPath(
  matches: Match[],
  registrations: Registration[],
  userId: string | null | undefined,
): MyPathResult {
  return useMemo(() => {
    const empty: MyPathResult = {
      myPathMatchIds: new Set(),
      stepsAhead: 0,
      totalRounds: 0,
      isOut: false,
      hasPath: false,
    };
    if (!userId || matches.length === 0)
      return { ...empty, totalRounds: maxRound(matches) };
    const regsById = new Map(registrations.map((r) => [r.id, r]));
    const totalRounds = maxRound(matches);

    // Per bracket scope, find matches where the user participates
    const mineMatches = matches.filter(
      (m) =>
        (m.registration_a_id && userInReg(regsById.get(m.registration_a_id), userId)) ||
        (m.registration_b_id && userInReg(regsById.get(m.registration_b_id), userId)),
    );
    if (mineMatches.length === 0) return { ...empty, totalRounds, hasPath: false };

    const ids = new Set<string>(mineMatches.map((m) => m.id));

    // Check if user has been eliminated: any played match where winner is not user's reg
    let isOut = false;
    let deepest = mineMatches[0];
    for (const m of mineMatches) {
      if (m.round > deepest.round) deepest = m;
      if (m.status === "jugado" && m.winner_registration_id) {
        const wreg = regsById.get(m.winner_registration_id);
        if (!userInReg(wreg, userId)) {
          isOut = true;
        }
      }
    }

    if (!isOut) {
      // Walk forward from deepest unplayed (or last won) towards round=1 (final)
      const startRound = deepest.round;
      let pos = deepest.bracket_position;
      const bracketCol = (deepest as { bracket?: string | null }).bracket ?? null;
      for (let r = startRound - 1; r >= 1; r--) {
        const nextPos = Math.ceil(pos / 2);
        const nextMatch = matches.find(
          (m) =>
            m.round === r &&
            m.bracket_position === nextPos &&
            ((m as { bracket?: string | null }).bracket ?? null) === bracketCol,
        );
        if (nextMatch) ids.add(nextMatch.id);
        pos = nextPos;
      }
    }

    // stepsAhead: número de partidos en el camino que aún no se juegan
    const stepsAhead = matches.filter(
      (m) => ids.has(m.id) && m.status !== "jugado",
    ).length;

    return {
      myPathMatchIds: ids,
      stepsAhead,
      totalRounds,
      isOut,
      hasPath: true,
    };
  }, [matches, registrations, userId]);
}

function maxRound(matches: Match[]): number {
  let max = 0;
  for (const m of matches) if (m.round > max) max = m.round;
  return max;
}