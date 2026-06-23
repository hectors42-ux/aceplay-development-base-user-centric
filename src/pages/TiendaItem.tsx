import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Coins, Loader2, Ticket, Copy, Check, Gift } from "lucide-react";
import { useRewardDetail, useFichas, useRedeem } from "@/hooks/useFichas";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const TiendaItem = () => {
  const { id } = useParams<{ id: string }>();
  const { data: item, isLoading } = useRewardDetail(id);
  const { data: fichas } = useFichas();
  const redeem = useRedeem();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const balance = fichas?.balance ?? 0;
  const soldOut = item?.stock != null && item.stock <= 0;
  const cantAfford = !!item && balance < item.cost_fichas;

  const onRedeem = () => {
    if (!id || redeem.isPending) return;
    redeem.mutate(id, {
      onSuccess: (res) => { setCode(res.code); },
      onError: (e) => toast.error(e.message),
    });
  };

  const copy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/tienda" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Premio</p>
          <h1 className="font-display text-xl font-semibold">{item?.brand_name ?? "Tienda"}</h1>
        </div>
      </div>

      {isLoading || !item ? (
        <Skeleton className="h-64 w-full rounded-3xl" />
      ) : (
        <>
          <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Gift className="h-6 w-6" />
            </span>
            <p className="mt-3 font-display text-2xl font-semibold leading-tight">{item.benefit_label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.title} · {item.brand_name}</p>

            <div className="mt-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-sm font-bold text-amber-700 dark:text-amber-400">
                <Coins className="h-4 w-4" /> {item.cost_fichas} Fichas
              </span>
              {item.stock != null && (
                <span className="text-xs text-muted-foreground">{item.stock > 0 ? `Quedan ${item.stock}` : "Agotado"}</span>
              )}
            </div>

            {item.terms && (
              <div className="mt-4 rounded-2xl bg-muted/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Términos</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.terms}</p>
              </div>
            )}
          </div>

          <div className="mt-4">
            <Button variant="clay" className="w-full" disabled={redeem.isPending || soldOut || cantAfford}
              onClick={onRedeem}>
              {redeem.isPending ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Ticket className="h-4 w-4" /> Canjear por {item.cost_fichas} Fichas</>}
            </Button>
            {cantAfford && !soldOut && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Te faltan {item.cost_fichas - balance} Fichas. Tienes {balance}.
              </p>
            )}
            {soldOut && <p className="mt-2 text-center text-[11px] text-muted-foreground">Este premio está agotado.</p>}
          </div>
        </>
      )}

      {/* Código emitido */}
      <Dialog open={!!code} onOpenChange={(o) => { if (!o) setCode(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>¡Canje listo!</DialogTitle></DialogHeader>
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">Tu código para usar en el canal de {item?.brand_name}:</p>
            <button onClick={copy} className="mx-auto flex items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-5 py-3 font-display text-xl font-bold tracking-wider text-primary">
              {code}
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
            <p className="text-[11px] text-muted-foreground">Guárdalo: queda en "Mis canjes".</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCode(null)}>Cerrar</Button>
            <Button variant="clay" asChild><Link to="/mis-canjes">Ver mis canjes</Link></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TiendaItem;
