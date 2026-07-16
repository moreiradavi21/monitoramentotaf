import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Users, Activity, TrendingUp, AlertTriangle, Trophy } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { POSTOS, TAF_NUMEROS, CHAMADAS, mencaoColor, mencaoMedia, type Posto } from "@/lib/taf";
import { useMilitares, useResultados } from "@/lib/data";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    pelotao: typeof search.pelotao === "string" ? search.pelotao : undefined,
  }),
  component: Dashboard,
});

function isInsuf(mencao: string | null | undefined): boolean {
  if (!mencao) return false;
  const m = mencao.trim().toUpperCase();
  return m === "I" || m === "INSUF" || m === "INSUFICIENTE";
}

const MEDAL_COLORS = ["text-yellow-500", "text-slate-400", "text-amber-700"];
const MEDAL_BG = [
  "bg-yellow-500/10 border-yellow-500/40",
  "bg-slate-400/10 border-slate-400/30",
  "bg-amber-700/10 border-amber-700/30",
];
const RANK_LABEL = ["1º", "2º", "3º"];

function Dashboard() {
  const [taf, setTaf] = useState<number>(1);
  const [chamada, setChamada] = useState<number>(1);
  const { pelotao } = Route.useSearch();
  const { isAdmin, isAvaliador, isCompanhia } = useAuth();
  const militaresQ = useMilitares();
  const resQ = useResultados();

  const loading = militaresQ.isLoading || resQ.isLoading;
  const militares = militaresQ.data ?? [];
  const resultados = resQ.data ?? [];

  const resultsForEdicao = useMemo(
    () => resultados.filter((r) => r.taf_numero === taf && r.chamada === chamada),
    [resultados, taf, chamada],
  );

  // Filtra militares pelo pelotão selecionado (via URL search param)
  const filteredMilitares = useMemo(
    () =>
      !pelotao
        ? militares
        : militares.filter((m) => m.pelotao === pelotao),
    [militares, pelotao],
  );

  // Resultados apenas do pelotão selecionado
  const filteredResults = useMemo(
    () =>
      resultsForEdicao.filter((r) =>
        filteredMilitares.some((m) => m.id === r.militar_id),
      ),
    [resultsForEdicao, filteredMilitares],
  );

  const byPosto = useMemo(() => {
    return POSTOS.map((p) => {
      const list = filteredMilitares.filter((m) => m.posto === p.value);
      const results = filteredResults.filter((r) =>
        list.some((m) => m.id === r.militar_id),
      );
      const mm = mencaoMedia(results.map((r) => r.mencao));
      const insuf = results.filter((r) => isInsuf(r.mencao)).length;
      return {
        posto: p.value as Posto,
        label: p.plural,
        total: list.length,
        realizados: results.length,
        pendentes: list.length - results.length,
        mencao: mm,
        insuf,
      };
    });
  }, [filteredMilitares, filteredResults]);

  // Top 3 Cabos e Soldados — média das notas de todos os exercícios
  const top3 = useMemo(() => {
    const cabosESoldados = filteredMilitares.filter(
      (m) => m.posto === "cabo" || m.posto === "soldado",
    );
    return cabosESoldados
      .map((militar) => {
        const r = filteredResults.find((x) => x.militar_id === militar.id);
        if (!r) return null;
        const notas = [r.nota_corrida, r.nota_flexao, r.nota_abdominal, r.nota_barra].filter(
          (n): n is number => n != null,
        );
        if (!notas.length) return null;
        const media = notas.reduce((a, b) => a + b, 0) / notas.length;
        return { militar, r, media };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.media - a.media)
      .slice(0, 3);
  }, [filteredResults, filteredMilitares]);

  const hasTop3 = top3.length > 0;

  const totalMilitares = filteredMilitares.length;
  const totalRealizados = filteredResults.length;
  const totalInsuf = filteredResults.filter((r) => isInsuf(r.mencao)).length;
  const mencaoGeral = useMemo(
    () => mencaoMedia(filteredResults.map((r) => r.mencao)),
    [filteredResults],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Companhia CCAP
          </p>
          <h1 className="mt-1 text-3xl font-display tracking-wide text-primary md:text-4xl">
            Painel do TAF
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe o Teste de Aptidão Física por edição, chamada e categoria.
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button asChild variant="outline">
              <Link to="/militares">Gerenciar militares</Link>
            </Button>
          )}
          {isAvaliador && (
            <Button asChild>
              <Link to="/registros">Registrar TAF</Link>
            </Button>
          )}
          {isCompanhia && (
            <Button asChild>
              <Link to="/meus-resultados">Meus resultados</Link>
            </Button>
          )}
        </div>
      </div>

      {/* TAF e Chamada */}
      <div className="flex flex-wrap gap-4">
        <Tabs value={String(taf)} onValueChange={(v) => setTaf(Number(v))}>
          <TabsList>
            {TAF_NUMEROS.map((n) => (
              <TabsTrigger key={n} value={String(n)}>
                {n}º TAF
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={String(chamada)} onValueChange={(v) => setChamada(Number(v))}>
          <TabsList>
            {CHAMADAS.map((c) => (
              <TabsTrigger key={c} value={String(c)}>
                {c}ª Chamada
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Efetivo total"
          value={totalMilitares}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="TAFs realizados"
          value={`${totalRealizados}/${totalMilitares}`}
          hint={
            totalMilitares
              ? `${Math.round((totalRealizados / totalMilitares) * 100)}% do efetivo`
              : "—"
          }
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Menção média"
          value={
            <span
              className={`inline-block rounded border px-2 py-0.5 text-2xl font-display ${mencaoColor(mencaoGeral.short)}`}
            >
              {mencaoGeral.short}
            </span>
          }
          hint={mencaoGeral.label !== "—" ? mencaoGeral.label : undefined}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Insuficientes"
          value={totalInsuf}
          tone={totalInsuf > 0 ? "danger" : "default"}
        />
      </div>

      {/* ── Top 3 Cabos e Soldados ───────────────────────────────── */}
      {(hasTop3 || loading) && (
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <CardTitle className="font-display text-lg tracking-wide text-primary">
                Top 3 — Cabos e Soldados
              </CardTitle>
              <span className="ml-1 text-xs text-muted-foreground">
                {taf}º TAF · {chamada}ª Chamada
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : top3.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem resultados de Cabos/Soldados nesta edição.
              </p>
            ) : (
              <div className="space-y-3">
                {top3.map(({ militar, r, media }, idx) => (
                  <div
                    key={militar.id}
                    className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${MEDAL_BG[idx]}`}
                  >
                    {/* Posição */}
                    <span className={`w-7 shrink-0 text-center text-lg font-bold ${MEDAL_COLORS[idx]}`}>
                      {RANK_LABEL[idx]}
                    </span>

                    {/* Nome e posto */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium leading-tight">
                        {militar.nome_guerra ?? militar.nome}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {militar.posto}
                      </p>
                    </div>

                    {/* Índices numéricos por exercício */}
                    <div className="flex flex-wrap gap-3 text-center">
                      {[
                        { label: "Corrida", value: r.corrida_metros, unit: "m" },
                        { label: "Flexão", value: r.flexao, unit: "rep" },
                        { label: "Abdom.", value: r.abdominal, unit: "rep" },
                        { label: "Barra", value: r.barra, unit: "rep" },
                      ].map(({ label, value, unit }) => (
                        <div key={label} className="min-w-[52px]">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            {label}
                          </p>
                          <p className="font-display text-base text-primary">
                            {value ?? "—"}
                            {value != null && (
                              <span className="ml-0.5 text-[10px] text-muted-foreground">
                                {unit}
                              </span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Média das notas */}
                    <div className="ml-auto text-right">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Média
                      </p>
                      <p className={`font-display text-xl ${MEDAL_COLORS[idx]}`}>
                        {media.toFixed(1)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Cards por posto ───────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading &&
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        {!loading &&
          byPosto.map((row) => (
            <Card key={row.posto} className="border-border/70">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      Categoria
                    </p>
                    <CardTitle className="font-display text-xl tracking-wide text-primary">
                      {row.label}
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {row.realizados}/{row.total}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric label="Realizados" value={row.realizados} />
                  <Metric label="Pendentes" value={row.pendentes} />
                  <Metric
                    label="Insuf."
                    value={row.insuf}
                    tone={row.insuf > 0 ? "danger" : "default"}
                  />
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">
                      Menção média
                    </span>
                    <span
                      className={`inline-block rounded border px-2 py-0.5 font-display text-2xl ${mencaoColor(row.mencao.short)}`}
                    >
                      {row.mencao.short}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{row.mencao.label !== "—" ? row.mencao.label : "Sem dados"}</span>
                    <span>{row.mencao.score != null ? row.mencao.score.toFixed(2) : ""}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full bg-gold transition-all"
                      style={{
                        width: `${row.mencao.score != null ? Math.min(100, (row.mencao.score / 5) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        {!loading && militares.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-muted-foreground">
                Nenhum militar cadastrado ainda.
              </p>
              <Button asChild>
                <Link to="/militares">Cadastrar militar</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {filteredResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg tracking-wide text-primary">
              Resultados desta edição
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2">Militar</th>
                  <th className="py-2">Categoria</th>
                  <th className="py-2">Data</th>
                  <th className="py-2 text-right">Nota</th>
                  <th className="py-2">Menção</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r) => {
                  const m = filteredMilitares.find((x) => x.id === r.militar_id);
                  const p = POSTOS.find((x) => x.value === m?.posto);
                  return (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2 font-medium">{m?.nome ?? "—"}</td>
                      <td className="py-2 text-muted-foreground">{p?.label ?? "—"}</td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(r.data_aplicacao).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 text-right font-display text-base text-primary">
                        {r.nota_final != null ? Number(r.nota_final).toFixed(2) : "—"}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 text-xs ${mencaoColor(r.mencao)}`}
                        >
                          {r.mencao ?? "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "danger";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          {icon}
          {label}
        </div>
        <div
          className={`mt-2 font-display text-3xl tracking-wide ${tone === "danger" ? "text-destructive" : "text-primary"}`}
        >
          {value}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-md border border-border bg-background p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={`font-display text-lg ${tone === "danger" ? "text-destructive" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}
