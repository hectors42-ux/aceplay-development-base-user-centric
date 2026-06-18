import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PartnerPicker } from "@/components/PartnerPicker";
import { Users } from "lucide-react";
import type { OpenPost } from "@/hooks/useMatchOpenPosts";

interface Props {
  open: boolean;
  post: OpenPost | null;
  onClose: () => void;
  onConfirm: (partnerUserId: string) => Promise<void> | void;
  loading?: boolean;
}

export const OpenMatchJoinDialog = ({ open, post, onClose, onConfirm, loading }: Props) => {
  const [partnerId, setPartnerId] = useState<string | null>(null);

  const handleClose = () => {
    setPartnerId(null);
    onClose();
  };

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Unirme con mi pareja
          </DialogTitle>
          <DialogDescription>
            Este reto es pareja vs pareja. Elige a tu compañero/a para entrar al equipo rival.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mi pareja
          </p>
          <PartnerPicker
            value={partnerId}
            onChange={(id) => setPartnerId(id)}
            excludeUserId={post.user_id}
          />
          {post.level_min != null || post.level_max != null ? (
            <p className="text-[11px] text-muted-foreground">
              Tu pareja también debe tener nivel entre {post.level_min?.toFixed(1) ?? "0.0"} y{" "}
              {post.level_max?.toFixed(1) ?? "7.0"}.
            </p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="clay"
            className="flex-1"
            disabled={!partnerId || loading}
            onClick={async () => {
              if (!partnerId) return;
              await onConfirm(partnerId);
              setPartnerId(null);
            }}
          >
            {loading ? "Uniendo…" : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
