import { Hand, Activity, MapPin, Calendar, Mail, Phone } from "lucide-react";

interface Props {
  bio?: string | null;
  dominantHand?: "right" | "left" | "ambi" | null;
  backhand?: "one_handed" | "two_handed" | null;
  favoriteShot?: string | null;
  favoriteSurface?: string | null;
  playingStyle?: string | null;
  availability?: string | null;
  yearsPlaying?: number | null;
  email?: string;
  phone?: string | null;
  showEmail?: boolean | null;
  showPhone?: boolean | null;
  isOwner?: boolean;
}

const HAND_LABEL = { right: "Diestro", left: "Zurdo", ambi: "Ambidiestro" };
const BACKHAND_LABEL = { one_handed: "Una mano", two_handed: "Dos manos" };

const Row = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hand;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-start gap-2">
    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2.2} />
    <div className="min-w-0 flex-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  </div>
);

export const PlayerInfoCard = ({
  bio,
  dominantHand,
  backhand,
  favoriteShot,
  favoriteSurface,
  playingStyle,
  availability,
  yearsPlaying,
  email,
  phone,
  showEmail,
  showPhone,
  isOwner,
}: Props) => {
  const hasInfo =
    bio ||
    dominantHand ||
    backhand ||
    favoriteShot ||
    favoriteSurface ||
    playingStyle ||
    availability ||
    yearsPlaying;

  if (!hasInfo) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
        {isOwner
          ? "Completa tu perfil para que el club te conozca."
          : "Este socio aún no completó su perfil."}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      {bio && (
        <p className="border-b border-border pb-3 text-sm italic text-muted-foreground">
          “{bio}”
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {dominantHand && (
          <Row icon={Hand} label="Mano" value={HAND_LABEL[dominantHand]} />
        )}
        {backhand && <Row icon={Hand} label="Revés" value={BACKHAND_LABEL[backhand]} />}
        {favoriteShot && <Row icon={Activity} label="Golpe favorito" value={favoriteShot} />}
        {favoriteSurface && (
          <Row icon={MapPin} label="Superficie" value={<span className="capitalize">{favoriteSurface}</span>} />
        )}
        {playingStyle && <Row icon={Activity} label="Estilo" value={playingStyle} />}
        {yearsPlaying !== null && yearsPlaying !== undefined && (
          <Row icon={Calendar} label="Años jugando" value={`${yearsPlaying}`} />
        )}
        {availability && (
          <div className="col-span-2">
            <Row icon={Calendar} label="Disponibilidad" value={availability} />
          </div>
        )}
      </div>

      {(showEmail || showPhone) && (email || phone) && (
        <div className="grid grid-cols-1 gap-2 border-t border-border pt-3">
          {showEmail && email && (
            <Row icon={Mail} label="Email" value={<a href={`mailto:${email}`} className="text-primary">{email}</a>} />
          )}
          {showPhone && phone && (
            <Row icon={Phone} label="Teléfono" value={<a href={`tel:${phone}`} className="text-primary">{phone}</a>} />
          )}
        </div>
      )}
    </div>
  );
};
