import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useJoinOpenMatch = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const join = async (
    postId: string,
    opts?: { slotIndex?: number; partnerUserId?: string | null },
  ) => {
    setLoading(true);
    const { data, error } = await supabase.rpc("join_open_match", {
      _post_id: postId,
      _slot_index: opts?.slotIndex ?? null,
      _partner_user_id: opts?.partnerUserId ?? null,
    } as never);
    setLoading(false);
    if (error) {
      toast({ title: "No te pudiste unir", description: error.message, variant: "destructive" });
      return null;
    }
    toast({ title: "¡Te uniste al partido!", description: "El autor recibirá una notificación." });
    return data as { post_id: string; joined_team: number; joined_slot: number };
  };

  const leave = async (postId: string) => {
    setLoading(true);
    const { error } = await supabase.rpc("leave_open_match", { _post_id: postId });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Saliste del partido" });
    return true;
  };

  const cancel = async (postId: string) => {
    setLoading(true);
    const { error } = await supabase.rpc("cancel_open_match", { _post_id: postId });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Reto cancelado" });
    return true;
  };

  return { join, leave, cancel, loading };
};
