import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

function Loading({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-muted-foreground">
        {label}
      </CardContent>
    </Card>
  );
}

function Denied({ msg }: { msg: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h2 className="font-display text-xl text-primary">Acesso restrito</h2>
        <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
      </CardContent>
    </Card>
  );
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, role, approved } = useAuth();
  if (loading) return <Loading label="Verificando acesso..." />;
  if (!user) return <Navigate to="/auth" replace />;
  if (role == null) return <Loading label="Carregando permissões..." />;
  if (!approved) return <Denied msg="Sua conta ainda não foi aprovada." />;
  if (!isAdmin) return <Denied msg="Somente administradores podem acessar esta área." />;
  return <>{children}</>;
}

export function RequireAvaliador({ children }: { children: ReactNode }) {
  const { user, isAvaliador, loading, role, approved } = useAuth();
  if (loading) return <Loading label="Verificando acesso..." />;
  if (!user) return <Navigate to="/auth" replace />;
  if (role == null) return <Loading label="Carregando permissões..." />;
  if (!approved) return <Denied msg="Sua conta ainda não foi aprovada." />;
  if (!isAvaliador)
    return <Denied msg="Somente avaliadores ou administradores podem lançar TAF." />;
  return <>{children}</>;
}
