import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ListOrdered, Trophy, ChevronRight, Flag } from "lucide-react";
import { CoinHud } from "@/components/home/CoinHud";
import { BottomNav } from "@/components/BottomNav";
import { useMySpaces, type MySpace, type SpaceCompetition, sportLabel } from "@/hooks/useMySpaces";
import { ClubHistory } from "@/components/spaces/ClubHistory";
import { cn } from "@/lib/utils";

// NIVEL 2 · Casa del club: el jugador entra al club. Identidad + selector
// Activos/Pasados + competencias agrupadas por tipo, como tarjetas hero.
// SOLO LECTURA: reusa useMySpaces. Tap en una tarjeta → NIVEL 3 (detalle existente).

function CompetitionHero({ c, past }: { c: SpaceCompetition; past: boolean }) {
  const isLadder = c.type === "ladder";
  const Icon = isLadder ? ListOrdered : Trophy;
  const title = isLadder ? c.name : `${c.tournamentName} · ${c.categoryName}`;
  // Clases explícitas (Tailwind JIT no compila clases dinámicas por interpolación).
  const iconBox = isLadder ? "bg-skill/10 text-skill" : "bg-fichas/10 text-fichas";
  const borderActive = isLadder ? "border-skill/30" : "border-fichas/30";

  let line: React.ReactNode;
  if (past) {
    line = isLadder
      ? <>Posición final <span className="font-semibold text-skill">#{c.myRank ?? "—"}</span></>
      : <>Finalizado · <span className="text-info">ver resultado</span></>;
  } else if (isLadder) {
    line = <>Vas <span className="font-semibold text-skill">#{c.myRank ?? "—"}</span>{c.pending > 0 ? <span className="text-action"> · {c.pending} pendiente{c.pending === 1 ? "" : "s"}</span> : null}</>;
  } else {
    line = <>{c.phase} · {c.hasNext ? <span className="text-action">tienes tu próximo partido</span> : "sigue tu cuadro"}</>;
  }

  return (
    <Link
      to={c.route}
      className={cn("block overflow-hidden rounded-2xl border bg-card p-4 shadow-card transition-smooth hover:-translate-y-0.5",
        past ? "border-border opacity-90" : borderActive)}
    >
      <div className="flex items-center gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", iconBox)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold text-foreground">{title}</p>
          <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
            {isLadder ? "Escalerilla" : `Torneo de ${sportLabel(c.sport).toLowerCase()}`}
          </p>
        </div>
        {past ? (
          <Flag className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : c.type === "tournament" && c.hasNext ? (
          <span className="shrink-0 rounded-full border border-fichas/40 bg-fichas/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fichas">Próx</span>
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </div>
      <p className="mt-2.5 border-t border-border/60 pt-2.5 text-sm text-muted-foreground">{line}</p>
    </Link>
  );
}

function Group({ title, icon: Icon, comps, past }: { title: string; icon: typeof Trophy; comps: SpaceCompetition[]; past: boolean }) {
  if (comps.length === 0) return null;
  return (
    <section className="space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      {comps.map((c) => (
        <CompetitionHero key={c.type === "ladder" ? `l-${c.spaceId}` : `t-${c.categoryId}`} c={c} past={past} />
      ))}
    </section>
  );
}

const ClubHouse = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const { spaces, loading } = useMySpaces();
  const [params, setParams] = useSearchParams();
  const tab = params.get("estado") === "pasados" ? "pasados" : "activos";

  const club: MySpace | undefined = useMemo(() => spaces.find((s) => s.clubId === clubId), [spaces, clubId]);
  const showPast = tab === "pasados";
  const comps = (club?.competitions ?? []).filter((c) => (showPast ? c.finished : !c.finished));
  const torneos = comps.filter((c) => c.type === "tournament");
  const ladders = comps.filter((c) => c.type === "ladder");

  const brand = club?.brandColor ?? undefined;
  const initials = club ? (club.initials ?? club.clubName.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()) : "";

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="safe-top sticky top-0 z-30 px-3 pt-2">
        <CoinHud className="mx-auto max-w-md" />
      </div>

      <main className="mx-auto max-w-md space-y-4 px-5 py-4 md:max-w-2xl">
        <Link to="/espacios" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Espacios
        </Link>

        {loading && <div className="h-40 animate-pulse rounded-3xl border border-border bg-card/60" aria-hidden />}

        {!loading && !club && (
          <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
            No tienes actividad en este club.
          </p>
        )}

        {club && (
          <>
            {/* Identidad del club */}
            <header
              className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4 shadow-card"
              style={brand ? { borderTopWidth: 3, borderTopColor: brand } : undefined}
            >
              {club.logoUrl ? (
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-white">
                  <img src={club.logoUrl} alt="" aria-hidden className="h-full w-full object-contain" />
                </span>
              ) : (
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-black text-white" style={{ background: brand ?? "hsl(var(--muted))" }}>
                  {initials}
                </span>
              )}
              <div className="min-w-0">
                <h1 className="truncate font-display text-xl font-black text-foreground">{club.clubName}</h1>
                <p className="text-xs text-muted-foreground">{sportLabel(club.sport)} · {club.relation}</p>
              </div>
            </header>

            {/* Selector Activos / Pasados */}
            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/30 p-1">
              {(["activos", "pasados"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setParams(t === "activos" ? {} : { estado: t })}
                  className={cn("rounded-xl px-3 py-2 text-sm font-semibold capitalize transition-smooth",
                    tab === t ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground")}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* PASADOS = "Mi historia en el club": evolución del Nivel + stats, arriba
                de las competencias terminadas. */}
            {showPast && clubId && <ClubHistory clubId={clubId} />}

            {comps.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                {showPast ? "Aún no tienes competencias terminadas en este club." : "No tienes competencias activas en este club."}
              </p>
            ) : (
              <div className="space-y-5">
                {showPast && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Competencias terminadas</p>
                )}
                <Group title="Torneos" icon={Trophy} comps={torneos} past={showPast} />
                <Group title="Escalerillas" icon={ListOrdered} comps={ladders} past={showPast} />
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default ClubHouse;
