import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Compass, Building2, Users, Trophy, ListOrdered, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/BottomNav";
import { SponsorLockup } from "@/components/SponsorLockup";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Opportunity {
  space_id: string;
  kind: "torneo" | "escalerilla";
  name: string;
  club_name: string | null;
  sport: string | null;
  level_label: string | null;
  players: number;
  max_players: number | null;
  starts_at: string | null;
  ends_at: string | null;
  enrolled: boolean;
  status: "proximo" | "en_curso";
}

const SPORT_LABEL: Record<string, string> = { tennis: "Tenis", padel: "Pádel" };
const STATUS_LABEL: Record<string, string> = { proximo: "Próximo", en_curso: "En curso" };

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" }) : null;

const Descubrir = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [sport, setSport] = useState("all");
  const [level, setLevel] = useState("all");
  const [status, setStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc("discover_opportunities", { _sport: null, _level: null, _status: null });
    setItems((data as Opportunity[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { if (user) void load(); }, [user, load]);

  const levels = useMemo(
    () => Array.from(new Set(items.map((i) => i.level_label).filter(Boolean))) as string[],
    [items],
  );

  const filtered = useMemo(
    () => items.filter((i) =>
      (sport === "all" || i.sport === sport) &&
      (level === "all" || i.level_label === level) &&
      (status === "all" || i.status === status)),
    [items, sport, level, status],
  );

  const enroll = async (o: Opportunity) => {
    setEnrolling(o.space_id);
    const { error } = await supabase.rpc("discover_enroll", { _space_id: o.space_id });
    setEnrolling(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Inscrito en ${o.name}. Tu rating global cuenta aquí, sin hacerte socio del club.`);
    setItems((prev) => prev.map((x) => (x.space_id === o.space_id ? { ...x, enrolled: true, players: x.players + 1 } : x)));
    setTimeout(() => navigate(o.kind === "torneo" ? "/torneo" : "/escalerilla"), 900);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-md px-5 py-6">
        <div className="mb-5 flex items-center gap-3">
          <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Red AcePlay</p>
            <h1 className="flex items-center gap-2 font-display text-xl font-semibold">
              <Compass className="h-5 w-5 text-info" /> Descubrir
            </h1>
          </div>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          Oportunidades abiertas de cualquier club de la red. Inscríbete y compite — cuenta para tu rating global.
        </p>
        <SponsorLockup scope="discover" className="mx-0 mb-4" />

        {/* Filtros */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Deporte</SelectItem>
              <SelectItem value="tennis">Tenis</SelectItem>
              <SelectItem value="padel">Pádel</SelectItem>
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Nivel</SelectItem>
              {levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Estado</SelectItem>
              <SelectItem value="proximo">Próximos</SelectItem>
              <SelectItem value="en_curso">En curso</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No hay oportunidades abiertas con esos filtros.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((o) => {
              const KindIcon = o.kind === "torneo" ? Trophy : ListOrdered;
              return (
                <div key={o.space_id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-info">
                        <KindIcon className="h-3 w-3" /> {o.kind === "torneo" ? "Torneo" : "Escalerilla"}
                      </span>
                      <p className="truncate font-display text-base font-semibold text-foreground">{o.name}</p>
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Building2 className="h-3 w-3" /> {o.club_name ?? "Otro club"}
                      </p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      o.status === "en_curso" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{o.sport ? SPORT_LABEL[o.sport] ?? o.sport : "—"}</span>
                    <span>· {o.level_label ?? "Abierto"}</span>
                    <span className="flex items-center gap-1">· <Users className="h-3 w-3" /> {o.players}{o.max_players ? `/${o.max_players}` : ""} inscritos</span>
                    {fmtDate(o.starts_at) && <span>· desde {fmtDate(o.starts_at)}</span>}
                  </div>

                  <div className="mt-3">
                    {o.enrolled ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                        <CheckCircle2 className="h-4 w-4" /> Ya inscrito
                      </span>
                    ) : (
                      <Button size="sm" variant="clay" disabled={enrolling === o.space_id} onClick={() => enroll(o)}>
                        {enrolling === o.space_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Inscribirme"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Inscribirte en un espacio público de otro club NO te hace socio de ese club. Tu rating es portable: viaja contigo por toda la red.
        </p>
      </div>
      <BottomNav />
    </div>
  );
};

export default Descubrir;
