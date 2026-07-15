import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";

/**
 * Sidebar de navegação — visível apenas para administradores em telas lg+.
 * Avaliadores e militares da companhia usam a barra de navegação inferior (BottomNav)
 * definida em __root.tsx.
 */
export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { isAdmin, approved } = useAuth();

  // Sidebar exclusiva para admin; non-admin nunca vê a barra lateral
  if (!isAdmin || !approved) return null;

  const isActive = (p: string) =>
    p === "/" ? pathname === "/" : pathname.startsWith(p);

  const items = [
    { title: "Painel TAF", url: "/", icon: LayoutDashboard },
    { title: "Militares", url: "/militares", icon: Users },
    { title: "Registros", url: "/registros", icon: ClipboardList },
    { title: "Aprovações", url: "/aprovacoes", icon: UserCheck },
  ];

  return (
    <Sidebar collapsible="icon" className="hidden lg:flex">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-gold text-gold-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-base tracking-wider text-sidebar-foreground">
              CCAP · TAF
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60">
              Controle Físico
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
