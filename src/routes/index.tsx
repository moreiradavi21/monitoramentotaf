import { calcIdade, mencaoPorIdade, type ExercicioIdx } from "@/lib/indices";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Users, Activity, TrendingUp, AlertTriangle, Trophy, Search, CheckCircle2, Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { POSTOS, TAF_NUMEROS, CHAMADAS, mencaoColor, mencaoMedia, pelotaoLabel, type Posto } from "@/lib/taf";
import { matchesMilitar } from "@/lib/military-search";
import { useMilitares, useResultados } from "@/lib/data";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{"title": "Painel TAF | Companhia CCAP"}, {"name": "description", "content": "Acompanhamento dos testes de aptidão física da Companhia CCAP por TAF e chamada."}, {"property": "og:title", "content": "Painel TAF | Companhia CCAP"}, {"property": "og:description", "content": "Acompanhamento dos testes de aptidão física da Companhia CCAP por TAF e chamada."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }),
  component: Dashboard,
});

function isInsuf(mencao: string | null | undefined): boolean {
  if (!mencao) return false;
  const m = mencao.trim().toUpperCase();
  return m === "I" || m === "INSUF" || m === "INSUFICIENTE";
}

const MEDAL_COLORS = [
  "text-yellow-500",
  "text-slate-400",
  "text-amber-700",
  "text-primary/70",
];
const MEDAL_BG = [
  "bg-yellow-500/10 border-yellow-500/40",
  "bg-slate-400/10 border-slate-400/30",
  "bg-amber-700/10 border-amber-700/30",
  "bg-muted/40 border-border",
];
const RANK_LABEL = ["1º", "2º", "3º", "4º"];

const MENCAO_SCORE_MAP: Record<string, number> = {
  E: 5, EXCELENTE: 5,
  MB: 4, "MUITO BOM": 4,
  B: 3, BOM: 3,
  R: 2, REGULAR: 2, SUF: 2,
  I: 1, INSUF: 1, INSUFICIENTE: 1,
};
function mencaoScore(m: string | null | undefined): number {
  if (!m) return 0;
  return MENCAO_SCORE_MAP[m.trim().toUpperCase()] ?? 0;
}

