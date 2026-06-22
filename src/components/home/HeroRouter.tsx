import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBookingsProvider } from "@/hooks/useBookingsProvider";
import { isModuleEnabled } from "@/config/modules";
import { useUserActiveTournament } from "@/hooks/useUserActiveTournament";
import { useMatchOfTheWeek, type MotwRow } from "@/hooks/useMatchOfTheWeek";
import { usePartnerSuggestions } from "@/hooks/usePartnerSuggestions";
import { useMatchSearchFilters } from "@/hooks/useMatchSearchFilters";
import { HeroShell, HeroSkeleton } from "./hero/HeroShell";
import { HeroBookingNext } from "./hero/HeroBookingNext";
import { HeroTournament } from "./hero/HeroTournament";
import { HeroMatchupOfTheWeek } from "./hero/HeroMatchupOfTheWeek";
import { HeroSuggestedRival } from "./hero/HeroSuggestedRival";
import { HeroIdle } from "./hero/HeroIdle";

interface NextBooking {
  id: string;
  starts_at: string;
  ends_at: string;
  court_name: string | null;
  other_first_name: string | null;
  other_last_name: string | null;
  i_am_owner: boolean;
}

/**
 * Selector del Hero del Home según contexto del usuario:
 *  1. Reservas internas + próxima reserva  → HeroBookingNext
 *  2. Torneo activo donde está inscrito    → HeroTournament
 *  3. MOTW del club que lo involucra       → HeroMatchupOfTheWeek
 *  4. Sugerencia personal de rival         → HeroSuggestedRival
 *  5. Fallback neutro                      → HeroIdle
 */
export const HeroRouter = () => {
  const { user, profile } = useAuth();
  const { isExternal, isLoading: providerLoading } = useBookingsProvider();

  // Próxima reserva (solo modo interno)
  const [next, setNext] = useState<NextBooking | null>(null);
  const [nextLoading, setNextLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNextLoading(false);
      return;
    }
    // Reservas dormidas o externas: no consultamos el RPC (no existe en el core).
    if (isExternal || !isModuleEnabled("reservas")) {
      setNext(null);
      setNextLoading(false);
      return;
    }
    let cancel = false;
    (async () => {
      const { data } = await supabase.rpc("my_upcoming_bookings", { _limit: 1 });
      if (cancel) return;
      const row = (data ?? [])[0] as NextBooking | undefined;
      setNext(row ?? null);
      setNextLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [user, isExternal]);

  const { data: activeTournament, loading: tournamentLoading } = useUserActiveTournament();
  const { items: motwItems, loading: motwLoading } = useMatchOfTheWeek();
  const { rows: suggestions, loading: suggLoading } = usePartnerSuggestions(50);
  const { filters } = useMatchSearchFilters();

  if (providerLoading || nextLoading) return <HeroSkeleton />;

  // 1) Próxima reserva interna
  if (!isExternal && next) {
    return (
      <HeroShell>
        <HeroBookingNext next={next} />
      </HeroShell>
    );
  }

  if (tournamentLoading) return <HeroSkeleton />;

  // 2) Torneo activo
  if (activeTournament) {
    return (
      <HeroShell>
        <HeroTournament info={activeTournament} />
      </HeroShell>
    );
  }

  if (motwLoading) return <HeroSkeleton />;

  // 3) MOTW del club que involucra al usuario
  const myMotw: MotwRow | undefined = motwItems.find(
    (m) => m.player_a_id === user?.id || m.player_b_id === user?.id,
  );
  if (myMotw) {
    const isPlayerA = myMotw.player_a_id === user?.id;
    const rivalName = (isPlayerA ? myMotw.player_b_name : myMotw.player_a_name) ?? "Rival";
    const rivalAvatar = (isPlayerA ? myMotw.player_b_avatar : myMotw.player_a_avatar) ?? null;
    const myAvatar = (isPlayerA ? myMotw.player_a_avatar : myMotw.player_b_avatar) ?? null;
    const myName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Tú";
    return (
      <HeroShell>
        <HeroMatchupOfTheWeek
          motw={myMotw}
          rivalName={rivalName}
          rivalAvatar={rivalAvatar}
          myAvatar={myAvatar}
          myName={myName}
        />
      </HeroShell>
    );
  }

  if (suggLoading) return <HeroSkeleton />;

  // 4) Sugerencia personalizada — debe coincidir con el primero de Buscar (mismo filtro level_delta)
  const topSuggestion = suggestions.find(
    (s) => s.level_diff == null || Math.abs(s.level_diff) <= filters.level_delta + 0.01,
  );
  if (topSuggestion) {
    return (
      <HeroShell>
        <HeroSuggestedRival rival={topSuggestion} />
      </HeroShell>
    );
  }

  // 5) Fallback neutro
  return (
    <HeroShell>
      <HeroIdle />
    </HeroShell>
  );
};
