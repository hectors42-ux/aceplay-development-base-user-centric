import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Coins, Store, Ticket } from "lucide-react";
import { useRewards, useFichas, type RewardRow } from "@/hooks/useFichas";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/BottomNav";
import { CoinHud } from "@/components/home/CoinHud";

// IMPORTANTE: en toda la Tienda NUNCA se muestran precios en pesos. Un premio se
// muestra como "beneficio en [Marca]" + su costo en FICHAS (botón oro .btn.gold).

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
      <div className="safe-top sticky top-0 z-30 px-3 pt-2">
        <CoinHud className="mx-auto max-w-md" />
      </div>
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

        {/* Sponsors cortesía (diseño tienda.png). */}
        {byBrand.length > 0 && (
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Premios cortesía de</span>
            {byBrand.map(([brand]) => (
              <span key={brand} className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground">
                {brand}
              </span>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}</div>
        ) : rewards.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Aún no hay premios disponibles.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {rewards.map((r) => (
              <Link key={r.id} to={`/tienda/${r.id}`}
                className="flex flex-col rounded-2xl border border-border bg-card p-3.5 shadow-card transition-smooth hover:border-primary/40">
                <span className="self-start rounded-md bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                  {r.brand_name}
                </span>
                <p className="mt-2 font-display text-sm font-bold leading-tight text-foreground">{r.benefit_label}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{r.title}</p>
                {r.stock != null && r.stock <= 5 && (
                  <span className="mt-1 text-[10px] font-medium text-muted-foreground">{r.stock > 0 ? `Quedan ${r.stock}` : "Agotado"}</span>
                )}
                {/* Precio = botón oro (.btn.gold del diseño) — costo SIEMPRE en Fichas. */}
                <span
                  className="mt-auto flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-extrabold text-[hsl(var(--fichas-foreground))]"
                  style={{
                    marginTop: "0.75rem",
                    background: "linear-gradient(180deg, hsl(var(--fichas)), hsl(var(--fichas-deep)))",
                    boxShadow: "0 10px 24px -8px hsl(var(--fichas) / 0.4), inset 0 1px 0 rgba(255,255,255,.4)",
                  }}
                >
                  <Coins className="h-4 w-4" /> {r.cost_fichas} Fichas
                </span>
              </Link>
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
