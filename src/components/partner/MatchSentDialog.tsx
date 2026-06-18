import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const initials = (a?: string | null, b?: string | null) =>
  `${a?.[0] ?? ""}${b?.[0] ?? ""}`.toUpperCase() || "?";

interface Props {
  open: boolean;
  onClose: () => void;
  partner: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
  me: { first_name?: string | null; last_name?: string | null; avatar_url?: string | null } | null;
  compatScore?: number | null;
  onKeepBrowsing?: () => void;
}

/**
 * Pantalla "Es un match" — referencia imagen 18.
 */
export const MatchSentDialog = ({
  open,
  onClose,
  partner,
  me,
  compatScore,
  onKeepBrowsing,
}: Props) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-md overflow-hidden rounded-3xl border-0 p-0 text-[hsl(var(--cream-0))]"
        style={{ background: "hsl(var(--ink-dark))" }}
      >
        <div
          className="relative px-8 pb-8 pt-12"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.45) 0%, transparent 60%)",
          }}
        >
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-[hsl(var(--cream-0))]/60">
            Invitación enviada
          </p>
          <h2 className="mt-3 text-center font-display text-3xl font-semibold leading-tight">
            ¡A preparar las <em className="italic text-primary">raquetas</em>!
          </h2>
          <p className="mx-auto mt-3 max-w-[280px] text-center text-xs text-[hsl(var(--cream-0))]/70">
            {partner?.first_name} recibirá tu desafío. Si acepta uno de tus horarios,
            ambos podrán reservar la cancha y salir a competir.
          </p>

          {/* Avatares vs */}
          <div className="mt-8 flex items-center justify-center gap-6">
            <Avatar className="h-20 w-20 ring-2 ring-primary/40 ring-offset-2 ring-offset-[hsl(var(--ink-dark))]">
              <AvatarImage src={me?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-[hsl(var(--cream-2))] font-display text-2xl text-[hsl(var(--ink-dark))]">
                {initials(me?.first_name, me?.last_name)}
              </AvatarFallback>
            </Avatar>
            <span className="font-display text-lg italic text-[hsl(var(--cream-0))]/60">vs</span>
            <Avatar className="h-20 w-20 ring-2 ring-primary/40 ring-offset-2 ring-offset-[hsl(var(--ink-dark))]">
              <AvatarImage src={partner?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-[hsl(var(--cream-2))] font-display text-2xl text-[hsl(var(--ink-dark))]">
                {initials(partner?.first_name, partner?.last_name)}
              </AvatarFallback>
            </Avatar>
          </div>

          {compatScore != null && (
            <div className="mt-6 flex justify-center">
              <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-[11px] font-medium text-primary">
                {compatScore}% de compatibilidad
              </span>
            </div>
          )}

          <div className="mt-8 space-y-2">
            <Button
              variant="clay"
              className="h-12 w-full text-sm font-semibold"
              onClick={onClose}
            >
              Ver mis invitaciones enviadas
            </Button>
            <Button
              variant="ghost"
              className="h-11 w-full text-sm text-[hsl(var(--cream-0))] hover:bg-[hsl(var(--cream-0))]/10 hover:text-[hsl(var(--cream-0))]"
              onClick={() => {
                onClose();
                onKeepBrowsing?.();
              }}
            >
              Seguir buscando
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
