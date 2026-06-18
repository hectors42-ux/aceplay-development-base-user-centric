const CPM_STORY = 8.5;
const CPM_POST = 12.0;
const REACH_PER_SHARE = 180;
const USD_CLP_DEFAULT = 950;

/** Estimación in-app de valor publicitario (CLP). Disclaimer obligatorio en UI. */
export function calculateAveClp(shares: number, usdClp = USD_CLP_DEFAULT): number {
  if (!shares || shares <= 0) return 0;
  const impressions = shares * REACH_PER_SHARE;
  const usd = (impressions / 1000) * ((CPM_STORY + CPM_POST) / 2);
  return Math.round(usd * usdClp);
}

export const AVE_DISCLAIMER =
  "Estimación in-app basada en CPM industria. El alcance real en RRSS lo entrega la producción del cliente.";