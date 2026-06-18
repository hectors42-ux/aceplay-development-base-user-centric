import { useEffect } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, MapPin, Share2, History } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { HapticButton } from "@/components/feedback/HapticButton";
import { haptic } from "@/lib/feedback/haptic";
import { toast } from "@/hooks/use-toast";
import { roundLabel, totalRoundsForMatches } from "@/lib/tournament-utils";
import { registrationLabel, type Match, type Registration, type Player, type Court } from "@/hooks/useCategoryData";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  match: Match | null;
  matches: Match[];
  registrations: Registration[];
  players: Map<string, Player>;
  courts?: Court[];
  userId?: string | null;
  onLoadResult?: (m: Match) => void;
}

interface SetScore {
  a: number | null;
  b: number | null;
}

function parseScore(score: unknown): SetScore[] {
  if (!score) return [];
  // Support shapes: [[6,4],[6,3]] or { sets: [{a,b},...] } or { a:[6,6], b:[4,3] }
  if (Array.isArray(score)) {
    return (score as unknown[])
      .map((s) => {
        if (Array.isArray(s) && s.length >= 2) {
          return { a: numOrNull(s[0]), b: numOrNull(s[1]) };
        }
        if (s && typeof s === "object") {
          const o = s as { a?: unknown; b?: unknown };
          return { a: numOrNull(o.a), b: numOrNull(o.b) };
        }
        return { a: null, b: null };
      })
      .filter((s) => s.a != null || s.b != null);
  }
  if (typeof score === "object" && score !== null) {
    const o = score as { sets?: unknown; a?: unknown; b?: unknown };
    if (Array.isArray(o.sets)) return parseScore(o.sets);
    if (Array.isArray(o.a) && Array.isArray(o.b)) {
      const len = Math.max(o.a.length, o.b.length);
      const out: SetScore[] = [];
      for (let i = 0; i < len; i++)
        out.push({ a: numOrNull(o.a[i]), b: numOrNull(o.b[i]) });
      return out;
    }
  }
  return [];
}

function numOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function setsWon(sets: SetScore[]): { a: number; b: number } {
  let a = 0,
    b = 0;
  for (const s of sets) {
    if (s.a == null || s.b == null) continue;
    if (s.a > s.b) a++;
    else if (s.b > s.a) b++;
  }
  return { a, b };
}

export function MatchSheet({
  open,
  onOpenChange,
  match,
  matches,
  registrations,
  players,
  courts,
  userId,
  onLoadResult,
}: Props) {
  useEffect(() => {
    if (open) haptic("light");
  }, [open]);

  if (!match) return null;
  const regsById = new Map(registrations.map((r) => [r.id, r]));
  const courtsById = new Map((courts ?? []).map((c) => [c.id, c]));
  const regA = match.registration_a_id ? regsById.get(match.registration_a_id) : undefined;
  const regB = match.registration_b_id ? regsById.get(match.registration_b_id) : undefined;
  const labelA = registrationLabel(regA, players);
  const labelB = registrationLabel(regB, players);
  const totalRounds = totalRoundsForMatches(matches);
  const sets = parseScore(match.score as unknown);
  const tally = setsWon(sets);
  const played = match.status === "jugado";
  const winnerA = !!match.winner_registration_id && match.winner_registration_id === match.registration_a_id;
  const winnerB = !!match.winner_registration_id && match.winner_registration_id === match.registration_b_id;
  const court = match.court_id ? courtsById.get(match.court_id) : undefined;

  const userIsParticipant =
    !!userId &&
    ((regA && (regA.player1_user_id === userId || regA.player2_user_id === userId)) ||
      (regB && (regB.player1_user_id === userId || regB.player2_user_id === userId)));

  const handleShare = async () => {
    const text = `${labelA} vs ${labelB}${played ? ` · ${tally.a}–${tally.b}` : ""}`;
    try {
      if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: unknown }).share) {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: "Partido",
          text,
        });
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast({ title: "Copiado", description: "El resumen se copió al portapapeles." });
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-3xl px-4 pt-4">
        <SheetHeader className="text-left">
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
            {roundLabel(match.round, totalRounds)} · Partido #{match.bracket_position}
          </div>
          <SheetTitle className="sr-only">Detalle del partido</SheetTitle>
        </SheetHeader>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <PlayerSide name={labelA} winner={winnerA} align="left" />
          <div className="flex flex-col items-center">
            {played ? (
              <div className="font-serif text-3xl tabular-nums text-foreground">
                {tally.a}<span className="px-1 text-muted-foreground">–</span>{tally.b}
              </div>
            ) : (
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                vs
              </div>
            )}
          </div>
          <PlayerSide name={labelB} winner={winnerB} align="right" />
        </div>

        {sets.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {sets.slice(0, 5).map((s, i) => {
              const aWon = s.a != null && s.b != null && s.a > s.b;
              const bWon = s.a != null && s.b != null && s.b > s.a;
              return (
                <div
                  key={i}
                  className={`rounded-xl border-2 p-2 text-center ${
                    aWon || bWon ? "border-success/40 bg-success/5" : "border-border bg-card"
                  }`}
                >
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    Set {i + 1}
                  </div>
                  <div className="mt-1 font-serif text-lg tabular-nums text-foreground">
                    {s.a ?? "–"}–{s.b ?? "–"}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {match.scheduled_at && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
              <CalendarClock className="h-3 w-3" />
              {format(parseISO(match.scheduled_at), "EEE d MMM HH:mm", { locale: es })}
            </span>
          )}
          {court && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
              <MapPin className="h-3 w-3" />
              {court.name}
            </span>
          )}
          {match.walkover && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
              W.O.
            </span>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {userIsParticipant && !played && (
            <HapticButton
              level="medium"
              onClick={() => {
                onLoadResult?.(match);
                onOpenChange(false);
              }}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-card transition-smooth hover:brightness-110"
            >
              Cargar set
            </HapticButton>
          )}
          <HapticButton
            level="light"
            onClick={handleShare}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:bg-muted"
          >
            <Share2 className="h-3.5 w-3.5" /> Compartir
          </HapticButton>
          <HapticButton
            level="light"
            onClick={() =>
              toast({
                title: "Próximamente",
                description: "El historial entre jugadores aún no está disponible.",
              })
            }
            className="inline-flex h-9 w-full items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <History className="h-3.5 w-3.5" /> Ver historial entre ambos →
          </HapticButton>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PlayerSide({
  name,
  winner,
  align,
}: {
  name: string;
  winner: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div
        className={`truncate text-sm ${
          winner ? "font-bold text-foreground" : "text-foreground/80"
        }`}
      >
        {name}
      </div>
      {winner && (
        <div className="font-mono text-[9px] uppercase tracking-widest text-success">
          Ganador
        </div>
      )}
    </div>
  );
}