function Dashboard() {
  const [taf, setTaf] = useState<number>(1);
  const [chamada, setChamada] = useState<number>(1);
  const [search, setSearch] = useState("");
  const { isAdmin, isAvaliador, isCompanhia } = useAuth();
  const militaresQ = useMilitares();
  const resQ = useResultados();

  const loading = militaresQ.isLoading || resQ.isLoading;
  const militares = militaresQ.data ?? [];
  const resultados = resQ.data ?? [];

  const resultsForEdicao = useMemo(
    () =>
      resultados.filter(
        (r) => r.taf_numero === taf && r.chamada === chamada,
      ),
    [resultados, taf, chamada],
  );

  /** Busca por nome completo ou de guerra (sem acentos) na edição selecionada */
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return militares
      .filter((m) => matchesMilitar(m, search))
      .map((m) => ({
        militar: m,
        resultado: resultsForEdicao.find((r) => r.militar_id === m.id) ?? null,
      }))
      .sort((a, b) => a.militar.nome.localeCompare(b.militar.nome, "pt-BR"));
  }, [militares, resultsForEdicao, search]);

  const byPosto = useMemo(() => {
    return POSTOS.map((p) => {
      const list = militares.filter((m) => m.posto === p.value);
      const results = resultsForEdicao.filter((r) =>
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
  }, [militares, resultsForEdicao]);

  // Top 4 Cabos, Soldados e Recrutas — ranking ponderado (corrida/barra peso 2, flexão 1,5, abdominal 1)
  const top4 = useMemo(() => {
    const elegíveis = militares.filter(
      (m) => m.posto === "cabo" || m.posto === "soldado" || m.posto === "recruta",
    );
    return elegíveis
      .map((militar) => {
        const r = resultsForEdicao.find((x) => x.militar_id === militar.id);
        if (!r) return null;
        if (!mencaoScore(r.mencao)) return null; // sem menção registrada
        const idade = calcIdade(militar.data_nascimento, r.data_aplicacao);
        const cat = (militar as { categoria_taf?: string | null }).categoria_taf ?? null;
        const pts = (ex: ExercicioIdx, v: number | null | undefined) =>
          mencaoScore(mencaoPorIdade(ex, idade, v, cat));
        // Pesos: corrida 2, barra 2, flexão 1,5, abdominal 1
        const score =
          pts("corrida", r.corrida_metros) * 2 +
          pts("barra", r.barra) * 2 +
          pts("flexao", r.flexao) * 1.5 +
          pts("abdominal", r.abdominal) * 1;
        const exercTotal =
          (r.corrida_metros ?? 0) * 2 + (r.barra ?? 0) * 200 + (r.flexao ?? 0) * 150 + (r.abdominal ?? 0) * 100;
        return { militar, r, score, exercTotal };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score || b.exercTotal - a.exercTotal)
      .slice(0, 4);
  }, [resultsForEdicao, militares]);

  const hasTop4 = top4.length > 0;

  const totalMilitares = militares.length;
  const totalRealizados = resultsForEdicao.length;
  const totalInsuf = resultsForEdicao.filter((r) => isInsuf(r.mencao)).length;
  const mencaoGeral = useMemo(
    () => mencaoMedia(resultsForEdicao.map((r) => r.mencao)),
    [resultsForEdicao],
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

      {/* Busca de militar na edição selecionada */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome completo ou de guerra..."
          className="pl-9"
          autoComplete="off"
        />
      </div>

      {search.trim() && (
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg tracking-wide text-primary">
              Resultado da busca — {taf}º TAF · {chamada}ª Chamada
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Nenhum militar encontrado para "{search}".
              </p>
            ) : (
              <div className="divide-y divide-border">
                {searchResults.map(({ militar, resultado }) => (
                  <div
                    key={militar.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium leading-tight">
                        {militar.nome}
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-2">
                        {militar.nome_guerra && (
                          <span className="text-xs text-muted-foreground">
                            {militar.nome_guerra}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground/70">
                          {POSTOS.find((p) => p.value === militar.posto)?.label ?? militar.posto}
                          {militar.pelotao ? ` · ${pelotaoLabel(militar.pelotao)}` : ""}
                        </span>
                      </div>
                    </div>
                    {resultado ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Realizou
                        </span>
                        {resultado.mencao && (
                          <span
                            className={`inline-block rounded border px-2 py-0.5 font-display text-sm ${mencaoColor(resultado.mencao)}`}
                          >
                            {resultado.mencao}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                        <Clock className="h-3.5 w-3.5" />
                        Não realizou
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

      {/* ── Top 4 Cabos, Soldados e Recrutas ────────────────────── */}
      {(hasTop4 || loading) && (
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <CardTitle className="font-display text-lg tracking-wide text-primary">
                Top 4 — Cabos, Soldados e Recrutas
              </CardTitle>
              <span className="ml-1 text-xs text-muted-foreground">
                {taf}º TAF · {chamada}ª Chamada
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : top4.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem resultados de Cabos/Soldados/Recrutas nesta edição.
              </p>
            ) : (
              <div className="space-y-3">
                {top4.map(({ militar, r, score }, idx) => {
                  const postoLabel = POSTOS.find(p => p.value === militar.posto)?.label ?? militar.posto;
                  return (
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
                          {postoLabel}
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

                      {/* Menção final */}
                      <div className="ml-auto text-right">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Menção
                        </p>
                        <span className={`inline-block rounded border px-2 py-0.5 font-display text-lg ${mencaoColor(r.mencao)}`}>
                          {r.mencao ?? "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pontos</p>
                        <p className={`font-display text-xl ${MEDAL_COLORS[idx]}`}>{score.toFixed(1)}</p>
                      </div>
                    </div>
                  );
                })}
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
