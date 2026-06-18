import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";

export interface AdminClassBlock {
  id: string;
  tenant_id: string;
  court_id: string;
  coach_id: string | null;
  weekday: number;
  starts_at: string;
  ends_at: string;
  allow_external: boolean;
  notes: string | null;
  is_active: boolean;
}

export const useAdminClassBlocks = () => {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["admin-class-blocks", profile?.tenant_id],
    enabled: !!profile?.tenant_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_class_blocks")
        .select("*")
        .eq("tenant_id", profile!.tenant_id)
        .order("weekday")
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as AdminClassBlock[];
    },
  });
};

export const useUpsertClassBlock = () => {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (block: Partial<AdminClassBlock> & { id?: string }) => {
      if (block.id) {
        const { error } = await supabase
          .from("coach_class_blocks")
          .update(block)
          .eq("id", block.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coach_class_blocks").insert({
          tenant_id: profile!.tenant_id,
          court_id: block.court_id!,
          coach_id: block.coach_id ?? null,
          weekday: block.weekday!,
          starts_at: block.starts_at!,
          ends_at: block.ends_at!,
          allow_external: block.allow_external ?? true,
          notes: block.notes ?? null,
          is_active: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Bloque guardado");
      qc.invalidateQueries({ queryKey: ["admin-class-blocks"] });
      qc.invalidateQueries({ queryKey: ["class-blocks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteClassBlock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coach_class_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bloque eliminado");
      qc.invalidateQueries({ queryKey: ["admin-class-blocks"] });
      qc.invalidateQueries({ queryKey: ["class-blocks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

/** Liquidaciones consolidadas por coach (clases completadas) */
export const useCoachSettlements = () => {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["coach-settlements", profile?.tenant_id],
    enabled: !!profile?.tenant_id,
    queryFn: async () => {
      const { data: classes, error } = await supabase
        .from("coach_class_bookings")
        .select("id, coach_id, price_clp, payment_status, status, completed_at")
        .eq("tenant_id", profile!.tenant_id)
        .eq("status", "completada");
      if (error) throw error;

      const coachIds = [...new Set((classes ?? []).map((c) => c.coach_id))];
      if (!coachIds.length) return [];

      const { data: coaches } = await supabase
        .from("coach_profiles")
        .select("id, user_id")
        .in("id", coachIds);

      const userIds = (coaches ?? []).map((c) => c.user_id);
      const { data: profs } = userIds.length
        ? await supabase
            .from("profiles")
            .select("user_id, first_name, last_name, avatar_url")
            .in("user_id", userIds)
        : { data: [] };

      const profByUid = new Map((profs ?? []).map((p) => [p.user_id, p]));
      const coachByCoachId = new Map((coaches ?? []).map((c) => [c.id, c]));

      const grouped = coachIds.map((coachId) => {
        const coach = coachByCoachId.get(coachId);
        const prof = coach ? profByUid.get(coach.user_id) : null;
        const myClasses = (classes ?? []).filter((c) => c.coach_id === coachId);
        const pending = myClasses.filter((c) => c.payment_status === "pendiente");
        const paid = myClasses.filter((c) => c.payment_status === "pagada");
        return {
          coach_id: coachId,
          name: prof ? `${prof.first_name} ${prof.last_name}` : "Coach",
          avatar_url: prof?.avatar_url ?? null,
          completed_count: myClasses.length,
          pending_count: pending.length,
          pending_clp: pending.reduce((s, c) => s + (c.price_clp ?? 0), 0),
          paid_clp: paid.reduce((s, c) => s + (c.price_clp ?? 0), 0),
          total_clp: myClasses.reduce((s, c) => s + (c.price_clp ?? 0), 0),
        };
      });

      return grouped.sort((a, b) => b.pending_clp - a.pending_clp);
    },
  });
};

export const useMarkAllPaid = () => {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (coachId: string) => {
      const { error } = await supabase
        .from("coach_class_bookings")
        .update({ payment_status: "pagada", paid_at: new Date().toISOString() })
        .eq("tenant_id", profile!.tenant_id)
        .eq("coach_id", coachId)
        .eq("status", "completada")
        .eq("payment_status", "pendiente");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Liquidación registrada");
      qc.invalidateQueries({ queryKey: ["coach-settlements"] });
      qc.invalidateQueries({ queryKey: ["my-coach-classes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
