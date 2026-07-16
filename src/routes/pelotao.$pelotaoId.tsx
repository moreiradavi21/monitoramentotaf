import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Users,
  Activity,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  Trophy,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import {
  PELOTOES,
  pelotaoLabel,
  TAF_NUMEROS,
  CHAMADAS,
  mencaoColor,
  mencaoMedia,
  postoLabel,
  type Posto,
} from "@/lib/taf";
import { useMilitares, useResultados } from "@/lib/data";
import { RequireAdmin } from "@/components/require-admin";

export const Route = createFileRoute("/pelotao/$pelotaoId")({
  component: () => (
    <RequireAdmin>
      <PelotaoPage />
    </RequireAdmin>
  ),
});

function isInsuf(mencao: string | null | undefined) {
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

type SortKey = "nome" | "mencao" | "posto";

function PelotaoPage() {
  const { pelotaoId } = Route.useParams();
  const [taf, setTaf] = useState(1);
  const [chamada, setChamada] = useState(1);
  const [busca, setBusca] = useState("");
  const [sort, setSort] = useState<SortKey>("nome");
  const [sortDesc, setSortDesc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pelotao = PELOTOES.find((p) => p.value === pelotaoId);
  const militaresQ = useMilitares();
  const resQ = useResultados();

  const loading = militaresQ.isLoading || resQ.isLoading;

  const militares = useMemo(
    () => (militaresQ.data ?? []).filter((m) => m.pelotao === pelotaoId),
    [militaresQ.data, pelotaoId],
  );

  const resultados = useMemo(
    () =>
      (resQ.data ?? [])
        .filter((r) => r.taf_numero === taf && r.chamada === chamada)
        .filter((r) => militares.some((m) => m.id === r.militar_id)),
    [resQ.data, taf, chamada, militares],
  );

  // Stats
  const total = militares.length;
  const realizados = resultados.length;
  const insuf = resultados.filter((r) => isInsuf(r.mencao)).length;
  const mencaoGeral = useMemo(
    () => mencaoMedia(resultados.map((r) => r.mencao)),
    [resultados],
  );

  // Top 3 Cabos e Soldados
  const top3 = useMemo(() => {
    const eligible = militares.filter(
      (m) => m.posto === "cabo" || m.posto === "soldado",
    );
    return eligible
      .map((m) => {
        const r = resultados.find((x) => x.militar_id === m.id);
        if (!r) return null;
        const notas = [r.nota_corrida, r.nota_flexao, r.nota_abdominal, r.nota_barra].filter(
          (n): n is number => n != null,
        );
        if (!notas.length) return null;
        const media = notas.reduce((a, b) => a + b, 0) / notas.length;
        return { militar: m, r, media };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.media - a.media)
      .slice(0, 3);
  }, [militares, resultados]);

  // Lista filtrada e ordenada
  const listaMilitares = useMemo(() => {
    const query = busca.toLowerCase().trim();
    let list = militares.filter(
      (m) =>
        !query ||
        m.nome.toLowerCase().includes(query) ||
        (m.nome_guerra ?? "").toLowerCase().includes(query),
    );

    const MENCAO_SCORE: Record<string, number> = {
      E: 5, EXCELENTE: 5, MB: 4, "MUITO BOM": 4,
      B: 3, BOM: 3, R: 2, REGULAR: 2, SUF: 2,
      I: 1, INSUF: 1, INSUFICIENTE: 1,
    };

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sort === "nome") {
        cmp = (a.nome_guerra ?? a.nome).localeCompare(b.nome_guerra ?? b.nome, "pt");
      } else if (sort === "posto") {
        const postoOrder = ["oficial", "sargento", "cabo", "soldado", "recruta"];
        cmp = postoOrder.indexOf(a.posto) - postoOrder.indexOf(b.posto);
      } else if (sort === "mencao") {
        const ra = resultados.find((r) => r.militar_id === a.id);
        const rb = resultados.find((r) => r.militar_id === b.id);
        const sa = ra?.mencao ? (MENCAO_SCORE[ra.mencao.toUpperCase()] ?? 0) : -1;
        const sb = rb?.mencao ? (MENCAO_SCORE[rb.mencao.toUpperCase()] ?? 0) : -1;
        cmp = sb - sa;
      }
      return sortDesc ? -cmp : cmp;
    });

    return list;
  }, [militares, busca, sort, sortDesc, resultados]);

  if (!pelotao && !loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-muted-foreground">Pelotão não encontrado.</p>
        <Button asChild variant="outline">
          <Link to="/">Voltar ao painel</Link>
        </Button>
      </div>
    );
  }

  function toggleSort(key: SortKey) {
    if (sort === key) setSortDesc((d) => !d);
    else { setSort(key); setSortDesc(false); }
  }

  function SortButton({ label, k }: { label: string; k: SortKey }) {
    const active = sort === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`flex items-center gap-1 text-xs uppercase tracking-widest transition-colors ${
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        {active ? (
          sortDesc ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
        ) : null}
      </button>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Cabeçalho */}
      <div>
        <Link
          to="/"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Painel TAF
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              Companhia CCAP
            </p>
            <h1 className="mt-1 text-3xl font-display tracking-wide text-primary md:text-4xl">
              {loading ? "…" : pelotao?.label ?? pelotaoId}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {total} militar{total !== 1 ? "es" : ""} · {realizados} TAF{realizados !== 1 ? "s" : ""} realizado{realizados !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* TAF / Chamada */}
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

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Efetivo" value={total} />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Realizados"
          value={`${realizados}/${total}`}
          hint={total ? `${Math.round((realizados / total) * 100)}%` : "—"}
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
          value={insuf}
          tone={insuf > 0 ? "danger" : "default"}
        />
      </div>

      {/* Top 3 */}
      {top3.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <CardTitle className="font-display text-lg tracking-wide text-primary">
                Top 3 — Cabos e Soldados
              </CardTitle>
              <span className="text-xs text-muted-foreground">{taf}º TAF · {chamada}ª Chamada</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {top3.map(({ militar, r, media }, idx) => (
              <div
                key={militar.id}
                className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/20 ${MEDAL_BG[idx]}`}
              >
                <span className={`w-7 shrink-0 text-center text-lg font-bold ${MEDAL_COLORS[idx]}`}>
                  {RANK_LABEL[idx]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{militar.nome_guerra ?? militar.nome}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {postoLabel(militar.posto as Posto)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-center">
                  {[
                    { label: "Corrida", value: r.corrida_metros, unit: "m" },
                    { label: "Flexão", value: r.flexao, unit: "rep" },
                    { label: "Abdom.", value: r.abdominal, unit: "rep" },
                    { label: "Barra", value: r.barra, unit: "rep" },
                  ].map(({ label, value, unit }) => (
                    <div key={label} className="min-w-[52px]">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
                      <p className="font-display text-base text-primary">
                        {value ?? "—"}
                        {value != null && <span className="ml-0.5 text-[10px] text-muted-foreground">{unit}</span>}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Média</p>
                  <p className={`font-display text-xl ${MEDAL_COLORS[idx]}`}>{media.toFixed(1)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Lista de militares */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="font-display text-lg tracking-wide text-primary">
              Militares
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : listaMilitares.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {busca ? "Nenhum militar encontrado com esse nome." : "Nenhum militar neste pelotão."}
            </p>
          ) : (
            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      <SortButton label="Nome" k="nome" />
                    </th>
                    <th className="px-3 py-2 text-left">
                      <SortButton label="Posto" k="posto" />
                    </th>
                    <th className="px-3 py-2 text-left">
                      <SortButton label="Menção" k="mencao" />
                    </th>
                    <th className="px-3 py-2 text-left">Exercícios</th>
                    <th className="w-8 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {listaMilitares.map((m) => {
                    const res = resultados.find((r) => r.militar_id === m.id);
                    const open = expandedId === m.id;
                    return (
                      <>
                        <tr
                          key={m.id}
                          className={`cursor-pointer border-t transition-colors hover:bg-muted/30 ${open ? "bg-muted/20" : ""}`}
                          onClick={() => setExpandedId(open ? null : m.id)}
                        >
                          <td className="px-3 py-3">
                            <p className="font-medium leading-tight">{m.nome_guerra ?? m.nome}</p>
                            {m.nome_guerra && (
                              <p className="text-[10px] text-muted-foreground">{m.nome}</p>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant="outline" className="capitalize text-[10px]">
                              {postoLabel(m.posto as Posto)}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            {res?.mencao ? (
                              <span className={`inline-block rounded border px-2 py-0.5 text-xs font-display ${mencaoColor(res.mencao)}`}>
                                {res.mencao}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Pendente</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {res ? (
                              <div className="flex flex-wrap gap-3 text-xs">
                                {[
                                  { k: "Cor", v: res.corrida_metros, u: "m" },
                                  { k: "Flex", v: res.flexao, u: "" },
                                  { k: "Abd", v: res.abdominal, u: "" },
                                  { k: "Bar", v: res.barra, u: "" },
                                ].map(({ k, v, u }) => (
                                  <span key={k} className="text-muted-foreground">
                                    <span className="font-medium text-foreground">{v ?? "—"}</span>
                                    {v != null && u && <span className="ml-0.5">{u}</span>}
                                    <span className="ml-0.5 text-[10px]">{k}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {open ? (
                              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </td>
                        </tr>

                        {/* Linha expandida */}
                        {open && (
                          <tr key={`${m.id}-detail`} className="border-t bg-muted/10">
                            <td colSpan={5} className="px-4 py-3">
                              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                <DetailItem label="Nome completo" value={m.nome} />
                                <DetailItem
                                  label="Data de nasc."
                                  value={
                                    m.data_nascimento
                                      ? new Date(m.data_nascimento + "T12:00:00").toLocaleDateString("pt-BR")
                                      : "—"
                                  }
                                />
                                {res && (
                                  <>
                                    <DetailItem
                                      label="Nota final"
                                      value={res.nota_final != null ? Number(res.nota_final).toFixed(2) : "—"}
                                    />
                                    <DetailItem
                                      label="Data do TAF"
                                      value={new Date(res.data_aplicacao).toLocaleDateString("pt-BR")}
                                    />
                                    <DetailItem
                                      label="Corrida"
                                      value={res.corrida_metros != null ? `${res.corrida_metros} m (nota ${res.nota_corrida ?? "—"})` : "—"}
                                    />
                                    <DetailItem
                                      label="Flexão"
                                      value={res.flexao != null ? `${res.flexao} rep (nota ${res.nota_flexao ?? "—"})` : "—"}
                                    />
                                    <DetailItem
                                      label="Abdominal"
                                      value={res.abdominal != null ? `${res.abdominal} rep (nota ${res.nota_abdominal ?? "—"})` : "—"}
                                    />
                                    <DetailItem
                                      label="Barra"
                                      value={res.barra != null ? `${res.barra} rep (nota ${res.nota_barra ?? "—"})` : "—"}
                                    />
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon, label, value, hint, tone,
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
          {icon} {label}
        </div>
        <div className={`mt-2 font-display text-3xl tracking-wide ${tone === "danger" ? "text-destructive" : "text-primary"}`}>
          {value}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
