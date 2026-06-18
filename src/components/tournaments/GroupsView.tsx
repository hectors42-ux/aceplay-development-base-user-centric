import { Loader2, Trophy } from "lucide-react";
import { useRoundRobinGroupStandings } from "@/hooks/useRoundRobinGroupStandings";
import { useTournamentGroups } from "@/hooks/useTournamentGroups";
import { registrationLabel, type Match, type Player, type Registration } from "@/hooks/useCategoryData";
import type { Tables } from "@/integrations/supabase/types";

type Category = Tables<"tournament_categories">;

interface Props {
  category: Category;
  matches: Match[];
  registrations: Registration[];
  players: Map<string, Player>;
  highlightUserId?: string | null;
  qualifiersPerGroup?: number;
}

export const GroupsView = ({ category, matches, registrations, players, highlightUserId, qualifiersPerGroup }: Props) => {
  const { groups, loading } = useTournamentGroups(category.id, matches);
  const { data: standings, isLoading: standingsLoading } = useRoundRobinGroupStandings(category.id);
  const q = qualifiersPerGroup ?? (category as { qualifiers_per_group?: number }).qualifiers_per_group ?? 2;

  if (loading || standingsLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
        Los grupos aún no se han generado.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((g) => {
        const groupStandings = (standings ?? []).filter((s) => s.group_id === g.id);
        const byReg = new Map(groupStandings.map((s) => [s.registration_id, s]));
        const rows = g.registration_ids
          .map((regId) => {
            const s = byReg.get(regId);
            return {
              registration_id: regId,
              matches_played: s?.matches_played ?? 0,
              matches_won: s?.matches_won ?? 0,
              sets_won: s?.sets_won ?? 0,
              games_won: s?.games_won ?? 0,
              total_points: s?.total_points ?? 0,
              position: s?.position ?? 99,
            };
          })
          .sort((a, b) => b.total_points - a.total_points || b.matches_won - a.matches_won);
        const groupMatches = matches.filter((m) => {
          const ids = g.registration_ids;
          return (
            (m.registration_a_id && ids.includes(m.registration_a_id)) ||
            (m.registration_b_id && ids.includes(m.registration_b_id))
          );
        });
        const played = groupMatches.filter((m) => m.status === "jugado").length;
        const total = groupMatches.length;
        return (
          <div key={g.id} className="overflow-hidden rounded-2xl border border-border bg-card">
            {/* Header oscuro */}
            <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-foreground to-[hsl(var(--primary-deep))] px-3.5 py-3 text-background">
              <div className="flex items-center gap-2.5">
                <span className="font-serif text-2xl font-semibold leading-none">
                  Grupo {g.name}
                </span>
                <span className="rounded-full border border-background/25 bg-background/15 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                  {g.registration_ids.length} jugadores
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest opacity-80">
                {played} / {total} partidos
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Sin inscritos.</div>
            ) : (
              rows.map((r, idx) => {
                const reg = registrations.find((x) => x.id === r.registration_id);
                const label = registrationLabel(reg, players);
                const isMe =
                  !!highlightUserId &&
                  reg &&
                  (reg.player1_user_id === highlightUserId ||
                    reg.player2_user_id === highlightUserId);
                const qualifies = idx + 1 <= q;
                const pos = idx + 1;
                return (
                  <div
                    key={r.registration_id}
                    className={`flex items-center gap-2.5 border-t border-border px-3.5 py-2.5 border-l-[3px] ${
                      isMe
                        ? "border-l-primary bg-primary/[0.06]"
                        : qualifies
                          ? "border-l-success bg-success/[0.06]"
                          : "border-l-transparent"
                    }`}
                  >
                    <span
                      className={`w-4 text-center font-mono text-xs font-bold tabular-nums ${
                        qualifies ? "text-success" : "text-muted-foreground"
                      }`}
                    >
                      {pos}
                    </span>
                    <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-muted text-[10px] font-bold uppercase text-muted-foreground">
                      {label.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-xs ${isMe ? "font-bold" : "font-semibold"} text-foreground`}
                      >
                        {label}
                      </div>
                      <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
                        PJ {r.matches_played} · {r.total_points.toFixed(1)} pts
                      </div>
                    </div>
                    {qualifies && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-success-foreground">
                        <Trophy className="h-2.5 w-2.5" /> Clasifica
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
};