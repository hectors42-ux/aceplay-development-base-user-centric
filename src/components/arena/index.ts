// Primitivas Arena (Épica H) — UI gamificada sobre los tokens de rol de G.
// Todas usan tokens de rol (skill/action/fichas/info/confirm); cero color
// hardcodeado → se re-tematizan solas cuando la Épica K cambie de tema.
export { useArenaMotion, springy } from "./motion";
export { TierGem, TIER_ORDER, type Tier, type TierGemProps } from "./TierGem";
export { LeagueChip, type LeagueChipProps } from "./LeagueChip";
export { StreakChip, type StreakChipProps } from "./StreakChip";
export { CoinPill, type CoinPillProps } from "./CoinPill";
export { XPMeter, type XPMeterProps } from "./XPMeter";
export { ArenaHero, type ArenaHeroProps } from "./ArenaHero";
export { Steps, type StepsProps } from "./Steps";
export { LiveBadge, type LiveBadgeProps } from "./LiveBadge";
export { SponsorLockup, type SponsorLockupProps } from "./SponsorLockup";
export { MatchScore, type MatchScoreProps, type MatchSet } from "./MatchScore";
export { ArenaBottomNav, type ArenaBottomNavProps, type NavItemSpec } from "./ArenaBottomNav";
export { LayerHud, type LayerHudProps } from "./LayerHud";
