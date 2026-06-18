import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useCompactViewport } from "@/hooks/use-compact-viewport";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Sparkles, Inbox, Send, Search, Plus, Calendar } from "lucide-react";
import { PlayerProfileDrawer } from "@/components/profile/PlayerProfileDrawer";
import { useUserAvailability } from "@/hooks/useUserAvailability";
import { usePartnerSuggestions, type PartnerSuggestion } from "@/hooks/usePartnerSuggestions";
import { useMatchInvitations } from "@/hooks/useMatchInvitations";
import { useMatchOpenPosts } from "@/hooks/useMatchOpenPosts";
import { useMyRating } from "@/hooks/useMyRating";
import { useMatchSearchFilters } from "@/hooks/useMatchSearchFilters";
import { useAuth } from "@/components/providers/AuthProvider";
import { useActiveSport } from "@/components/providers/SportProvider";
import { useNavigate } from "react-router-dom";
import { RecentPartnersStrip } from "./RecentPartnersStrip";
import { PartnerSearchFiltersCard } from "./PartnerSearchFiltersCard";
import { PartnerSwipeStack } from "./PartnerSwipeStack";
import { PartnerOnboardingSheet } from "./PartnerOnboardingSheet";
import { InvitePartnerDialog } from "./InvitePartnerDialog";
import { MatchSentDialog } from "./MatchSentDialog";
import { OpenMatchWizard } from "./OpenMatchWizard";
import { OpenMatchCard } from "./OpenMatchCard";
import { OpenMatchJoinDialog } from "./OpenMatchJoinDialog";
import type { OpenPost } from "@/hooks/useMatchOpenPosts";
import { useJoinOpenMatch } from "@/hooks/useJoinOpenMatch";
import { PaginatedInvitations } from "./PaginatedInvitations";

type SearchPhase = "filters" | "swiping" | "empty";

interface PartnerLite {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export const PartnerSearchView = () => {
  const { user, profile } = useAuth();
  const { ratingSport, sport: activeSport } = useActiveSport();
  const navigate = useNavigate();

  const { hasAvailability, loading: availLoading, refresh: refreshAvail } = useUserAvailability();
  const { rating } = useMyRating();
  const { rows: suggestions, loading: sugLoading, refresh: refreshSug } = usePartnerSuggestions(50, ratingSport);
  const { received, sent, refresh: refreshInv } = useMatchInvitations();
  const { posts, loading: postsLoading, currentUserId, refresh: refreshPosts } = useMatchOpenPosts();
  const { join: joinOpen, leave: leaveOpen, cancel: cancelOpen, loading: openLoading } = useJoinOpenMatch();
  const { filters, setFilters, persist } = useMatchSearchFilters();

  const [phase, setPhase] = useState<SearchPhase>("swiping");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const compact = useCompactViewport();
  const [showOpenComposer, setShowOpenComposer] = useState(false);
  const [invitePartner, setInvitePartner] = useState<PartnerLite | null>(null);
  const [matchSent, setMatchSent] = useState<{ partner: PartnerLite; score?: number | null } | null>(null);
  const [pairJoinPost, setPairJoinPost] = useState<OpenPost | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPTab = (() => {
    const t = searchParams.get("pTab");
    return t === "reto" || t === "invitaciones" ? t : "sugeridos";
  })();
  const initialInvTab = searchParams.get("invTab") === "enviadas" ? "enviadas" : "recibidas";
  const [mainTab, setMainTab] = useState<string>(initialPTab);
  const [invTab, setInvTab] = useState<string>(initialInvTab);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  // Reaccionar a cambios de query params (e.g. al hacer click en notificación con la vista ya montada)
  useEffect(() => {
    const pTab = searchParams.get("pTab");
    const it = searchParams.get("invTab");
    if (pTab === "sugeridos" || pTab === "reto" || pTab === "invitaciones") {
      setMainTab(pTab);
    }
    if (it === "enviadas" || it === "recibidas") {
      setInvTab(it);
    }
  }, [searchParams]);

