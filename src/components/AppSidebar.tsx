import {
  Home,
  CalendarDays,
  Trophy,
  Swords,
  User,
  GraduationCap,
  Users,
  Building2,
  Megaphone,
  FileText,
  ListOrdered,
  ShieldCheck,
  LineChart,
  FlaskConical,
  ExternalLink,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/components/providers/AuthProvider";
import { useMyCoachProfile } from "@/hooks/useCoaches";
import { useBookingsProvider, openExternalBooking } from "@/hooks/useBookingsProvider";
import { EXTERNAL_BOOKING_COPY } from "@/lib/external-bookings-copy";
import { useClubBrand } from "@/components/providers/ClubBrandProvider";
import appIcon from "@/assets/brand/app-icon-light.png.asset.json";
import { cn } from "@/lib/utils";

const memberItems = [
  { title: "Inicio", url: "/", icon: Home, id: "home" },
  { title: "Reservar", url: "/reservar", icon: CalendarDays, id: "reservas" },
  { title: "Competir", url: "/ranking", icon: Swords, id: "competir" },
  { title: "Torneos", url: "/torneos", icon: Trophy, id: "torneos" },
  { title: "Clases", url: "/clases", icon: GraduationCap, id: "clases" },
  { title: "Perfil", url: "/perfil", icon: User, id: "perfil" },
];

const adminItems = [
  { title: "Socios", url: "/admin/socios", icon: Users },
  { title: "Canchas", url: "/admin/canchas", icon: Building2 },
  { title: "Torneos", url: "/admin/torneos", icon: Trophy },
  { title: "Mis torneos", url: "/mis-torneos", icon: ShieldCheck },
  { title: "Ladder", url: "/admin/ladder", icon: ListOrdered },
  { title: "Clases", url: "/admin/clases", icon: GraduationCap },
  { title: "Anuncios", url: "/admin/comunicaciones", icon: Megaphone },
  { title: "Documentos", url: "/admin/documentos", icon: FileText },
  { title: "Analítica", url: "/admin/analytics", icon: LineChart },
  { title: "QA Competir", url: "/admin/qa/competir", icon: FlaskConical },
  { title: "Protocolo demo", url: "/admin/qa/protocolo", icon: FlaskConical },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { data: coachProfile } = useMyCoachProfile();
  const { isExternal, externalUrl } = useBookingsProvider();
  const { brand } = useClubBrand();
  const isCoach = !!coachProfile;

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const linkClass = (active: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
      active
        ? "bg-primary/10 text-primary font-medium"
        : "text-foreground/80 hover:bg-muted hover:text-foreground",
    );

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="bg-background">
        <div className="flex items-center gap-2 px-3 pt-4 pb-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-clay">
            <img
              src={brand.logoUrl || appIcon.url}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 object-cover"
            />
          </div>
          {!collapsed && (
          <div className="leading-tight min-w-0">
              <p className="font-display text-sm font-semibold truncate">{brand.shortName}</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Tenis</p>
            </div>
          )}
        </div>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Mi club</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {memberItems.map((item) => {
                if (item.id === "reservas" && isExternal) {
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <button
                          type="button"
                          onClick={() => openExternalBooking(externalUrl)}
                          className={linkClass(false)}
                          aria-label={EXTERNAL_BOOKING_COPY.ariaOpen}
                        >
                          <ExternalLink className="h-4 w-4 shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end={item.url === "/"} className={linkClass(isActive(item.url))}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isCoach && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Coach</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/coach" className={linkClass(isActive("/coach"))}>
                      <GraduationCap className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Panel coach</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAdmin && (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" /> Admin
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={linkClass(isActive(item.url))}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
