// TODO: cablear fase 2
export type LegalDoc = any;
export type LegalKind = string;

export const useLegalDocs = (_kinds?: LegalKind[]) => {
  // TODO: cablear fase 2
  return { docs: [] as LegalDoc[], loading: false };
};
