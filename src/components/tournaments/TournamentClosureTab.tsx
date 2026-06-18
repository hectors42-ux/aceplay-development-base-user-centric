import { useEffect, useState } from "react";
import { Loader2, Trophy, Lock, AlertTriangle, Medal, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useCelebrate } from "@/hooks/useCelebrate";
import { useAuth } from "@/components/providers/AuthProvider";
import { HapticButton } from "@/components/feedback";
import { FrozenTableAnimation } from "./admin/FrozenTableAnimation";
import type { ClosingSummary, PodiumCategory } from "@/hooks/useOrganizerHistory";

interface Props {
  tournamentId: string;
  tournamentSlug?: string | null;
  closedAt: string | null;
  closingSummary: ClosingSummary | null;
  onClosed: () => void;
}

interface RegLite {
  id: string;
  player1_user_id: string;
  player2_user_id: string | null;
}
interface ProfileLite {
  user_id: string;
  first_name: string;
  last_name: string;
}

function regLabel(
  regId: string | null | undefined,
  regs: Map<string, RegLite>,
  profs: Map<string, ProfileLite>,
) {
  if (!regId) return "—";
  const r = regs.get(regId);
  if (!r) return "—";
  const p1 = profs.get(r.player1_user_id);
  const n1 = p1 ? `${p1.first_name} ${p1.last_name}` : "—";
  if (!r.player2_user_id) return n1;
  const p2 = profs.get(r.player2_user_id);
  const n2 = p2 ? `${p2.first_name} ${p2.last_name}` : "—";
  return `${n1} / ${n2}`;
}

