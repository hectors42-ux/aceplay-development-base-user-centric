// TODO: cablear fase 2
export interface OpenSlotRow {
  id: string;
  team: number;
  slot_index: number;
  user_id: string | null;
  joined_at: string | null;
  profile?: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
}

export interface OpenPost {
  id: string;
  user_id: string;
  format: "1set" | "best_of_3" | "best_of_5";
  available_slots: Array<{ starts_at: string }>;
  note: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  match_type: "singles" | "doubles";
  slots?: OpenSlotRow[];
  overlap_count?: number;
  author_name?: string;
  author_avatar?: string | null;
}

export const useMatchOpenPosts = () => {
  // TODO: cablear fase 2
  return {
    posts: [] as OpenPost[],
    loading: false,
    refresh: async () => {},
    currentUserId: undefined as string | undefined,
  };
};
