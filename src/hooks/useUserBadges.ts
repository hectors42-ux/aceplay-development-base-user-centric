// TODO: cablear fase 2
export type Badge = any;
export type UserBadge = any & { badge?: Badge };

export const useUserBadges = (_userId?: string) => {
  // TODO: cablear fase 2
  return { items: [] as UserBadge[], allBadges: [] as Badge[], loading: false };
};
