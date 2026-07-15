import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserCheck, UserX } from "lucide-react";
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
      const dbRole = role === "administrador"
        ? "admin"
        : role === "avaliador"
          ? "avaliador"
          : "user";
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

  const roleLabel = (r: string | null) =>
    r === "administrador"
      ? "Militar Administrador"
      : r === "avaliador"
        ? "Militar Avaliador"
        : r === "companhia"
          ? "Militar da Companhia"
          : "—";

  const pending = profiles.filter((p) => !p.approved);
  const approved = profiles.filter((p) => p.approved);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Administração
        </p>
        <h1 className="mt-1 text-3xl font-display tracking-wide text-primary">
          Aprovações de contas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Autorize ou revogue o acesso ao sistema por conta.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display tracking-wide text-primary">
            Pendentes ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
          ) : pending.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              Nenhuma conta pendente.
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Posto</th>
                  <th className="px-3 py-2">Solicitado</th>
                  <th className="px-3 py-2">Aprovar como</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => {
                  const chosen = pickedRole[p.id] ?? p.requested_role ?? "companhia";
                  return (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="px-3 py-2 font-medium">{p.nome ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.posto ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {roleLabel(p.requested_role)}
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={chosen}
                          onValueChange={(v) =>
                            setPickedRole((s) => ({ ...s, [p.id]: v }))
                          }
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="companhia">Militar da Companhia</SelectItem>
                            <SelectItem value="avaliador">Militar Avaliador</SelectItem>
                            <SelectItem value="administrador">Militar Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          onClick={() => approve.mutate({ id: p.id, role: chosen })}
                          disabled={approve.isPending}
                        >
                          <UserCheck className="mr-1 h-4 w-4" />
                          Aprovar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display tracking-wide text-primary">
            Aprovados ({approved.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {approved.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Ninguém aprovado.</div>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Posto</th>
                  <th className="px-3 py-2">Papel solicitado</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {approved.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="px-3 py-2 font-medium">{p.nome ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.posto ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{roleLabel(p.requested_role)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => revoke.mutate(p.id)}
                        disabled={revoke.isPending}
                      >
                        <UserX className="mr-1 h-4 w-4" />
                        Revogar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
