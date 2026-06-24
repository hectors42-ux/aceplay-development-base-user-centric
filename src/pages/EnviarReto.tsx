import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Swords, Clock, Layers, Plus, Loader2 } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";
import { useUserProfileSummary } from "@/hooks/useUserProfileSummary";
import { usePublicProfile, useMySpaces, useSendChallenge } from "@/hooks/useCancha";
import { matchPct, buildSlotPresets, formatSlot } from "@/lib/cancha-utils";
import { cn } from "@/lib/utils";

const EnviarReto = () => {
  const { toId } = useParams<{ toId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ratingSport } = useActiveSport();
  const { data: me } = useUserProfileSummary(user?.id ?? null, ratingSport);
  const { data: rival } = usePublicProfile(toId);
  const { data: spaces = [] } = useMySpaces();
  const send = useSendChallenge();

  const presets = buildSlotPresets();
  const [spaceId, setSpaceId] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");

  const pct = matchPct(me?.rating?.level, rival?.nivel);

  const toggleSlot = (iso: string) =>
    setSlots((s) => (s.includes(iso) ? s.filter((x) => x !== iso) : [...s, iso]));

  const addCustom = () => {
    if (!custom) return;
    const iso = new Date(custom).toISOString();
    if (!slots.includes(iso)) setSlots((s) => [...s, iso]);
    setCustom("");
  };

  const submit = () => {
    if (!toId || slots.length === 0) return;
    send.mutate(
      { to: toId, spaceId: spaceId || null, slots, sport: ratingSport, note: note.trim() || undefined },
      { onSuccess: () => navigate("/cancha") },
    );
  };

  // slots elegidos que no son preset (añadidos a mano) para poder mostrarlos como chips.
  const presetIsos = new Set(presets.map((p) => p.iso));
  const customSlots = slots.filter((s) => !presetIsos.has(s));

  return (
    <div className="min-h-screen bg-background">
      <header className="safe-top sticky top-0 z-30 bg-background/80 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button onClick={() => history.back()} aria-label="Volver" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground">Enviar reto</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-5 pb-32 pt-2">
        {/* Resumen del rival */}
        {rival && (
          <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
            <span className="block shrink-0 rounded-full ring-2 ring-skill/50">
              <UserAvatar kind={rival.avatar_kind} look={rival.avatar_look} url={rival.avatar_url} name={rival.name ?? "Rival"} className="h-12 w-12" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold text-foreground">{rival.name ?? "Rival"}</p>
              <div className="mt-0.5 flex items-center gap-2">
                {rival.show_ranking && rival.nivel != null && (
                  <span className="rounded-full border border-skill/30 bg-skill/10 px-2 py-0.5 text-[11px] font-bold text-skill">
                    {rival.category ?? "—"} · Niv {Number(rival.nivel).toFixed(0)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{pct}% match</span>
              </div>
            </div>
          </section>
        )}

        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-action">Propón lugar, día y hora</p>

        {/* Lugar = espacio en común (NO selección de cancha). */}
        <div className="space-y-2">
          <label htmlFor="reto-lugar" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Layers className="h-4 w-4 text-action" /> Lugar · club o espacio
          </label>
          <select
            id="reto-lugar"
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground"
          >
            <option value="">Sin lugar fijo (lo coordinan)</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>{s.name ?? "Espacio"}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">La cancha se reserva en el club; aquí solo el punto de encuentro.</p>
        </div>

        {/* Día y hora referencial (slots múltiples). */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Clock className="h-4 w-4 text-action" /> Día y hora · referencial
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
              <button
                key={iso}
                type="button"
                onClick={() => toggleSlot(iso)}
                className="rounded-full border border-action bg-action px-3 py-1.5 text-xs font-semibold text-action-foreground"
              >
                ✓ {formatSlot(iso)}
              </button>
            ))}
          </div>
          {/* Añadir un slot a medida */}
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="flex-1 rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground"
            />
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addCustom} disabled={!custom}>
              <Plus className="h-4 w-4" /> Añadir
            </Button>
          </div>
        </div>

        {/* Nota opcional */}
        <div className="space-y-2">
          <label htmlFor="reto-nota" className="text-sm font-medium text-foreground">Nota (opcional)</label>
          <textarea
            id="reto-nota"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Ej: revancha pendiente 😏"
            className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground"
          />
        </div>

        {/* Aclaración del flujo */}
        <div className="flex items-start gap-2 rounded-2xl border border-border bg-card/60 px-4 py-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {rival?.name?.split(" ")[0] ?? "Tu rival"} puede <span className="font-semibold text-foreground">aceptar</span>,{" "}
            <span className="font-semibold text-foreground">rechazar</span> o{" "}
            <span className="font-semibold text-foreground">proponer otro día/hora</span>. Ajustan la agenda entre ustedes.
          </p>
        </div>

        <Button variant="clay" size="lg" className="w-full gap-1" onClick={submit} disabled={send.isPending || slots.length === 0}>
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enviar reto <Swords className="h-4 w-4" /></>}
        </Button>
        {slots.length === 0 && <p className="-mt-2 text-center text-[11px] text-muted-foreground">Elige al menos un día/hora referencial.</p>}
      </main>

      <BottomNav />
    </div>
  );
};

export default EnviarReto;
