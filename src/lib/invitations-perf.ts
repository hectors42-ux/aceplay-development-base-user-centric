// Telemetría liviana para invitaciones: tiempos de carga y latencia de realtime.
// Se loguea siempre (info) para poder diagnosticar en preview/producción; agrupa por origen.

type Origin = "initial" | "manual" | "realtime";

interface PerfSample {
  origin: Origin;
  ms: number;
  invitationsMs: number;
  profilesMs: number;
  count: number;
  realtimeLatencyMs?: number;
  at: number;
}

const ring: PerfSample[] = [];
const MAX = 30;

export const recordInvitationsPerf = (s: PerfSample) => {
  ring.push(s);
  if (ring.length > MAX) ring.shift();
  const extra =
    s.realtimeLatencyMs !== undefined
      ? ` · rtLatency=${s.realtimeLatencyMs.toFixed(0)}ms`
      : "";
  // eslint-disable-next-line no-console
  console.info(
    `[invitations:${s.origin}] total=${s.ms.toFixed(0)}ms ` +
      `(inv=${s.invitationsMs.toFixed(0)}ms, prof=${s.profilesMs.toFixed(0)}ms, n=${s.count})${extra}`,
  );
  if (typeof performance !== "undefined" && performance.mark) {
    try {
      performance.mark(`invitations:${s.origin}:${s.at}`);
    } catch {
      /* noop */
    }
  }
};

export const getInvitationsPerfSamples = () => [...ring];

// Exponer en window para inspección manual en preview (devtools).
if (typeof window !== "undefined") {
  (window as unknown as { __invitationsPerf?: () => PerfSample[] }).__invitationsPerf =
    getInvitationsPerfSamples;
}
