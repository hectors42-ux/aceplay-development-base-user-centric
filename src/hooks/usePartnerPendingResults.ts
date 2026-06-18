import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export interface PendingPartnerMatch {
  invitation_id: string;
  scheduled_at: string;
  opponent_id: string;
  opponent_name: string;
  /** "submit" = nadie cargó | "confirm" = el rival propuso, debes confirmar | "wait" = tú propusiste, espera al rival */
  needs_action: "submit" | "confirm" | "wait";
  proposed_by: string | null;
  proposed_score: unknown | null;
  proposed_winner_id: string | null;
}

interface ProfileLite {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
}

/**
 * Devuelve amistosos (partner match) que requieren acción del usuario:
 * - Aceptados con horario pasado y sin resultado (o resultado rechazado): submit
 * - Resultado propuesto por el rival: confirm
 * - Resultado propuesto por el usuario: wait
 */
export function usePartnerPendingResults() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["partner-pending-results", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<PendingPartnerMatch[]> => {
      if (!user) return [];

      // Invitaciones aceptadas que ya pasaron donde el usuario participa
      const { data: invs, error } = await supabase
        .from("match_invitations")
        .select("id, inviter_user_id, invitee_user_id, selected_slot")
        .eq("status", "accepted")
        .or(`inviter_user_id.eq.${user.id},invitee_user_id.eq.${user.id}`);
      if (error || !invs) return [];

      const nowIso = new Date().toISOString();
      const past = invs.filter((i) => {
        const s = (i.selected_slot as { starts_at?: string } | null)?.starts_at;
        return !!s && s < nowIso;
      });
      if (past.length === 0) return [];

      const ids = past.map((i) => i.id);
      const { data: results } = await supabase
        .from("partner_match_results")
        .select("invitation_id, status, proposed_by, winner_user_id, score")
        .in("invitation_id", ids);

      const resultByInv = new Map<string, NonNullable<typeof results>[number]>(
        (results ?? []).map((r) => [r.invitation_id, r]),
      );

      const opponentIds = past.map((i) =>
        i.inviter_user_id === user.id ? i.invitee_user_id : i.inviter_user_id,
      );
      const { data: profiles } = await supabase
        .from("profiles_directory")
        .select("user_id, first_name, last_name")
        .in("user_id", opponentIds);
      const profById = new Map<string, ProfileLite>(
        (profiles ?? []).map((p) => [p.user_id, p as ProfileLite]),
      );

      const out: PendingPartnerMatch[] = [];
      for (const inv of past) {
        const r = resultByInv.get(inv.id);
        // Si ya está confirmado, no es pendiente
        if (r && r.status === "confirmado") continue;

        let needs: PendingPartnerMatch["needs_action"];
        if (!r || r.status === "rechazado") needs = "submit";
        else if (r.proposed_by === user.id) needs = "wait";
        else needs = "confirm";

        const oppId = inv.inviter_user_id === user.id ? inv.invitee_user_id : inv.inviter_user_id;
        const p = profById.get(oppId);
        out.push({
          invitation_id: inv.id,
          scheduled_at: (inv.selected_slot as { starts_at: string }).starts_at,
          opponent_id: oppId,
          opponent_name:
            p?.first_name || p?.last_name
              ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
              : "Rival",
          needs_action: needs,
          proposed_by: r?.proposed_by ?? null,
          proposed_score: r?.score ?? null,
          proposed_winner_id: r?.winner_user_id ?? null,
        });
      }

      // Ordenar: confirm primero, luego submit, luego wait
      const order: Record<PendingPartnerMatch["needs_action"], number> = {
        confirm: 0,
        submit: 1,
        wait: 2,
      };
      out.sort((a, b) => order[a.needs_action] - order[b.needs_action]);
      return out;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
