import { Link } from "react-router-dom";
import { NotificationCenter } from "@/components/NotificationCenter";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useAuth } from "@/components/providers/AuthProvider";
import { SportSwitcher } from "@/components/SportSwitcher";
import { SportBadge } from "@/components/SportBadge";

interface AppHeaderProps {
  memberName: string;
  greeting: string;
  /**
   * Si true (default), muestra el `SportSwitcher` interactivo. Si false,
   * muestra el `SportBadge` de solo lectura. Sólo la Home (`/`) debería
   * usar `interactive=true`.
   */
  interactive?: boolean;
}

export const AppHeader = ({ memberName, greeting, interactive = true }: AppHeaderProps) => {
  const { profile } = useAuth();

  return (
    <header className="safe-top sticky top-0 z-30 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md lg:max-w-6xl items-center justify-between gap-3 px-5 lg:px-6 pb-3 pt-3">
        <div className="flex items-center gap-3">
          <Link
            to="/perfil"
            aria-label="Ir a mi perfil"
            className="relative block h-11 w-11 shrink-0 rounded-full ring-2 ring-primary/20 shadow-clay transition-smooth hover:ring-primary/40"
          >
            <UserAvatar kind={profile?.avatar_kind} look={profile?.avatar_look} url={profile?.avatar_url} name={memberName} className="h-11 w-11" />
          </Link>
          <div className="leading-tight">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {greeting}
            </p>
            <p className="font-display text-lg font-semibold text-foreground">
              {memberName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {interactive ? (
            <SportSwitcher className="hidden xs:inline-flex sm:inline-flex" />
          ) : (
            <SportBadge />
          )}
          <NotificationCenter />
        </div>
      </div>
      {interactive && (
        <div className="mx-auto flex max-w-md lg:max-w-6xl items-center justify-end px-5 lg:px-6 pb-2 xs:hidden sm:hidden">
          <SportSwitcher />
        </div>
      )}
    </header>
  );
};
