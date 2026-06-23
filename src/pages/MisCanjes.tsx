import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Ticket, Copy, Check, Store } from "lucide-react";
import { useRedemptions } from "@/hooks/useFichas";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = { issued: "Emitido", used: "Usado", expired: "Vencido" };

const MisCanjes = () => {
  const { data: redemptions = [], isLoading } = useRedemptions();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-md px-5 py-6">
        <div className="mb-5 flex items-center gap-3">
          <Link to="/tienda" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Premios</p>
            <h1 className="flex items-center gap-2 font-display text-xl font-semibold">
              <Ticket className="h-5 w-5 text-primary" /> Mis canjes
            </h1>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
        ) : redemptions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Todavía no canjeaste ningún premio.</p>
            <Link to="/tienda" className="mt-3 inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
              <Store className="h-3.5 w-3.5" /> Ir a la Tienda
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {redemptions.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-semibold">{r.benefit_label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{r.brand_name} · {fmt(r.created_at)}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    r.status === "issued" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <button onClick={() => copy(r.code)}
                  className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-3 py-2">
                  <span className="font-display text-base font-bold tracking-wider text-primary">{r.code}</span>
                  {copied === r.code ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-primary" />}
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          Usa el código en el canal de la marca. AcePlay solo emite el beneficio.
        </p>
      </div>
      <BottomNav />
    </div>
  );
};

export default MisCanjes;
