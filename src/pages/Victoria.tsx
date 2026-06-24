import { useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { X, Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUserProfileSummary } from "@/hooks/useUserProfileSummary";
import { useActiveSport } from "@/components/providers/SportProvider";
import { useVictoryCard } from "@/hooks/useCancha";
import { useShareCardCapture } from "@/hooks/useShareCardCapture";

const Victoria = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
  const { ratingSport } = useActiveSport();
  const { data: me } = useUserProfileSummary(user?.id ?? null, ratingSport);
  const { data: v } = useVictoryCard(matchId);
  const cardRef = useRef<HTMLDivElement>(null);
  const { download, shareNative } = useShareCardCapture(cardRef);

  const myName = me?.profile ? `${me.profile.first_name ?? ""} ${me.profile.last_name ?? ""}`.trim() : "Tú";
  const won = v?.i_won ?? true;

  const onShare = () =>
    shareNative({ format: "story", kind: "victoria", text: "¡Gané en AcePlay! 🎾" }).catch(() => {});
  const onDownload = () => download({ format: "story", kind: "victoria", filename: "aceplay-victoria.png" });

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 80% at 50% -10%, #16213C 0%, #0A1020 45%, #070B16 100%)" }} />

      <header className="safe-top relative z-10 flex items-center gap-2 px-5 py-3">
        <Link to="/cancha" aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
          <X className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-lg font-bold tracking-tight text-foreground">Tu victoria</h1>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-8">
        {/* BADGE capturable */}
        <div
          ref={cardRef}
          className="w-full max-w-xs overflow-hidden rounded-3xl border border-skill/30 p-5 text-center shadow-elevated"
          style={{ background: "linear-gradient(160deg, #101A30 0%, #0A1020 100%)" }}
        >
          {/* Marca + club */}
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <img src="/images/mark-arc-primary.png" alt="" aria-hidden className="h-3.5 w-auto object-contain" />
              <span className="font-cormorant text-sm font-semibold leading-none">
                <span className="text-white">Ace</span><span className="italic text-action">Play</span>
              </span>
            </span>
            <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/50">
              {v?.club_name ?? v?.space_name ?? "AcePlay Arena"}
            </span>
          </div>

          {/* Rally */}
          <div className="mx-auto mb-2 h-20 w-20">
            <UserAvatar kind="rally" look="fire" name="Rally" className="h-20 w-20" />
          </div>

          <p className="font-display text-2xl font-black tracking-tight text-skill">{won ? "¡GANASTE!" : "PARTIDO CARGADO"}</p>

          {/* Marcador */}
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="flex flex-col items-center">
              <UserAvatar kind={me?.profile?.avatar_kind} look={me?.profile?.avatar_look} url={me?.profile?.avatar_url} name={myName} className="h-9 w-9" />
              <span className="mt-1 max-w-[60px] truncate text-[9px] text-white/60">{myName.split(" ")[0] || "Tú"}</span>
            </span>
            <span className="font-display text-lg font-black tabular-nums text-white">
              {v?.sets?.length ? v.sets.map((s) => `${s.me}–${s.opp}`).join("  ") : "—"}
            </span>
            <span className="flex flex-col items-center">
              <UserAvatar kind={v?.opponent_avatar_kind} look={v?.opponent_avatar_look} url={v?.opponent_avatar_url} name={v?.opponent_name ?? "Rival"} className="h-9 w-9" />
              <span className="mt-1 max-w-[60px] truncate text-[9px] text-white/60">{v?.opponent_name?.split(" ")[0] ?? "Rival"}</span>
            </span>
          </div>

          {/* Strip de recompensa (solo si está confirmado; si no, aviso) */}
          <div className="mt-4 rounded-xl bg-skill/15 px-3 py-2 text-[11px] font-bold text-skill">
            {v?.confirmed
              ? [
                  v.pts_delta != null ? `${v.pts_delta >= 0 ? "+" : ""}${Math.round(v.pts_delta)} pts` : null,
                  v.xp_delta ? `+${v.xp_delta} XP` : null,
                ].filter(Boolean).join(" · ") || "Resultado confirmado"
              : "Suma +pts y +XP cuando tu rival confirme"}
          </div>
        </div>

        {/* Acciones (sin precios) */}
        <div className="flex w-full max-w-xs gap-3">
          <Button variant="clay" size="lg" className="flex-1 gap-2" onClick={onShare}>
            <Share2 className="h-4 w-4" /> Compartir
          </Button>
          <Button variant="outline" size="lg" className="flex-1 gap-2" onClick={onDownload}>
            <Download className="h-4 w-4" /> Descargar
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Victoria;
