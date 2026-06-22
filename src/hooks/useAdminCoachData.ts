// TODO: cablear fase 2
import { useQuery, useMutation } from "@tanstack/react-query";

export interface AdminClassBlock {
  id: string;
  court_id: string;
  coach_id: string | null;
  weekday: number;
  starts_at: string;
  ends_at: string;
  allow_external: boolean;
  notes: string | null;
  is_active: boolean;
}

export const useAdminClassBlocks = () =>
  useQuery<AdminClassBlock[]>({
    queryKey: ["stub-admin-class-blocks"],
    queryFn: async () => [],
    enabled: false,
  });

export const useUpsertClassBlock = () =>
  useMutation({ mutationFn: async (_b: Partial<AdminClassBlock> & { id?: string }) => {} });

export const useDeleteClassBlock = () =>
  useMutation({ mutationFn: async (_id: string) => {} });

export const useCoachSettlements = () =>
  useQuery<any[]>({
    queryKey: ["stub-coach-settlements"],
    queryFn: async () => [],
    enabled: false,
  });

export const useMarkAllPaid = () =>
  useMutation({ mutationFn: async (_coachId: string) => {} });
