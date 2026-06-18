import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

export function LiveBadge({ size = "lg" }: { size?: "sm" | "lg" }) {
  const reduced = usePrefersReducedMotion();
  const big = size === "lg";
  return (
    <div className={`inline-flex items-center gap-3 ${big ? "text-2xl" : "text-base"}`}>
      <span
        className={`inline-block rounded-full bg-red-500 ${big ? "h-4 w-4" : "h-2.5 w-2.5"} ${
          reduced ? "" : "animate-pulse"
        }`}
      />
      <span className="font-mono font-bold uppercase tracking-[0.4em] text-white">EN VIVO</span>
    </div>
  );
}