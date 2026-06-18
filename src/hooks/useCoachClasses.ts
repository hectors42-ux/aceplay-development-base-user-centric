// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export type CoachClassStatus =
  | "propuesta"
  | "confirmada"
  | "cancelada"
  | "completada"
  | "no_show";

export interface CoachClassRow {
  id: string;
  tenant_id: string;
  coach_id: string;
  student_user_id: string;
  court_id: string;
  starts_at: string;
  ends_at: string;
  status: CoachClassStatus;
  price_clp: number | null;
  payment_status: string | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CoachClassEnriched extends CoachClassRow {
  coach_name?: string | null;
  student_name?: string | null;
  court_name?: string | null;
}

const emptyQuery = <T>(key: string) =>
  useQuery<T[]>({ queryKey: [key], queryFn: async () => [], enabled: false });

export const useMyStudentClasses = () => emptyQuery<CoachClassEnriched>("stub-my-student-classes");
export const useMyCoachClasses = (_coachId: string | null | undefined) =>
  emptyQuery<CoachClassEnriched>("stub-my-coach-classes");
export const useCoachUpcomingClasses = (_coachId: string | null | undefined) =>
  emptyQuery<CoachClassRow>("stub-coach-upcoming");
export const useClassBlocks = (_coachId?: string | null) =>
  emptyQuery<any>("stub-class-blocks");
