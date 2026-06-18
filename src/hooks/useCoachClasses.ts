import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export type CoachClassStatus =
  | "propuesta"
  | "confirmada"
  | "completada"
  | "cancelada"
  | "no_show";

export interface CoachClassRow {
  id: string;
  tenant_id: string;
  coach_id: string;
  court_id: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  kind: "socio_individual" | "socio_compartida" | "externa";
  student1_user_id: string | null;
  student2_user_id: string | null;
  external_student_name: string | null;
  external_student_phone: string | null;
  status: CoachClassStatus;
  payment_status: "pendiente" | "pagada" | "anulada";
  price_clp: number;
  notes: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  completed_at: string | null;
  paid_at: string | null;
}

export interface CoachClassEnriched extends CoachClassRow {
  coach_name: string;
  coach_avatar: string | null;
  court_name: string;
  student1_name: string | null;
  student2_name: string | null;
}

const enrich = async (rows: CoachClassRow[]): Promise<CoachClassEnriched[]> => {
  if (!rows.length) return [];
  const coachIds = [...new Set(rows.map((r) => r.coach_id))];
  const courtIds = [...new Set(rows.map((r) => r.court_id))];
  const studentIds = [
    ...new Set(
      rows.flatMap((r) => [r.student1_user_id, r.student2_user_id]).filter(Boolean) as string[],
    ),
  ];

  const [coachesRes, courtsRes] = await Promise.all([
    supabase.from("coach_profiles").select("id, user_id, photo_url").in("id", coachIds),
    supabase.from("courts").select("id, name").in("id", courtIds),
  ]);

  const coachUserIds = (coachesRes.data ?? []).map((c) => c.user_id);
  const allProfileIds = [...new Set([...coachUserIds, ...studentIds])];
  const profilesRes = allProfileIds.length
    ? await supabase
        .from("profiles_directory")
        .select("user_id, first_name, last_name, avatar_url")
        .in("user_id", allProfileIds)
    : { data: [] };

  type ProfMini = { user_id: string; first_name: string; last_name: string; avatar_url: string | null };
  type CoachMini = { id: string; user_id: string; photo_url: string | null };
  const profByUserId = new Map<string, ProfMini>(
    (profilesRes.data ?? []).map((p) => [p.user_id, p as ProfMini]),
  );
  const coachByCoachId = new Map<string, CoachMini>(
    (coachesRes.data ?? []).map((c) => [c.id, c as CoachMini]),
  );
  const courtById = new Map<string, string>(
    (courtsRes.data ?? []).map((c) => [c.id, c.name as string]),
  );

  const fullName = (uid: string | null) => {
    if (!uid) return null;
    const p = profByUserId.get(uid);
    return p ? `${p.first_name} ${p.last_name}` : null;
  };

  return rows.map((r) => {
    const coach = coachByCoachId.get(r.coach_id);
    const coachProfile = coach ? profByUserId.get(coach.user_id) : undefined;
    return {
      ...r,
      coach_name: coachProfile
        ? `${coachProfile.first_name} ${coachProfile.last_name}`
        : "Coach",
      coach_avatar: coach?.photo_url ?? coachProfile?.avatar_url ?? null,
      court_name: courtById.get(r.court_id) ?? "Cancha",
      student1_name: fullName(r.student1_user_id) ?? r.external_student_name,
      student2_name: fullName(r.student2_user_id),
    };
  });
};

/** Clases donde soy alumno (1 o 2) */
export const useMyStudentClasses = () => {
  const { user, profile } = useAuth();

  return useQuery({
    queryKey: ["my-student-classes", user?.id],
    enabled: !!user?.id && !!profile?.tenant_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_class_bookings")
        .select("*")
        .eq("tenant_id", profile!.tenant_id)
        .or(`student1_user_id.eq.${user!.id},student2_user_id.eq.${user!.id}`)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return enrich((data ?? []) as CoachClassRow[]);
    },
  });
};

/** Clases del coach autenticado */
export const useMyCoachClasses = (coachId: string | null | undefined) => {
  return useQuery({
    queryKey: ["my-coach-classes", coachId],
    enabled: !!coachId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_class_bookings")
        .select("*")
        .eq("coach_id", coachId!)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return enrich((data ?? []) as CoachClassRow[]);
    },
  });
};

/** Clases existentes (confirmadas + propuestas) para detectar slots ocupados */
export const useCoachUpcomingClasses = (coachId: string | null | undefined) => {
  return useQuery({
    queryKey: ["coach-upcoming-classes", coachId],
    enabled: !!coachId,
    queryFn: async () => {
      const fromIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("coach_class_bookings")
        .select("id, coach_id, court_id, starts_at, ends_at, status, kind")
        .eq("coach_id", coachId!)
        .in("status", ["propuesta", "confirmada"])
        .gte("starts_at", fromIso)
        .order("starts_at");
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useClassBlocks = (coachId?: string | null) => {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["class-blocks", profile?.tenant_id, coachId ?? "any"],
    enabled: !!profile?.tenant_id,
    queryFn: async () => {
      let query = supabase
        .from("coach_class_blocks")
        .select("*")
        .eq("tenant_id", profile!.tenant_id)
        .eq("is_active", true);
      if (coachId) {
        query = query.or(`coach_id.is.null,coach_id.eq.${coachId}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
};
