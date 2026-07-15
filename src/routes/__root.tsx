import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { HeaderUser } from "@/components/header-user";

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
        content: "Sistema de controle do Teste de Aptidão Física (TAF) da Companhia CCAP — 1º, 2º e 3º TAF em 1ª e 2ª chamada, por posto e graduação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CCAP · Controle de TAF" },
      { name: "twitter:description", content: "Sistema de controle do Teste de Aptidão Física (TAF) da Companhia CCAP — 1º, 2º e 3º TAF em 1ª e 2ª chamada, por posto e graduação." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c56d6f8f-b5dc-40e1-8a3d-87eb503d74fe/id-preview-dcf72ee1--41365671-7322-4e2e-8d52-92d84a1c5ebe.lovable.app-1784042883863.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c56d6f8f-b5dc-40e1-8a3d-87eb503d74fe/id-preview-dcf72ee1--41365671-7322-4e2e-8d52-92d84a1c5ebe.lovable.app-1784042883863.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
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
            <AppSidebar />
            <div className="flex flex-1 flex-col">
              <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
                <SidebarTrigger />
                <div className="flex items-center gap-2">
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
              <main className="flex-1 p-4 md:p-6">
                <AppGate>
                  <Outlet />
                </AppGate>
              </main>
            </div>
          </div>
          <Toaster richColors position="top-right" />
        </SidebarProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppGate({ children }: { children: ReactNode }) {
  const { useAuth } = require("@/lib/auth") as typeof import("@/lib/auth");
  const { useRouterState, Navigate } = require("@tanstack/react-router") as typeof import("@tanstack/react-router");
  const auth = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isAuthPage = pathname === "/auth";

  if (auth.loading) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Carregando...
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
      <div className="mx-auto max-w-lg py-16 text-center">
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
  return <>{children}</>;
}
