// TODO: cablear fase 2
export interface AmericanoRound {
  id: string;
  round_number: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
}

export function useAmericanoRounds(_categoryId: string | undefined) {
  // TODO: cablear fase 2
  return { rounds: [] as AmericanoRound[], loading: false, reload: async () => {} };
}
