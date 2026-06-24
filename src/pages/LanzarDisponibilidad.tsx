import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Zap, Clock, Layers, Plus, Megaphone, Loader2 } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { useActiveSport } from "@/components/providers/SportProvider";
import { useMySpaces, usePostAvailability } from "@/hooks/useCancha";
import { buildSlotPresets, formatSlot } from "@/lib/cancha-utils";
import { cn } from "@/lib/utils";

const LanzarDisponibilidad = () => {
  const navigate = useNavigate();
  const { ratingSport } = useActiveSport();
  const { data: spaces = [] } = useMySpaces();
  const post = usePostAvailability();

  const presets = buildSlotPresets();
  const [slots, setSlots] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [scope, setScope] = useState<"zone" | "open">("zone");
  const [note, setNote] = useState("");

  const toggleSlot = (iso: string) =>
    setSlots((s) => (s.includes(iso) ? s.filter((x) => x !== iso) : [...s, iso]));
  const addCustom = () => {
    if (!custom) return;
    const iso = new Date(custom).toISOString();
    if (!slots.includes(iso)) setSlots((s) => [...s, iso]);
    setCustom("");
  };
  const presetIsos = new Set(presets.map((p) => p.iso));
  const customSlots = slots.filter((s) => !presetIsos.has(s));

  const submit = () => {
    if (slots.length === 0) return;
    post.mutate(
      { sport: ratingSport, slots, spaceId: spaceId || null, scope, note: note.trim() || undefined },
      { onSuccess: () => navigate("/cancha/llamados") },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="safe-top sticky top-0 z-30 bg-background/80 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button onClick={() => history.back()} aria-label="Volver" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground">Lanzar disponibilidad</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-5 pb-32 pt-2">
        <div className="flex items-start gap-2 rounded-2xl border border-action/30 bg-action/[0.06] px-4 py-3">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-action" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Publica <span className="font-semibold text-action">cuándo y dónde</span> puedes jugar. Lo ven todos —{" "}
            <span className="font-semibold text-foreground">el primero que pueda, juega</span>.
          </p>
        </div>

        {/* ¿Cuándo? */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Clock className="h-4 w-4 text-action" /> ¿Cuándo tienes tiempo?
          </label>
          <div className="flex flex-wrap gap-2">
            {presets.map((s) => (
              <button
                key={s.iso}
                type="button"
                onClick={() => toggleSlot(s.iso)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-smooth",
                  slots.includes(s.iso)
                    ? "border-action bg-action text-action-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {slots.includes(s.iso) ? "✓ " : ""}{s.label}
              </button>
            ))}
            {customSlots.map((iso) => (
              <button key={iso} type="button" onClick={() => toggleSlot(iso)}
                className="rounded-full border border-action bg-action px-3 py-1.5 text-xs font-semibold text-action-foreground">
                ✓ {formatSlot(iso)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)}
              className="flex-1 rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground" />
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addCustom} disabled={!custom}>
              <Plus className="h-4 w-4" /> Otro
            </Button>
          </div>
        </div>

        {/* ¿Dónde? */}
        <div className="space-y-2">
          <label htmlFor="disp-lugar" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Layers className="h-4 w-4 text-action" /> ¿Dónde?
          </label>
          <select id="disp-lugar" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground">
            <option value="">Sin lugar fijo (lo coordinan)</option>
            {spaces.map((s) => (<option key={s.id} value={s.id}>{s.name ?? "Espacio"}</option>))}
          </select>
        </div>

        {/* ¿Con quién? · alcance */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">¿Con quién? · alcance del llamado</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setScope("zone")}
              className={cn("flex-1 rounded-full border px-4 py-2 text-xs font-semibold transition-smooth",
                scope === "zone" ? "border-skill bg-skill/15 text-skill" : "border-border bg-card text-muted-foreground")}>
              Mi Zona
            </button>
            <button type="button" onClick={() => setScope("open")}
              className={cn("flex-1 rounded-full border px-4 py-2 text-xs font-semibold transition-smooth",
                scope === "open" ? "border-info bg-info/15 text-info" : "border-border bg-card text-muted-foreground")}>
              Abierto a todos
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tu Zona asegura un partido parejo. "Abierto" llega a más gente.
          </p>
        </div>

        {/* Nota */}
        <div className="space-y-2">
          <label htmlFor="disp-nota" className="text-sm font-medium text-foreground">Nota (opcional)</label>
          <textarea id="disp-nota" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={200}
            placeholder="Ej: busco set rápido, traigo pelotas nuevas 🎾"
            className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground" />
        </div>

        <Button variant="clay" size="lg" className="w-full gap-1" onClick={submit} disabled={post.isPending || slots.length === 0}>
          {post.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Megaphone className="h-4 w-4" /> Publicar llamado a jugar</>}
        </Button>
        {slots.length === 0 && <p className="-mt-2 text-center text-[11px] text-muted-foreground">Elige al menos un horario.</p>}
      </main>

      <BottomNav />
    </div>
  );
};

export default LanzarDisponibilidad;
