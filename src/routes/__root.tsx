import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  Navigate,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { HeaderUser } from "@/components/header-user";
import {
  LayoutDashboard,
  ClipboardList,
  BadgeCheck,
  Users,
  UserCheck,
  ShieldCheck,
  Upload,
} from "lucide-react";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página não encontrada.</p>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Erro ao carregar</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CCAP · Controle de TAF" },
      {
        name: "description",
        content:
          "Sistema de controle do Teste de Aptidão Física (TAF) da Companhia CCAP — 1º, 2º e 3º TAF em 1ª e 2ª chamada, por posto e graduação.",
      },
      { property: "og:title", content: "CCAP · Controle de TAF" },
      {
        property: "og:description",
        content:
          "Sistema de controle do Teste de Aptidão Física (TAF) da Companhia CCAP — 1º, 2º e 3º TAF em 1ª e 2ª chamada, por posto e graduação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CCAP · Controle de TAF" },
      {
        name: "twitter:description",
        content:
          "Sistema de controle do Teste de Aptidão Física (TAF) da Companhia CCAP — 1º, 2º e 3º TAF em 1ª e 2ª chamada, por posto e graduação.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c56d6f8f-b5dc-40e1-8a3d-87eb503d74fe/id-preview-dcf72ee1--41365671-7322-4e2e-8d52-92d84a1c5ebe.lovable.app-1784042883863.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c56d6f8f-b5dc-40e1-8a3d-87eb503d74fe/id-preview-dcf72ee1--41365671-7322-4e2e-8d52-92d84a1c5ebe.lovable.app-1784042883863.png",
      },
      { name: "theme-color", content: "#1f3a2e" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "CCAP TAF" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            {/* Sidebar only renders for admin on lg+ screens (see app-sidebar.tsx) */}
            <AppSidebar />
            <div className="flex flex-1 flex-col min-w-0">
              <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
                <AdminSidebarTrigger />
                <div className="flex items-center gap-2">
                  {/* Logo icon visible on mobile where sidebar is hidden */}
                  <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-gold text-gold-foreground lg:hidden">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <span className="font-display text-lg tracking-wider text-primary">
                    Companhia CCAP
                  </span>
                  <span className="hidden text-xs uppercase tracking-widest text-muted-foreground sm:inline">
                    · Controle de TAF
                  </span>
                </div>
                <div className="ml-auto">
                  <HeaderUser />
                </div>
              </header>

              {/* pb-24 on mobile to clear the fixed bottom nav */}
              <main className="flex-1 p-4 pb-24 lg:p-6 lg:pb-6">
                <AppGate>
                  <Outlet />
                </AppGate>
              </main>

              {/* Fixed bottom navigation for mobile */}
              <BottomNav />
            </div>
          </div>
          <Toaster richColors position="top-right" />
        </SidebarProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

/** Sidebar trigger only shown to admin (who has the sidebar) */
function AdminSidebarTrigger() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;
  return <SidebarTrigger />;
}

/** Fixed bottom nav bar for mobile — hidden on lg+ where sidebar takes over */
function BottomNav() {
  const { isAdmin, isCompanhia, approved, user, role } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  if (!user || !approved) return null;

  const isActive = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));

  type NavItem = { url: string; icon: React.ComponentType<{ className?: string }>; label: string };
  const items: NavItem[] = [];

  if (isAdmin) {
    items.push({ url: "/", icon: LayoutDashboard, label: "Painel" });
    items.push({ url: "/militares", icon: Users, label: "Militares" });
    items.push({ url: "/registros", icon: ClipboardList, label: "Registros" });
    items.push({ url: "/aprovacoes", icon: UserCheck, label: "Aprovações" });
  } else if (role === "avaliador") {
    items.push({ url: "/registros", icon: ClipboardList, label: "Registros" });
  } else if (isCompanhia) {
    items.push({ url: "/meus-resultados", icon: BadgeCheck, label: "Meus TAFs" });
  }

  if (!items.length) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-background/95 backdrop-blur-sm lg:hidden">
      {items.map((item) => (
        <Link
          key={item.url}
          to={item.url}
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[10px] uppercase tracking-widest transition-colors ${
            isActive(item.url) ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <item.icon
            className={`h-5 w-5 ${isActive(item.url) ? "text-primary" : "text-muted-foreground"}`}
          />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function AppGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isAuthPage = pathname === "/auth";

  if (auth.loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!auth.user) {
    if (isAuthPage) return <>{children}</>;
    return <Navigate to="/auth" replace />;
  }

  if (isAuthPage) return <>{children}</>;

  if (!auth.approved) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center px-4">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl text-primary">
          Conta pendente de aprovação
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sua conta foi criada com sucesso, mas ainda precisa da aprovação de um
          administrador para acessar o sistema.
        </p>
      </div>
    );
  }

  // Role-based redirect from home:
  // - Companhia (role="user") → /meus-resultados
  // - Avaliador puro (role="avaliador", not admin) → /registros
  // - Admin → fica no / (dashboard)
  if (pathname === "/") {
    if (auth.isCompanhia) return <Navigate to="/meus-resultados" replace />;
    if (auth.role === "avaliador") return <Navigate to="/registros" replace />;
  }

  return <>{children}</>;
}
