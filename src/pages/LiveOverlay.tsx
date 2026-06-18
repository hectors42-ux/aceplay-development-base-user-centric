import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useLiveTournament } from "@/hooks/useLiveOverlay";
import { StandingsOverlay } from "@/components/overlay/StandingsOverlay";
import { NowPlayingOverlay } from "@/components/overlay/NowPlayingOverlay";
import { LowerThirdOverlay } from "@/components/overlay/LowerThirdOverlay";
import { BracketOverlay } from "@/components/overlay/BracketOverlay";

const LAYOUTS = ["standings", "now_playing", "lower_third", "bracket"] as const;
type Layout = (typeof LAYOUTS)[number];

export default function LiveOverlay() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const layout = (params.get("layout") ?? "standings") as Layout;
  const { tournament, loading, notFound } = useLiveTournament(slug);
  const isLowerThird = layout === "lower_third";

  // OBS friendliness: kill body bg, scroll, padding.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevBg = body.style.background;
    const prevOverflow = body.style.overflow;
    const prevMargin = body.style.margin;
    body.style.background = isLowerThird ? "transparent" : "#0a0604";
    html.style.background = isLowerThird ? "transparent" : "#0a0604";
    body.style.overflow = "hidden";
    body.style.margin = "0";
    return () => {
      body.style.background = prevBg;
      html.style.background = "";
      body.style.overflow = prevOverflow;
      body.style.margin = prevMargin;
    };
  }, [isLowerThird]);

  if (loading) {
    return <div style={{ width: "100vw", height: "100vh", background: "transparent" }} />;
  }

  if (notFound || !tournament) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="font-display text-2xl italic opacity-70">Stream no disponible.</p>
      </div>
    );
  }

  const W = 1920;
  const H = isLowerThird ? 270 : 1080;
  const bg = isLowerThird ? "transparent" : tournament.cobrand?.gradient_css ?? "linear-gradient(135deg,#2b1b12,#b6502b)";

  return (
    <div
      style={{
        width: `${W}px`,
        height: `${H}px`,
        background: bg,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {layout === "standings" && <StandingsOverlay slug={slug!} tournament={tournament} />}
      {layout === "now_playing" && <NowPlayingOverlay slug={slug!} tournament={tournament} />}
      {layout === "lower_third" && <LowerThirdOverlay slug={slug!} tournament={tournament} />}
      {layout === "bracket" && <BracketOverlay tournament={tournament} />}
    </div>
  );
}