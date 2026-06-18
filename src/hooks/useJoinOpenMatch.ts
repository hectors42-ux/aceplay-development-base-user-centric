// TODO: cablear fase 2
export const useJoinOpenMatch = () => {
  // TODO: cablear fase 2
  return {
    join: async (_postId: string, _slotIndex?: number) =>
      null as { post_id: string; joined_team: number; joined_slot: number } | null,
    leave: async (_postId: string) => false,
    cancel: async (_postId: string) => false,
    loading: false,
  };
};
