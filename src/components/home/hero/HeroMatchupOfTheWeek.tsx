import { Link } from "react-router-dom";
import { Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MotwRow } from "@/hooks/useMatchOfTheWeek";

const initial = (name?: string) => (name ?? "?").trim().charAt(0).toUpperCase();

/**
 * Variante del Hero: el "Duelo de la semana" del club involucra al usuario.
 * CTA principal lleva a Competir para iniciar el desafío hacia ese rival.
 */
export const HeroMatchupOfTheWeek = ({
  motw,
  rivalName,
  rivalAvatar,
  myAvatar,
  myName,
}: {
  motw: MotwRow;
  rivalName: string;
  rivalAvatar: string | null;
  myAvatar: string | null;
  myName: string;
}) => {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground backdrop-blur-md">
          <Zap className="h-3 w-3" strokeWidth={2.6} />
          Duelo de la semana · Te involucra
        </div>
      </div>

      <div className="space-y-1 text-white">
        <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight md:text-4xl">
          Tú vs {rivalName}
        </h1>
        {motw.level_diff != null && (
          <p className="text-xs text-white/85">
            Diferencia de nivel: {Math.abs(Number(motw.level_diff)).toFixed(1)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 ring-2 ring-white/40">
          <AvatarImage src={myAvatar ?? undefined} alt={myName} />
          <AvatarFallback>{initial(myName)}</AvatarFallback>
        </Avatar>
        <span className="font-display text-xs uppercase tracking-wider text-white/70">VS</span>
        <Avatar className="h-12 w-12 ring-2 ring-white/40">
          <AvatarImage src={rivalAvatar ?? undefined} alt={rivalName} />
          <AvatarFallback>{initial(rivalName)}</AvatarFallback>
        </Avatar>
      </div>

      {motw.highlight_label && (
        <p className="line-clamp-2 text-sm italic text-white/85">"{motw.highlight_label}"</p>
      )}

      <Link to="/ranking?tab=partner" className="w-fit">
        <Button variant="clay" size="lg" aria-label="Desafiar a este rival">
          Desafiar ahora
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </Button>
      </Link>
    </>
  );
};
