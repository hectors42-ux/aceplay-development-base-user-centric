import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type Space = {
  id: string;
  name: string;
  type: string;
  visibility: string;
  join_policy: string;
  parent_space_id: string | null;
  settings: Record<string, unknown> | null;
};

export function JoinButton({ space, compact }: { space: Space; compact?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);

  const insert = async (status: "active" | "pending") => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("space_membership").insert({
      player_id: user.id,
      space_id: space.id,
      role: "player",
      status,
    });
    setBusy(false);
    if (error) {
      if (error.code === "23505") {
        toast.message("Ya estás inscrito en este espacio.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-spaces"] });
    qc.invalidateQueries({ queryKey: ["space", space.id] });
    qc.invalidateQueries({ queryKey: ["space-members", space.id] });
    toast.success(status === "active" ? "Te uniste al espacio" : "Solicitud enviada");
  };

  const onJoin = async () => {
    if (!user) return;
    const policy = space.join_policy;
    if (policy === "open") {
      await insert("active");
      return;
    }
    if (policy === "socios_only") {
      if (!space.parent_space_id) {
        toast.error("Espacio mal configurado.");
        return;
      }
      const { data } = await supabase
        .from("space_membership")
        .select("id")
        .eq("player_id", user.id)
        .eq("space_id", space.parent_space_id)
        .eq("status", "active")
        .maybeSingle();
      if (!data) {
        toast.error("Solo para socios del club");
        return;
      }
      await insert("active");
      return;
    }
    if (policy === "request" || policy === "invite") {
      await insert("pending");
      return;
    }
    if (policy === "code") {
      setShowCode(true);
      const expected = (space.settings?.["code"] as string | undefined) ?? "";
      if (!code) return;
      if (code !== expected) {
        toast.error("Código inválido");
        return;
      }
      await insert("active");
      setShowCode(false);
      setCode("");
    }
  };

  if (space.join_policy === "code" && showCode) {
    return (
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código"
          className="h-9 w-28"
        />
        <Button size="sm" onClick={onJoin} disabled={busy}>
          Validar
        </Button>
      </div>
    );
  }

  return (
    <Button size={compact ? "sm" : "default"} onClick={onJoin} disabled={busy}>
      {space.join_policy === "request" || space.join_policy === "invite"
        ? "Solicitar"
        : "Unirme"}
    </Button>
  );
}