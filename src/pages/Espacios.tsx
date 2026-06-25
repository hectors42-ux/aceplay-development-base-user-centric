import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { CoinHud } from "@/components/home/CoinHud";
import { BottomNav } from "@/components/BottomNav";
import { SpaceCard } from "@/components/spaces/SpaceCard";
import { useMySpaces } from "@/hooks/useMySpaces";

// Espacios = PERTENENCIA ACTIVA (Épica N): los clubes donde compito, cada uno con su
// estado competitivo en vivo. No lista accesos sueltos. Solo lectura/navegación.
const Espacios = () => {
  const { spaces, loading } = useMySpaces();
  const pendingTotal = spaces.reduce((s, c) => s + c.pendingTotal, 0);

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="safe-top sticky top-0 z-30 px-3 pt-2">
        <CoinHud className="mx-auto max-w-md" />
      </div>

      <main className="mx-auto max-w-md space-y-4 px-5 py-4 md:max-w-2xl">
        <header>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Mi pertenencia activa</p>
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-3xl font-black tracking-tight text-foreground">Espacios</h1>
            {spaces.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {spaces.length} {spaces.length === 1 ? "club" : "clubes"}
                {pendingTotal > 0 && <> · <span className="font-semibold text-action">{pendingTotal} pendientes</span></>}
              </p>
            )}
          </div>
        </header>

        {loading && <div className="h-40 animate-pulse rounded-3xl border border-border bg-card/60" aria-hidden />}

        {!loading && spaces.length === 0 && (
          <section className="flex flex-col items-center px-5 py-12 text-center">
            <span className="mb-4 text-4xl" aria-hidden>🎾</span>
            <h2 className="font-display text-xl font-bold text-foreground">Aún no compites en ningún club</h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Encuentra una escalerilla o un torneo abierto y empieza a sumar a tu ranking.
            </p>
            <Link
              to="/descubrir"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-clay px-6 py-3 font-semibold text-primary-foreground shadow-clay transition-transform hover:scale-[1.02]"
            >
              <Compass className="h-4 w-4" /> Explorar en Descubrir
            </Link>
          </section>
        )}

        {!loading && spaces.length > 0 && (
          <>
            <div className="space-y-3">
              {spaces.map((s) => (
                <SpaceCard key={s.clubId} space={s} />
              ))}
            </div>

            {/* Salida discreta a Descubrir (no es tarjeta hermana). */}
            <Link
              to="/descubrir"
              className="flex items-center justify-center gap-1.5 pt-2 text-xs font-medium text-info transition-smooth hover:text-info/80"
            >
              <Compass className="h-3.5 w-3.5" /> ¿Juegas en otro club? Descúbrelos →
            </Link>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Espacios;
