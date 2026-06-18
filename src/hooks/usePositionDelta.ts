// TODO: cablear fase 2
export interface PositionDelta {
  delta: number;
  from: number | null;
  to: number | null;
}

export function usePositionDelta(
  _categoryId: string | null | undefined,
  _userId: string | null | undefined,
): PositionDelta {
  // TODO: cablear fase 2
  return { delta: 0, from: null, to: null };
}
