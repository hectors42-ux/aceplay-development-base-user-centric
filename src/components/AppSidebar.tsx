import {
  Home,
  Trophy,
  Swords,
  User,
  Users,
  Megaphone,
  FileText,
  ListOrdered,
  ShieldCheck,
  LineChart,
  FlaskConical,
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
import { useClubBrand } from "@/components/providers/ClubBrandProvider";
import appIcon from "@/assets/brand/app-icon-light.png.asset.json";
import { cn } from "@/lib/utils";

// "Reservar" y "Clases" se quitaron: módulos dormidos (ver src/config/modules.ts).
const memberItems = [
  { title: "Inicio", url: "/", icon: Home, id: "home" },
  { title: "Competir", url: "/ranking", icon: Swords, id: "competir" },
  { title: "Torneos", url: "/torneos", icon: Trophy, id: "torneos" },
  { title: "Perfil", url: "/perfil", icon: User, id: "perfil" },
];

// "Canchas" y "Clases" (admin) también quedan fuera mientras los módulos duermen.
const adminItems = [
  { title: "Socios", url: "/admin/socios", icon: Users },
  { title: "Torneos", url: "/admin/torneos", icon: Trophy },
  { title: "Mis torneos", url: "/mis-torneos", icon: ShieldCheck },
  { title: "Ladder", url: "/admin/ladder", icon: ListOrdered },
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
  const { brand } = useClubBrand();

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
              {memberItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/"} className={linkClass(isActive(item.url))}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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
