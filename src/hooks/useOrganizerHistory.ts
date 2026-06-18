// TODO: cablear fase 2
import { useQuery } from "@tanstack/react-query";

export interface PodiumPlayer {
  user_id: string;
  name: string;
}
export interface PodiumCategory {
  category_id: string;
  category_name: string;
  champion: PodiumPlayer | null;
  runner_up: PodiumPlayer | null;
  third_place: PodiumPlayer | null;
}
export interface ClosingSummary {
  total_matches: number;
  walkovers: number;
  reschedules: number;
  satisfaction_avg: number | null;
}
export interface OrganizerHistoryRow {
  tournament_id: string;
  tournament_name: string;
  tournament_slug: string;
  closed_at: string;
  categories: PodiumCategory[];
  summary: ClosingSummary;
}

export function useOrganizerHistory(_userId: string | null | undefined) {
  // TODO: cablear fase 2
  return useQuery<OrganizerHistoryRow[]>({
    queryKey: ["stub-organizer-history"],
    queryFn: async () => [],
    enabled: false,
  });
}
