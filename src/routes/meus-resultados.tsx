import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMilitares, useResultados } from "@/lib/data";
import { extractMencoes, mencaoColor, POSTOS } from "@/lib/taf";

export const Route = createFileRoute("/meus-resultados")({
  component: MeusResultadosPage,
});

function MeusResultadosPage() {
  const { profile, approved, user, loading } = useAuth();
  const qc = useQueryClient();
  const { data: militares = [] } = useMilitares();
  const { data: resultados = [] } = useResultados();

  const marcar = useMutation({
    mutationFn: async (resultado_id: string) => {
      const { error } = await supabase.rpc("marcar_ciente" as any, {
        _resultado_id: resultado_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taf_resultados"] });
      toast.success("Ciente registrado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao dar ciente."),
  });

  if (loading) return null;
  if (!user) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Faça login para ver seus resultados.
      </div>
    );
  }
  if (!approved) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Aguardando aprovação.
      </div>
    );
  }
  if (!profile?.militar_id) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Sua conta ainda não está vinculada a um militar cadastrado. Peça ao
          administrador para vincular.
        </CardContent>
      </Card>
    );
  }

  const meuMilitar = militares.find((m) => m.id === profile.militar_id);
  const meus = resultados.filter((r) => r.militar_id === profile.militar_id);
  const posto = POSTOS.find((p) => p.value === meuMilitar?.posto);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Meus resultados
        </p>
        <h1 className="mt-1 text-3xl font-display tracking-wide text-primary">
          {meuMilitar?.nome ?? "—"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {posto?.label ?? "—"} · Confira seus índices e confirme o ciente.
        </p>
      </div>

      {meus.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum TAF lançado em seu nome ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {meus.map((r) => {
            const mc = extractMencoes(r.observacoes, r.mencao);
            const cell = (label: string, v: string) => (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {label}
                </span>
                <span
                  className={`inline-block min-w-[2.5rem] rounded border px-2 py-0.5 text-xs font-medium ${mencaoColor(v)}`}
                >
                  {v}
                </span>
              </div>
            );
            return (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="font-display text-lg tracking-wide text-primary">
                        {r.taf_numero}º TAF · {r.chamada}ª chamada
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Aplicado em{" "}
                        {new Date(r.data_aplicacao).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {r.ciente_at ? (
                      <Badge className="bg-primary/15 text-primary border border-primary/40">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Ciente
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-destructive/40 text-destructive">
                        Pendente ciente
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-5 gap-2 rounded-md border border-border bg-muted/30 p-3">
                    {cell("COR", mc.COR)}
                    {cell("FLEX", mc.FLEX)}
                    {cell("ABD", mc.ABD)}
                    {cell("BAR", mc.BAR)}
                    {cell("FIN", mc.FIN)}
                  </div>

                  {r.ciente_at ? (
                    <p className="text-xs text-muted-foreground">
                      Ciente registrado em{" "}
                      {new Date(r.ciente_at).toLocaleString("pt-BR")}
                    </p>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => marcar.mutate(r.id)}
                      disabled={marcar.isPending}
                    >
                      <BadgeCheck className="mr-2 h-4 w-4" />
                      Dar ciente
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
