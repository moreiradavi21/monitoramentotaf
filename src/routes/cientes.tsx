import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Download,
  Search,
  CheckCircle2,
  Clock,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { POSTOS, TAF_NUMEROS, CHAMADAS, mencaoColor, pelotaoLabel } from "@/lib/taf";
import { useMilitares, useResultados } from "@/lib/data";
import { RequireAdmin } from "@/components/require-admin";

export const Route = createFileRoute("/cientes")({
  component: () => (
    <RequireAdmin>
      <CientesPage />
    </RequireAdmin>
  ),
});

// Ordem de exibição por posto (do mais graduado ao menos graduado)
const POSTO_ORDER = ["oficial", "sargento", "cabo", "soldado", "recruta"] as const;

function CientesPage() {
  const militaresQ = useMilitares();
  const resQ = useResultados();

  const [search, setSearch] = useState("");
  const [taf, setTaf] = useState<number>(1);
  const [chamada, setChamada] = useState<number>(1);

  const loading = militaresQ.isLoading || resQ.isLoading;
  const militares = militaresQ.data ?? [];
  const resultados = resQ.data ?? [];

  /** Registros que têm ciente_at preenchido para o TAF/chamada selecionado */
  const cientes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resultados
      .filter(
        (r) =>
          r.taf_numero === taf &&
          r.chamada === chamada &&
          r.ciente_at != null,
      )
      .map((r) => {
        const militar = militares.find((m) => m.id === r.militar_id);
        if (!militar) return null;
        return { r, militar };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter(({ militar }) => {
        if (!q) return true;
        return (
          militar.nome.toLowerCase().includes(q) ||
          (militar.nome_guerra ?? "").toLowerCase().includes(q) ||
          (militar.posto ?? "").toLowerCase().includes(q)
        );
      });
  }, [resultados, militares, taf, chamada, search]);

  /** Agrupa por posto na ordem hierárquica */
  const grouped = useMemo(() => {
    return POSTO_ORDER.map((posto) => ({
      posto,
      label: POSTOS.find((p) => p.value === posto)?.plural ?? posto,
      items: cientes
        .filter(({ militar }) => militar.posto === posto)
        .sort((a, b) => a.militar.nome.localeCompare(b.militar.nome, "pt-BR")),
    })).filter((g) => g.items.length > 0);
  }, [cientes]);

  function exportarExcel() {
    const rows = cientes
      .sort((a, b) => {
        const pa = POSTO_ORDER.indexOf(a.militar.posto as (typeof POSTO_ORDER)[number]);
        const pb = POSTO_ORDER.indexOf(b.militar.posto as (typeof POSTO_ORDER)[number]);
        return pa - pb || a.militar.nome.localeCompare(b.militar.nome, "pt-BR");
      })
      .map(({ militar, r }) => ({
        "Posto/Grad.": POSTOS.find((p) => p.value === militar.posto)?.label ?? militar.posto,
        "Nome": militar.nome,
        "Nome de Guerra": militar.nome_guerra ?? "",
        "Pelotão": militar.pelotao ? pelotaoLabel(militar.pelotao) : "",
        "Menção Final": r.mencao ?? "",
        "Data Aplicação": r.data_aplicacao
          ? new Date(r.data_aplicacao + "T12:00:00").toLocaleDateString("pt-BR")
          : "",
        "Data Ciente": r.ciente_at
          ? new Date(r.ciente_at).toLocaleString("pt-BR")
          : "",
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${taf}°TAF ${chamada}°Ch`);

    // Largura automática das colunas
    const cols = Object.keys(rows[0] ?? {}).map((k) => ({
      wch: Math.max(k.length, ...rows.map((r) => String(r[k as keyof typeof r] ?? "").length)) + 2,
    }));
    ws["!cols"] = cols;

    XLSX.writeFile(wb, `cientes_${taf}taf_${chamada}ch.xlsx`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Companhia CCAP
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-wide text-primary md:text-4xl">
            Cientes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Militares que confirmaram ciência dos resultados do TAF.
          </p>
        </div>
        <Button
          onClick={exportarExcel}
          disabled={cientes.length === 0}
          variant="outline"
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Exportar Excel
        </Button>
      </div>

      {/* Filtros de TAF e Chamada */}
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

      {/* Busca + contador */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar militar..."
            className="pl-9"
          />
        </div>
        {!loading && (
          <Badge variant="secondary" className="shrink-0">
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-500" />
            {cientes.length} ciente{cientes.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : cientes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">
              Nenhum ciente registrado para o {taf}º TAF · {chamada}ª Chamada
            </p>
            <p className="text-sm text-muted-foreground/70">
              Os militares precisam acessar "Meus Resultados" e clicar em "Dar Ciente".
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <Card key={group.posto} className="border-border/70">
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-lg tracking-wide text-primary">
                    {group.label}
                  </CardTitle>
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {group.items.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {group.items.map(({ militar, r }, idx) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                    >
                      {/* Número ordinal */}
                      <span className="w-6 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
                        {idx + 1}.
                      </span>

                      {/* Nome */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium leading-tight">
                          {militar.nome}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-0.5">
                          {militar.nome_guerra && (
                            <span className="text-xs text-muted-foreground">
                              {militar.nome_guerra}
                            </span>
                          )}
                          {militar.pelotao && (
                            <span className="text-xs text-muted-foreground/70">
                              {pelotaoLabel(militar.pelotao)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Menção */}
                      {r.mencao && (
                        <span
                          className={`inline-block rounded border px-2 py-0.5 font-display text-sm ${mencaoColor(r.mencao)}`}
                        >
                          {r.mencao}
                        </span>
                      )}

                      {/* Data do ciente */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Ciente
                        </div>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {r.ciente_at
                            ? new Date(r.ciente_at).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
