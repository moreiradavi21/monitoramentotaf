import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserCheck, UserX, ShieldCheck, Users, Trash2 } from "lucide-react";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequireAdmin } from "@/components/require-admin";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/aprovacoes")({
  component: () => (
    <RequireAdmin>
      <AprovacoesPage />
    </RequireAdmin>
  ),
});

type Row = {
  id: string;
  nome: string | null;
  posto: string | null;
  requested_role: string | null;
  approved: boolean;
  militar_id: string | null;
  created_at: string;
};

const roleLabel = (r: string | null) =>
  r === "administrador"
    ? "Administrador"
    : r === "avaliador"
      ? "Avaliador"
      : r === "companhia"
        ? "Companhia"
        : "—";

function AprovacoesPage() {
  const qc = useQueryClient();
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, posto, requested_role, approved, militar_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [pickedRole, setPickedRole] = useState<Record<string, string>>({});

  const approve = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const dbRole =
        role === "administrador" ? "admin" : role === "avaliador" ? "avaliador" : "user";
      const { error } = await supabase.rpc("approve_profile" as any, {
        _profile_id: id,
        _role: dbRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Conta aprovada.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao aprovar."),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("revoke_profile" as any, {
        _profile_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Acesso revogado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao revogar."),
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_delete_user" as any, {
        _user_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Conta excluída com sucesso.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir conta."),
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isStaff = (r: string | null) => r === "avaliador" || r === "administrador";

  // ── Pendentes: só avaliador/admin aguardam aprovação manual ──
  const pendingStaff = profiles.filter((p) => !p.approved && isStaff(p.requested_role));

  // ── Aprovados separados por grupo ──
  const approvedStaff = profiles.filter((p) => p.approved && isStaff(p.requested_role));
  // Companhia: mostra TODAS (aprovadas ou não) — contas antigas podem ter approved=false
  const allCia = profiles.filter((p) => !isStaff(p.requested_role));

  function ApprovedRow({ p }: { p: Row }) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{p.nome ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{p.posto ?? "—"}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline">{roleLabel(p.requested_role)}</Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => revoke.mutate(p.id)}
            disabled={revoke.isPending}
            className="text-destructive hover:text-destructive"
          >
            <UserX className="mr-1 h-4 w-4" />
            Revogar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmDeleteId(p.id)}
            disabled={deleteUser.isPending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Administração
        </p>
        <h1 className="mt-1 text-2xl font-display tracking-wide text-primary sm:text-3xl">
          Aprovações de contas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Autorize ou revogue o acesso ao sistema por conta.
        </p>
      </div>

      {/* ── Pendentes de aprovação (apenas Avaliador / Admin) ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-500" />
            <CardTitle className="font-display tracking-wide text-primary">
              Avaliadores / Administradores pendentes
              <Badge variant="outline" className="ml-2 font-normal">
                {pendingStaff.length}
              </Badge>
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Contas que requerem aprovação manual antes de acessar o sistema.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && pendingStaff.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma conta pendente.</p>
          )}
          {pendingStaff.map((p) => {
            const chosen = pickedRole[p.id] ?? p.requested_role ?? "avaliador";
            return (
              <div key={p.id} className="rounded-lg border border-amber-400/30 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.nome ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.posto ?? "—"} · Solicitou:{" "}
                      <span className="font-medium text-foreground">{roleLabel(p.requested_role)}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 border-amber-400/50 text-amber-600 dark:text-amber-400">
                    Pendente
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={chosen} onValueChange={(v) => setPickedRole((s) => ({ ...s, [p.id]: v }))}>
                    <SelectTrigger className="flex-1 min-w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avaliador">Avaliador</SelectItem>
                      <SelectItem value="administrador">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => approve.mutate({ id: p.id, role: chosen })}
                    disabled={approve.isPending}
                    className="shrink-0"
                  >
                    <UserCheck className="mr-1 h-4 w-4" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmDeleteId(p.id)}
                    disabled={deleteUser.isPending}
                    className="shrink-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Excluir
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Avaliadores / Administradores aprovados ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <CardTitle className="font-display tracking-wide text-primary">
              Avaliadores / Administradores aprovados
              <Badge variant="outline" className="ml-2 font-normal">{approvedStaff.length}</Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {approvedStaff.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum aprovado nesta categoria.</p>
          )}
          {approvedStaff.map((p) => <ApprovedRow key={p.id} p={p} />)}
        </CardContent>
      </Card>

      {/* ── Militares da Cia C Apoio ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="font-display tracking-wide text-primary">
              Militares da Cia C Apoio
              <Badge variant="outline" className="ml-2 font-normal">{allCia.length}</Badge>
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Contas cadastradas como Cia C Apoio. Use "Excluir" para remover uma conta e liberar o e-mail para novo cadastro.
          </p>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {allCia.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum militar da Cia cadastrado ainda.</p>
          )}
          {allCia.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{p.nome ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{p.posto ?? "—"}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className={p.approved
                    ? "border-green-400/50 text-green-600 dark:text-green-400"
                    : "border-amber-400/50 text-amber-600 dark:text-amber-400"}
                >
                  {p.approved ? "Ativo" : "Pendente"}
                </Badge>
                {!p.approved && (
                  <Button
                    size="sm"
                    onClick={() => approve.mutate({ id: p.id, role: "companhia" })}
                    disabled={approve.isPending}
                    className="shrink-0"
                  >
                    <UserCheck className="mr-1 h-4 w-4" />
                    Aprovar
                  </Button>
                )}
                {p.approved && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revoke.mutate(p.id)}
                    disabled={revoke.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <UserX className="mr-1 h-4 w-4" />
                    Revogar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDeleteId(p.id)}
                  disabled={deleteUser.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A conta será removida do sistema e o e-mail ficará disponível para novo cadastro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeleteId) {
                  deleteUser.mutate(confirmDeleteId);
                  setConfirmDeleteId(null);
                }
              }}
            >
              Excluir conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
