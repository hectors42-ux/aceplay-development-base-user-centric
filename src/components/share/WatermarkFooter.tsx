import { Flag } from "@/components/tournaments/cobrand/Flag";

interface Props {
  handle: string;
  cobrandName?: string | null;
  flagCountry?: string | null;
  inviteUrl: string;
}

/**
 * Footer obligatorio de toda share card.
 * Lockup co-marca + invite-loop URL + handle del jugador.
 */
export function WatermarkFooter({ handle, cobrandName, flagCountry, inviteUrl }: Props) {
  return (
    <div className="flex items-end justify-between gap-3 text-white/90">
      <div>
        <p
          className="text-[10px] uppercase tracking-[0.32em] opacity-80"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          Juega en AcePlay
        </p>
        <p className="mt-0.5 font-display text-xl font-semibold leading-none">{handle}</p>
      </div>
      <div className="text-right">
        <div
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.28em] opacity-85"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          <Flag countryCode={flagCountry} size={11} />
          {cobrandName ? `Aceplay × ${cobrandName}` : "Aceplay"}
        </div>
        <p className="mt-0.5 text-[10px] opacity-70">{inviteUrl}</p>
      </div>
    </div>
  );
}