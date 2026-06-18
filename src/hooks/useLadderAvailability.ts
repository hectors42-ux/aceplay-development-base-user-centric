// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface DaySlot {
  startsAt: Date;
  availableCount: number;
}
export interface DayBucket {
  date: Date;
  slots: DaySlot[];
  totalAvailable: number;
}
interface Params {
  tenantId: string | null | undefined;
  surface: string | null | undefined;
  windowDays: number;
  durationMin?: number;
  enabled?: boolean;
}

export const useLadderAvailability = (_p: Params) => {
  // TODO: cablear fase 2
  return useQuery<DayBucket[]>({
    queryKey: ["stub-ladder-availability"],
    queryFn: async () => [],
    enabled: false,
  });
};
