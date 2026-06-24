import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, Loader2, Check } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { useChallenge, useRecordChallengeResult } from "@/hooks/useCancha";
import { cn } from "@/lib/utils";

const CargarResultadoReto = () => {
  // El param es el id del CHALLENGE (la agenda lo pasa como ref). El partido se
  // materializa con el motor (record_match) al enviar; aún no existe un matchId.
  const { matchId: challengeId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: ch } = useChallenge(challengeId);
  const record = useRecordChallengeResult();

  const [sets, setSets] = useState<{ a: string; b: string }[]>([{ a: "", b: "" }, { a: "", b: "" }]);
  const [winner, setWinner] = useState<"me" | "rival">("me");

  const oppProfile = ch ? (ch.from_user === user?.id ? ch.to_profile : ch.from_profile) : null;

  const setVal = (i: number, k: "a" | "b", v: string) =>
    setSets((s) => s.map((row, idx) => (idx === i ? { ...row, [k]: v.replace(/[^0-9]/g, "").slice(0, 2) } : row)));

  const cleanSets = sets
    .filter((s) => s.a !== "" && s.b !== "")
    .map((s) => ({ a: Number(s.a), b: Number(s.b) }));

  const submit = () => {
    if (!challengeId || cleanSets.length === 0) return;
    record.mutate(
      { challengeId, winnerIsMe: winner === "me", sets: cleanSets },
      { onSuccess: (matchId) => navigate(`/victoria/${matchId}`) },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="safe-top sticky top-0 z-30 bg-background/80 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button onClick={() => history.back()} aria-label="Volver" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground">Cargar resultado</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-5 pb-32 pt-2">
        {/* Rival */}
        {oppProfile && (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
            <UserAvatar kind={oppProfile.avatar_kind} look={oppProfile.avatar_look} url={oppProfile.avatar_url} name={oppProfile.display_name ?? "Rival"} className="h-11 w-11 shrink-0" />
            <p className="font-display text-sm font-bold text-foreground">vs {oppProfile.display_name ?? "tu rival"}</p>
          </div>
        )}

        {/* ¿Quién ganó? */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">¿Quién ganó?</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setWinner("me")}
              className={cn("flex-1 rounded-full border px-4 py-2 text-xs font-semibold transition-smooth",
                winner === "me" ? "border-verde bg-verde/15 text-verde" : "border-border bg-card text-muted-foreground")}>
              Yo gané
            </button>
            <button type="button" onClick={() => setWinner("rival")}
              className={cn("flex-1 rounded-full border px-4 py-2 text-xs font-semibold transition-smooth",
                winner === "rival" ? "border-action bg-action/15 text-action" : "border-border bg-card text-muted-foreground")}>
              Ganó {oppProfile?.display_name?.split(" ")[0] ?? "rival"}
            </button>
          </div>
        </div>

        {/* Marcador por sets */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Marcador por sets</p>
          {sets.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-10 text-xs text-muted-foreground">Set {i + 1}</span>
              <input inputMode="numeric" value={s.a} onChange={(e) => setVal(i, "a", e.target.value)}
                className="h-11 w-14 rounded-xl border border-border bg-card text-center text-base font-bold text-foreground" aria-label={`Mis games set ${i + 1}`} />
              <span className="text-muted-foreground">–</span>
              <input inputMode="numeric" value={s.b} onChange={(e) => setVal(i, "b", e.target.value)}
                className="h-11 w-14 rounded-xl border border-border bg-card text-center text-base font-bold text-foreground" aria-label={`Games rival set ${i + 1}`} />
              {sets.length > 1 && (
                <button type="button" onClick={() => setSets((x) => x.filter((_, idx) => idx !== i))} aria-label="Quitar set" className="ml-auto grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {sets.length < 5 && (
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setSets((s) => [...s, { a: "", b: "" }])}>
              <Plus className="h-4 w-4" /> Añadir set
            </Button>
          )}
        </div>

        <p className="rounded-2xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
          Suma <span className="font-semibold text-skill">+pts</span> y <span className="font-semibold text-fichas">+XP</span> cuando tu rival confirme el resultado.
        </p>

        <Button variant="clay" size="lg" className="w-full gap-1" onClick={submit} disabled={record.isPending || cleanSets.length === 0}>
          {record.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enviar resultado <Check className="h-4 w-4" /></>}
        </Button>
      </main>

      <BottomNav />
    </div>
  );
};

export default CargarResultadoReto;