  // Filtrado client-side. level_diff null = sin rating en este deporte → pasa (En calibración).
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((s) => {
      if (skipped.has(s.user_id)) return false;
      if (s.level_diff != null && Math.abs(s.level_diff) > filters.level_delta + 0.01) return false;
      return true;
    });
  }, [suggestions, skipped, filters.level_delta]);

  const pendingReceived = received.filter((i) => i.status === "pending").length;
  const pendingSent = sent.filter((i) => i.status === "pending").length;

  // Retos abiertos donde participo: soy autor o estoy en algún slot.
  const myOpenPosts = useMemo(
    () =>
      posts.filter(
        (p) =>
          p.user_id === currentUserId ||
          p.slots.some((s) => s.user_id === currentUserId),
      ),
    [posts, currentUserId],
  );

  const needsOnboarding = !availLoading && !hasAvailability;

  // Sólo saltar a empty cuando ya terminó de cargar Y hay 0 candidatos tras filtros.
  // Si todavía está cargando (sugLoading) no se decide nada.
  useEffect(() => {
    if (sugLoading) return;
    if (phase === "swiping" && filteredSuggestions.length === 0) {
      setPhase("empty");
    }
  }, [phase, sugLoading, filteredSuggestions.length]);

  // Al cambiar de deporte: reset skipped + volver a swiping para mostrar la nueva lista.
  useEffect(() => {
    setSkipped(new Set());
    setPhase("swiping");
  }, [ratingSport]);

  if (needsOnboarding && !showOnboarding) {
    return (
      <>
        <EmptyState
          icon={Calendar}
          title="Antes de buscar partner"
          description="Cuéntanos cuándo sueles poder jugar para sugerirte socios compatibles y aparecer en sus búsquedas."
          action={{
            label: "Configurar disponibilidad",
            onClick: () => setShowOnboarding(true),
          }}
        />
        <PartnerOnboardingSheet
          open={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          onSaved={() => {
            refreshAvail();
            refreshSug();
            setPhase("swiping");
          }}
        />
      </>
    );
  }

  const startSearch = async () => {
    await persist();
    setSkipped(new Set());
    await refreshSug();
    setPhase("swiping");
  };

  const handleInvite = (p: PartnerLite | PartnerSuggestion) => {
    setInvitePartner({
      user_id: p.user_id,
      first_name: p.first_name,
      last_name: p.last_name,
      avatar_url: p.avatar_url,
    });
  };


  return (
    <div
      className={`flex flex-col ${compact ? "gap-1.5" : "gap-2.5"} h-[calc(100svh-9.5rem)] md:h-[calc(100svh-7rem)] min-h-0`}
    >
      {/* Header — no shrink */}
      <div className="shrink-0 flex items-end justify-between px-1">
        <div>
          <h2 className={`font-display font-semibold leading-tight tracking-tight ${compact ? "text-lg" : "text-xl"}`}>
            Tu próximo partido
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-[11px] text-muted-foreground"
          onClick={() => setShowOnboarding(true)}
        >
          <Calendar className="h-3.5 w-3.5" />
          {compact ? "" : "Disponibilidad"}
        </Button>
      </div>

      {/* Carrusel últimos partners — oculto en compact para ganar altura */}

      <Tabs value={mainTab} onValueChange={setMainTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="grid w-full shrink-0 grid-cols-3">
          <TabsTrigger value="sugeridos" className="text-xs">
            <Sparkles className="mr-1 h-3 w-3" /> Sugeridos
          </TabsTrigger>
          <TabsTrigger value="reto" className="text-xs">
            Disponibles
          </TabsTrigger>
          <TabsTrigger value="invitaciones" className="text-xs">
            Invitaciones
            {pendingReceived + pendingSent > 0 && (
              <Badge className="ml-1 h-4 px-1 text-[9px]">{pendingReceived + pendingSent}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* SUGERIDOS — máquina de estados */}
        <TabsContent value="sugeridos" className="mt-2 min-h-0 flex-1 overflow-y-auto scrollbar-none">
          {!compact && (
            <div className="mb-2">
              <RecentPartnersStrip onPick={(p) => handleInvite(p)} />
            </div>
          )}
          {phase === "filters" && (
            <PartnerSearchFiltersCard
              myLevel={rating?.level != null ? Number(rating.level) : null}
              filters={filters}
              setFilters={setFilters}
              candidateCount={
                suggestions.filter(
                  (s) =>
                    s.level_diff == null || Math.abs(s.level_diff) <= filters.level_delta + 0.01,
                ).length
              }
              loading={sugLoading}
              onStart={startSearch}
              onEditAvailability={() => setShowOnboarding(true)}
            />
          )}

          {phase === "swiping" && (
            <>
              {sugLoading ? (
                <Skeleton className="mx-auto h-[520px] w-full max-w-md rounded-3xl" />
              ) : (
                <PartnerSwipeStack
                  suggestions={filteredSuggestions}
                  onInvite={(p) => handleInvite(p)}
                  onSkip={(p) => setSkipped((prev) => new Set(prev).add(p.user_id))}
                  onInfo={(p) => setProfileUserId(p.user_id)}
                  onBackToFilters={() => setPhase("filters")}
                />
              )}
            </>
          )}

          {phase === "empty" && (
            <div className="space-y-3">
              <EmptyState
                icon={Search}
                title={
                  suggestions.length === 0
                    ? `Sin candidatos en ${activeSport === "padel" ? "pádel" : "tenis"}`
                    : "Ya viste a todos por hoy"
                }
                description={
                  suggestions.length === 0
                    ? "Aún no hay socios con datos para sugerirte en este deporte. Puedes invitar directamente a cualquier socio desde el Ranking."
                    : `Has revisado los ${suggestions.length} jugadores compatibles con tus filtros actuales. Relaja los criterios o invita directo desde el Ranking.`
                }
                action={{
                  label: `Relajar filtros (UTR ±${Math.min(3, filters.level_delta + 0.5).toFixed(1)})`,
                  onClick: () => {
                    setFilters({ level_delta: Math.min(3, filters.level_delta + 0.5) });
                    setSkipped(new Set());
                    setPhase("filters");
                  },
                }}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/ranking?tab=ranking")}
              >
                Ir al Ranking e invitar a un socio
              </Button>
            </div>
          )}
        </TabsContent>

        {/* RETO ABIERTO */}
        <TabsContent value="reto" className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto scrollbar-none">
          <Button
            variant="clay"
            className="w-full"
            onClick={() => setShowOpenComposer(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Publicar mi disponibilidad (48h)
          </Button>

          <p className="px-1 pt-1 text-[10px] text-muted-foreground">
            Ordenados por mayor coincidencia con tu disponibilidad horaria.
          </p>

          {postsLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))
          ) : posts.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Aún no hay retos abiertos"
              description="Publica el tuyo y el club verá tu disponibilidad por 48 horas."
            />
          ) : (
            posts.map((p) => (
              <OpenMatchCard
                key={p.id}
                post={p}
                overlapCount={p.overlap_count ?? 0}
                isOwn={p.user_id === currentUserId}
                currentUserId={currentUserId}
                onJoin={async () => {
                  if (p.mode === "pair_vs_pair") {
                    setPairJoinPost(p);
                    return;
                  }
                  await joinOpen(p.id);
                  refreshPosts();
                }}
                onLeave={async () => { await leaveOpen(p.id); refreshPosts(); }}
                onCancel={async () => { await cancelOpen(p.id); refreshPosts(); }}
                loading={openLoading}
              />
            ))
          )}
        </TabsContent>

        {/* INVITACIONES */}
        <TabsContent value="invitaciones" className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto scrollbar-none">
          {received.length === 0 && sent.length === 0 ? (
            <EmptyState
              icon={Send}
              title="Sin invitaciones"
              description="Cuando envíes o recibas una invitación, aparecerá aquí."
            />
          ) : (
            <Tabs value={invTab} onValueChange={setInvTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="recibidas" className="text-xs">
                  Recibidas
                  {pendingReceived > 0 && (
                    <Badge className="ml-1 h-4 px-1 text-[9px]">{pendingReceived}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="enviadas" className="text-xs">
                  Enviadas
                  {pendingSent > 0 && (
                    <Badge className="ml-1 h-4 px-1 text-[9px]">{pendingSent}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="recibidas" className="mt-3 space-y-2">
                {received.length === 0 ? (
                  <EmptyState icon={Inbox} title="Sin invitaciones recibidas" description="" />
                ) : (
                  <PaginatedInvitations items={received} side="received" onChanged={refreshInv} />
                )}
              </TabsContent>
              <TabsContent value="enviadas" className="mt-3 space-y-3">
                {myOpenPosts.length > 0 && (
                  <div className="space-y-2">
                    <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Mis retos abiertos ({myOpenPosts.length})
                    </p>
                    {myOpenPosts.map((p) => (
                      <OpenMatchCard
                        key={p.id}
                        post={p}
                        overlapCount={p.overlap_count ?? 0}
                        isOwn={p.user_id === currentUserId}
                        currentUserId={currentUserId}
                        onJoin={async () => {
                          if (p.mode === "pair_vs_pair") { setPairJoinPost(p); return; }
                          await joinOpen(p.id);
                          refreshPosts();
                        }}
                        onLeave={async () => { await leaveOpen(p.id); refreshPosts(); }}
                        onCancel={async () => { await cancelOpen(p.id); refreshPosts(); }}
                        loading={openLoading}
                      />
                    ))}
                  </div>
                )}
                {sent.length === 0 && myOpenPosts.length === 0 ? (
                  <EmptyState icon={Send} title="Sin invitaciones enviadas" description="" />
                ) : sent.length > 0 ? (
                  <div className="space-y-2">
                    {myOpenPosts.length > 0 && (
                      <p className="px-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Invitaciones 1 a 1
                      </p>
                    )}
                    <PaginatedInvitations items={sent} side="sent" onChanged={refreshInv} />
                  </div>
                ) : null}
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>
      </Tabs>

      <PartnerOnboardingSheet
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onSaved={() => {
          refreshAvail();
          refreshSug();
        }}
      />
      <OpenMatchWizard
        open={showOpenComposer}
        onClose={() => setShowOpenComposer(false)}
        onSuccess={refreshPosts}
      />
      <OpenMatchJoinDialog
        open={!!pairJoinPost}
        post={pairJoinPost}
        onClose={() => setPairJoinPost(null)}
        loading={openLoading}
        onConfirm={async (partnerUserId) => {
          if (!pairJoinPost) return;
          const r = await joinOpen(pairJoinPost.id, { partnerUserId });
          if (r) {
            setPairJoinPost(null);
            refreshPosts();
          }
        }}
      />
      <InvitePartnerDialog
        open={!!invitePartner}
        partner={invitePartner}
        onClose={() => setInvitePartner(null)}
        onSuccess={({ partner }) => {
          setMatchSent({ partner });
          refreshSug();
          refreshInv();
        }}
      />
      <MatchSentDialog
        open={!!matchSent}
        onClose={() => {
          setMatchSent(null);
          setMainTab("invitaciones");
          setInvTab("enviadas");
        }}
        partner={matchSent?.partner ?? null}
        me={
          profile
            ? {
                first_name: profile.first_name,
                last_name: profile.last_name,
                avatar_url: profile.avatar_url,
              }
            : null
        }
        compatScore={matchSent?.score ?? null}
        onKeepBrowsing={() => {
          setMatchSent(null);
          setPhase("swiping");
        }}
      />
      <PlayerProfileDrawer
        open={!!profileUserId}
        onOpenChange={(open) => !open && setProfileUserId(null)}
        userId={profileUserId}
      />
    </div>
  );
};