export const TournamentClosureTab = ({
  tournamentId,
  tournamentSlug,
  closedAt,
  closingSummary,
  onClosed,
}: Props) => {
  const [pending, setPending] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [regs, setRegs] = useState<Map<string, RegLite>>(new Map());
  const [profs, setProfs] = useState<Map<string, ProfileLite>>(new Map());
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [animPodium, setAnimPodium] = useState<{ gold?: string; silver?: string; bronze?: string } | null>(null);
  const celebrate = useCelebrate();
  const { user } = useAuth();

  // PRD 1 · disparador `epic` — el usuario actual es campeón de alguna
  // categoría del torneo cerrado. Idempotente vía flag localStorage.
  useEffect(() => {
    if (!closedAt || !closingSummary || !user?.id || regs.size === 0) return;
    const flagKey = `celebrated:tournament:${tournamentId}:champion`;
    try {
      if (localStorage.getItem(flagKey)) return;
    } catch {
      return;
    }
    const championCat = closingSummary.categories.find((c) => {
      const champReg = c.champion ? regs.get(c.champion.registration_id) : null;
      if (!champReg) return false;
      return (
        champReg.player1_user_id === user.id || champReg.player2_user_id === user.id
      );
    });
    if (!championCat?.champion) return;
    const champReg = regs.get(championCat.champion.registration_id);
    if (!champReg) return;
    const p1 = profs.get(champReg.player1_user_id);
    const p2 = champReg.player2_user_id ? profs.get(champReg.player2_user_id) : null;
    const champName = p2
      ? `${p1?.first_name ?? ""} ${p1?.last_name ?? ""} / ${p2.first_name} ${p2.last_name}`.trim()
      : `${p1?.first_name ?? ""} ${p1?.last_name ?? ""}`.trim() || "Campeón";
    celebrate({
      kind: "epic",
      title: "¡Campeón!",
      subtitle: championCat.name,
      tournamentId,
      shareUrl: tournamentSlug
        ? `${window.location.origin}/torneos/${tournamentSlug}/compartir?kind=champion`
        : undefined,
      podium: { first: { name: champName } },
    });
  }, [closedAt, closingSummary, user?.id, regs, profs, tournamentId, tournamentSlug, celebrate]);

  useEffect(() => {
    (async () => {
      // pending matches preflight
      const { data: pendRows } = await supabase
        .from("tournament_matches")
        .select("id,status,registration_a_id,registration_b_id")
        .eq("tournament_id", tournamentId);
      const pendCount = (pendRows ?? []).filter(
        (m) =>
          m.registration_a_id &&
          m.registration_b_id &&
          m.status !== "jugado" &&
          m.status !== "walkover",
      ).length;
      setPending(pendCount);

      // registrations + profiles for podium labels
      const { data: rRows } = await supabase
        .from("tournament_registrations")
        .select("id,player1_user_id,player2_user_id")
        .eq("tournament_id", tournamentId);
      const rs = (rRows ?? []) as RegLite[];
      setRegs(new Map(rs.map((r) => [r.id, r])));
      const ids = new Set<string>();
      rs.forEach((r) => {
        ids.add(r.player1_user_id);
        if (r.player2_user_id) ids.add(r.player2_user_id);
      });
      if (ids.size > 0) {
        const { data: pRows } = await supabase
          .from("profiles")
          .select("user_id,first_name,last_name")
          .in("user_id", Array.from(ids));
        setProfs(new Map(((pRows ?? []) as ProfileLite[]).map((p) => [p.user_id, p])));
      }
    })();
  }, [tournamentId, closedAt]);

  const handleClose = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    // Mostrar animación congelada apenas se confirma; podio se completa post-rpc si está disponible
    setAnimPodium({ gold: "Coronando…" });
    const { error } = await supabase.rpc("close_tournament", { _tournament_id: tournamentId });
    if (error) {
      setAnimPodium(null);
      setSubmitting(false);
      toast({ title: "No se pudo cerrar", description: error.message, variant: "destructive" });
      return;
    }
    // Major celebration para el organizador (idempotente por flag local)
    try {
      const flagKey = `closed-by-me:${tournamentId}`;
      if (!localStorage.getItem(flagKey)) {
        localStorage.setItem(flagKey, "1");
        celebrate({
          kind: "major",
          title: "¡Torneo cerrado!",
          subtitle: "Premios entregados y standings congelados.",
          tournamentId,
        });
      }
    } catch {
      /* noop */
    }
    toast({ title: "Torneo cerrado", description: "Se coronó a los campeones." });
  };

  const handleAnimComplete = () => {
    setAnimPodium(null);
    setSubmitting(false);
    onClosed();
  };

  const handleExportClosure = async () => {
    setExporting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-tournament`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ tournament_id: tournamentId, format: "pdf" }),
      });
      if (!res.ok) throw new Error("Export falló");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `cierre-torneo.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Inténtalo nuevamente",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  if (closedAt && closingSummary) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Torneo cerrado</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(closedAt).toLocaleString("es-CL")} · {closingSummary.totals.participants} inscritos · {closingSummary.totals.matches_played} partidos
          </p>
        </div>

        <div className="space-y-3">
          {closingSummary.categories.map((cat: PodiumCategory) => (
            <div key={cat.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="font-display text-sm font-semibold">{cat.name}</p>
              {!cat.has_bracket ? (
                <p className="mt-2 text-xs text-muted-foreground">Sin cuadro generado.</p>
              ) : !cat.champion ? (
                <p className="mt-2 text-xs text-muted-foreground">Sin campeón registrado.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold">{regLabel(cat.champion.registration_id, regs, profs)}</span>
                  </li>
                  {cat.runner_up && (
                    <li className="flex items-center gap-2">
                      <Medal className="h-4 w-4 text-slate-400" />
                      <span>{regLabel(cat.runner_up.registration_id, regs, profs)}</span>
                    </li>
                  )}
                  {cat.semis.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Medal className="h-3 w-3 text-amber-700/60" />
                      <span>3°–4° · {regLabel(s.registration_id, regs, profs)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <Button onClick={handleExportClosure} disabled={exporting} variant="outline" className="w-full">
          {exporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Exportar PDF de cierre
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="font-display text-sm font-semibold">Cerrar torneo</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Congela cuadros y resultados, corona campeones por categoría y genera el resumen final.
          Esta acción no puede deshacerse desde aquí.
        </p>
        {pending !== null && pending > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              Hay {pending} partido(s) sin resultado en categorías con cuadro generado.
              Resuelve o asigna walkover antes de cerrar.
            </p>
          </div>
        )}
        <HapticButton
          level="heavy"
          onClick={() => {
            setConfirmChecked(false);
            setConfirmOpen(true);
          }}
          disabled={submitting || (pending ?? 0) > 0}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Cerrar torneo y coronar
        </HapticButton>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(v) => !submitting && setConfirmOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar y entregar premios</DialogTitle>
            <DialogDescription>
              Esta acción congela cuadros, resultados y standings. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
              Resumen
            </p>
            <p className="text-xs text-muted-foreground">
              Al confirmar se entregarán los premios por categoría y se notificará a los campeones.
            </p>
            <label className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs">
              <Checkbox
                checked={confirmChecked}
                onCheckedChange={(v) => setConfirmChecked(v === true)}
                className="mt-0.5"
              />
              <span>Confirmo que los resultados son finales.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <HapticButton
              level="heavy"
              onClick={handleClose}
              disabled={!confirmChecked || submitting}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Cerrar y entregar premios
            </HapticButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {animPodium && (
        <FrozenTableAnimation podiumNames={animPodium} onComplete={handleAnimComplete} />
      )}
    </div>
  );
};