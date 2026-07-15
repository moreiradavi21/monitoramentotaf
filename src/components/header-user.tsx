import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn, LogOut, ShieldCheck, User, ClipboardCheck, BadgeCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

export function HeaderUser() {
  const { user, role, approved, signOut, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;

  if (!user) {
    return (
      <Button size="sm" variant="outline" asChild>
        <Link to="/auth">
          <LogIn className="mr-2 h-4 w-4" />
          Entrar
        </Link>
      </Button>
    );
  }

  const roleLabel = !approved
    ? "Aguardando aprovação"
    : role === "admin"
      ? "Administrador"
      : role === "avaliador"
        ? "Avaliador"
        : role === "user"
          ? "Companhia"
          : "Sem papel";

  const Icon = role === "admin"
    ? ShieldCheck
    : role === "avaliador"
      ? ClipboardCheck
      : role === "user"
        ? BadgeCheck
        : User;

  return (
    <div className="flex items-center gap-2">
      <div className="hidden items-center gap-2 sm:flex">
        <Badge
          variant="outline"
          className={
            role === "admin"
              ? "border-gold/40 bg-gold/10 text-gold-foreground"
              : approved
                ? "border-primary/30 text-primary"
                : "border-destructive/40 text-destructive"
          }
        >
          <Icon className="mr-1 h-3 w-3" />
          {roleLabel}
        </Badge>
        <span className="max-w-[180px] truncate text-xs text-muted-foreground">
          {user.email}
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          await signOut();
          navigate({ to: "/auth" });
        }}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sair
      </Button>
    </div>
  );
}
