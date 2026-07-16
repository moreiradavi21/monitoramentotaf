import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Users, Activity, TrendingUp, AlertTriangle, Trophy } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { POSTOS, TAF_NUMEROS, CHAMADAS, mencaoColor, mencaoMedia, type Posto } from "@/lib/taf";
import { useMilitares, useResultados } from "@/lib/data";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
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

interface Top3Item {
  militar: Militar;
  r: TafResultado;
  media: number;
}

function calcularTop3(
  militares: Militar[],
  resultados: TafResultado[],
  postos: Posto[],
): Top3Item[] {
  const filtrados = militares.filter((m) => postos.includes(m.posto));
  return filtrados
    .map((militar) => {
      const r = resultados.find((x) => x.militar_id === militar.id);
      if (!r) return null;
      const notas = [r.nota_corrida, r.nota_flexao, r.nota_abdominal, r.nota_barra].filter(
        (n): n is number => n != null,
      );
      if (!notas.length) return null;
      const media = notas.reduce((a, b) => a + b, 0) / notas.length;
      return { militar, r, media };
    })
    .filter((x): x is Top3Item => x !== null)
    .sort((a, b) => b.media - a.media)
    .slice(0, 3);
}

function Top3Card({
  title,
  postos,
  militares,
  resultados,
  taf,
  chamada,
  loading,
}: {
  title: string;
  postos: Posto[];
  militares: Militar[];
  resultados: TafResultado[];
  taf: number;
  chamada: number;
  loading: boolean;
}) {
  const top3 = useMemo(
    () => calcularTop3(militares, resultados, postos),
    [militares, resultados, postos],
  );

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <CardTitle className="font-display text-lg tracking-wide text-primary">{title}</CardTitle>
          <span className="ml-1 text-xs text-muted-foreground">
            {taf}º TAF · {chamada}ª Chamada
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : top3.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem resultados nesta edição.</p>
        ) : (
          <div className="space-y-3">
            {top3.map(({ militar, r, media }, idx) => (
              <div
                key={militar.id}
                className={`flex flex-col gap-2 rounded-lg border px-4 py-3 ${MEDAL_BG[idx]}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-7 shrink-0 text-center text-lg font-bold ${MEDAL_COLORS[idx]}`}>
                    {RANK_LABEL[idx]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight">
                      {militar.nome_guerra ?? militar.nome}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {militar.posto}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Média</p>
                    <p className={`font-display text-xl ${MEDAL_COLORS[idx]}`}>{media.toFixed(1)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Menção</p>
                    <span className={`inline-block rounded border px-2 py-0.5 text-xs ${mencaoColor(r.mencao)}`}>
                      {r.mencao ?? "—"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: "Corrida", nota: r.nota_corrida, raw: r.corrida_metros, unit: "m" },
                    { label: "Flexão", nota: r.nota_flexao, raw: r.flexao, unit: "rep" },
                    { label: "Abdom.", nota: r.nota_abdominal, raw: r.abdominal, unit: "rep" },
                    { label: "Barra", nota: r.nota_barra, raw: r.barra, unit: "rep" },
                  ].map(({ label, nota, raw, unit }) => (
                    <div key={label} className="rounded-md border border-border bg-background p-2 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
                      <p className="font-display text-base text-primary">
                        {nota != null ? nota.toFixed(1) : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {raw != null ? `${raw}${unit}` : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const [taf, setTaf] = useState<number>(1);
  const [chamada, setChamada] = useState<number>(1);
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

  // Top 3 por categoria — média das notas de todos os exercícios
  const top3CabosSoldados = useMemo(
    () => calcularTop3(militares, resultsForEdicao, ["cabo", "soldado"]),
    [militares, resultsForEdicao],
  );
  const top3Recrutas = useMemo(
    () => calcularTop3(militares, resultsForEdicao, ["recruta"]),
    [militares, resultsForEdicao],
  );

  const hasTop3 = top3CabosSoldados.length > 0 || top3Recrutas.length > 0;

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

      {/* StatCards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Efetivo total" value={totalMilitares} />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="TAFs realizados"
          value={`${totalRealizados}/${totalMilitares}`}
          hint={totalMilitares ? `${Math.round((totalRealizados / totalMilitares) * 100)}% do efetivo` : "—"}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Menção média"
          value={
            <span className={`inline-block rounded border px-2 py-0.5 text-2xl font-display ${mencaoColor(mencaoGeral.short)}`}>
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

      {/* Top 3 */}
      {hasTop3 || loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Top3Card
            title="Top 3 — Cabos e Soldados"
            postos={["cabo", "soldado"]}
            militares={militares}
            resultados={resultsForEdicao}
            taf={taf}
            chamada={chamada}
            loading={loading}
          />
          <Top3Card
            title="Top 3 — Recrutas"
            postos={["recruta"]}
            militares={militares}
            resultados={resultsForEdicao}
            taf={taf}
            chamada={chamada}
            loading={loading}
          />
        </div>
      ) : null}

      {/* Cards por posto */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
        {!loading && byPosto.map((row) => (
          <Card key={row.posto} className="border-border/70">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Categoria</p>
                  <CardTitle className="font-display text-xl tracking-wide text-primary">{row.label}</CardTitle>
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
                <Metric label="Insuf." value={row.insuf} tone={row.insuf > 0 ? "danger" : "default"} />
              </div>
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Menção média</span>
                  <span className={`inline-block rounded border px-2 py-0.5 font-display text-2xl ${mencaoColor(row.mencao.short)}`}>
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
                    style={{ width: `${row.mencao.score != null ? Math.min(100, (row.mencao.score / 5) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && militares.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-muted-foreground">Nenhum militar cadastrado ainda.</p>
              <Button asChild><Link to="/militares">Cadastrar militar</Link></Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabela de resultados */}
      {resultsForEdicao.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg tracking-wide text-primary">Resultados desta edição</CardTitle>
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
                {resultsForEdicao.map((r) => {
                  const m = militares.find((x) => x.id === r.militar_id);
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
                        <span className={`inline-block rounded border px-2 py-0.5 text-xs ${mencaoColor(r.mencao)}`}>
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

function StatCard({ icon, label, value, hint, tone }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string; tone?: "default" | "danger";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">{icon}{label}</div>
        <div className={`mt-2 font-display text-3xl tracking-wide ${tone === "danger" ? "text-destructive" : "text-primary"}`}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "default" | "danger"; }) {
  return (
    <div className="rounded-md border border-border bg-background p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-display text-lg ${tone === "danger" ? "text-destructive" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
