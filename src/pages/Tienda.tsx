import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Coins, Store, Ticket, ChevronRight, Tag } from "lucide-react";
import { useRewards, useFichas, type RewardRow } from "@/hooks/useFichas";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/BottomNav";

// IMPORTANTE: en toda la Tienda NUNCA se muestran precios en pesos. Un premio se
// muestra como "beneficio en [Marca]" + su costo en FICHAS.
const FichasCost = ({ n }: { n: number }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-fichas/15 px-2 py-0.5 text-xs font-bold text-fichas">
    <Coins className="h-3.5 w-3.5" /> {n} Fichas
  </span>
);

const Tienda = () => {
  const { data: rewards = [], isLoading } = useRewards();
  const { data: fichas } = useFichas();

  const byBrand = useMemo(() => {
    const map = new Map<string, RewardRow[]>();
    for (const r of rewards) {
      if (!map.has(r.brand_name)) map.set(r.brand_name, []);
      map.get(r.brand_name)!.push(r);
    }
    return [...map.entries()];
  }, [rewards]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-md px-5 py-6">
        <div className="mb-4 flex items-center gap-3">
          <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Premios</p>
            <h1 className="flex items-center gap-2 font-display text-xl font-semibold">
              <Store className="h-5 w-5 text-primary" /> Tienda
            </h1>
          </div>
        </div>

        {/* Saldo + acceso a Mis canjes */}
        <div className="mb-5 flex items-center justify-between rounded-3xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-fichas/15 text-fichas">
              <Coins className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-lg font-bold leading-none tabular-nums">{fichas?.balance ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">Fichas disponibles</p>
            </div>
          </div>
          <Link to="/mis-canjes" className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <Ticket className="h-3.5 w-3.5" /> Mis canjes
          </Link>
        </div>

        {fichas?.expiring_amount ? (
          <p className="mb-4 rounded-2xl border border-fichas/30 bg-fichas/5 px-3 py-2 text-[11px] text-fichas">
            {fichas.expiring_amount} Fichas vencen pronto. Canjéalas antes de que expiren.
          </p>
        ) : null}

        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
        ) : byBrand.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Aún no hay premios disponibles.
          </p>
        ) : (
          <div className="space-y-6">
            {byBrand.map(([brand, items]) => (
              <div key={brand}>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Tag className="h-4 w-4 text-primary" /> {brand}
                </p>
                <div className="space-y-2">
                  {items.map((r) => (
                    <Link key={r.id} to={`/tienda/${r.id}`}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card transition-smooth hover:border-primary/40 hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-semibold">{r.benefit_label}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{r.title}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <FichasCost n={r.cost_fichas} />
                          {r.stock != null && r.stock <= 5 && (
                            <span className="text-[10px] font-medium text-muted-foreground">
                              {r.stock > 0 ? `Quedan ${r.stock}` : "Agotado"}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          Al canjear recibes un código para usar en el canal de la marca. AcePlay no vende productos ni cobra: solo emite el beneficio.
        </p>
      </div>
      <BottomNav />
    </div>
  );
};

export default Tienda;
