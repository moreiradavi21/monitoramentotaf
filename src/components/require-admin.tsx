import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, role } = useAuth();

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Verificando acesso...
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Session loaded but role not resolved yet
  if (role == null) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Carregando permissões...
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <h2 className="font-display text-xl text-primary">Acesso restrito</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Somente administradores podem acessar esta área.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
