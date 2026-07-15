import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Download, Check, UserPlus, Search } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useAuth } from "@/lib/auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";

import {
  POSTOS,
  TAF_NUMEROS,
  CHAMADAS,
  mencaoColor,
  extractMencoes,
  postoLabel,
  type Posto,
} from "@/lib/taf";
import { calcIdade, mencaoPorIdade, mencaoFinalDe } from "@/lib/indices";
import {
  useDeleteResultado,
  useMilitares,
  useResultados,
  useSaveMilitar,
  useSaveResultado,
  type TafResultado,
} from "@/lib/data";

import { RequireAvaliador } from "@/components/require-admin";

export const Route = createFileRoute("/registros")({
  component: () => (
    <RequireAvaliador>
      <RegistrosPage />
    </RequireAvaliador>
  ),
});

type Form = {
  id?: string;
  militar_id: string;
  taf_numero: number;
  chamada: number;
  data_aplicacao: string;
  flexao?: string;
  abdominal?: string;
  corrida_metros?: string;
  barra?: string;
  mencao?: string;
  observacoes?: string;
};

const emptyForm = (): Form => ({
  militar_id: "",
  taf_numero: 1,
  chamada: 1,
  data_aplicacao: new Date().toISOString().slice(0, 10),
});

function RegistrosPage() {
  const { data: militares = [] } = useMilitares();
  const { data: resultados = [], isLoading } = useResultados();
  const { isAdmin, user } = useAuth();
  const save = useSaveResultado();
  const del = useDeleteResultado();
  const saveMilitar = useSaveMilitar();

  const [militarSearch, setMilitarSearch] = useState("");
  const [novoMilitarOpen, setNovoMilitarOpen] = useState(false);
  const [novoMilitar, setNovoMilitar] = useState<{
    nome: string;
    nome_guerra: string;
    posto: Posto;
    data_nascimento: string;
  }>({ nome: "", nome_guerra: "", posto: "soldado", data_nascimento: "" });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState<TafResultado | null>(null);

  const [fTaf, setFTaf] = useState<string>("todos");
  const [fCh, setFCh] = useState<string>("todos");
  const [fPosto, setFPosto] = useState<string>("todos");

  /** Abre o diálogo de registro com um militar já pré-selecionado (vindo da busca rápida) */
  function openForMilitar(m: Militar) {
    setForm({ ...emptyForm(), militar_id: m.id });
    setMilitarSearch("");
    setOpen(true);
  }

  /** Abre o diálogo de cadastro rápido com o nome pesquisado pré-preenchido */
  function openAddNew(nome: string) {
    setNovoMilitar({ nome: nome.trim(), nome_guerra: "", posto: "soldado", data_nascimento: "" });
    setNovoMilitarOpen(true);
  }

  function openNew() {
    setForm(emptyForm());
    setOpen(true);
  }
  function openEdit(r: TafResultado) {
    setForm({
      id: r.id,
      militar_id: r.militar_id,
      taf_numero: r.taf_numero,
      chamada: r.chamada,
      data_aplicacao: r.data_aplicacao,
      flexao: r.flexao?.toString() ?? "",
      abdominal: r.abdominal?.toString() ?? "",
      corrida_metros: r.corrida_metros?.toString() ?? "",
      barra: r.barra?.toString() ?? "",
      mencao: r.mencao ?? "",
      observacoes: r.observacoes ?? "",
    });
    setOpen(true);
  }

  const num = (v?: string) => {
    if (v == null || v === "") return null;
    const n = Number(v.replace(",", "."));
    return Number.isNaN(n) ? null : n;
  };

  const militarSel = militares.find((m) => m.id === form.militar_id);
  const idade = calcIdade(militarSel?.data_nascimento ?? null, form.data_aplicacao);
  const mencoesAuto = useMemo(
    () => ({
      FLEX: mencaoPorIdade("flexao", idade, num(form.flexao)),
      ABD: mencaoPorIdade("abdominal", idade, num(form.abdominal)),
      COR: mencaoPorIdade("corrida", idade, num(form.corrida_metros)),
      BAR: mencaoPorIdade("barra", idade, num(form.barra)),
    }),
    [idade, form.flexao, form.abdominal, form.corrida_metros, form.barra],
  );
  const mencaoFinalAuto = useMemo(
    () =>
      mencaoFinalDe([
        mencoesAuto.FLEX,
        mencoesAuto.ABD,
        mencoesAuto.COR,
        mencoesAuto.BAR,
      ]),
    [mencoesAuto],
  );

  async function handleSave() {
    if (!form.militar_id) {
      toast.error("Selecione o militar.");
      return;
    }
    const mencao =
      form.mencao && form.mencao.trim().length
        ? form.mencao.trim()
        : mencaoFinalAuto ?? null;
    const partes: string[] = [];
    (["FLEX", "ABD", "COR", "BAR"] as const).forEach((k) => {
      if (mencoesAuto[k]) partes.push(`${k}:${mencoesAuto[k]}`);
    });
    const obsAuto = partes.join(" ");
    const obsUser = (form.observacoes ?? "")
      .replace(/(FLEX|ABD|COR|BAR)\s*:\s*[A-Za-zÀ-ÿ]+/gi, "")
      .trim();
    const observacoes =
      [obsAuto, obsUser].filter(Boolean).join(" ").trim() || null;
    try {
      await save.mutateAsync({
        id: form.id,
        militar_id: form.militar_id,
        taf_numero: form.taf_numero,
        chamada: form.chamada,
        data_aplicacao: form.data_aplicacao,
        flexao: num(form.flexao),
        abdominal: num(form.abdominal),
        corrida_metros: num(form.corrida_metros),
        barra: num(form.barra),
        nota_flexao: null,
        nota_abdominal: null,
        nota_corrida: null,
        nota_barra: null,
        nota_final: null,
        mencao: mencao === "—" ? null : mencao,
        observacoes,
        // Grava avaliador_id somente na criação; undefined = não alterar em edições
        avaliador_id: form.id ? undefined : (user?.id ?? null),
      });
      toast.success(form.id ? "Registro atualizado." : "TAF registrado.");
      setOpen(false);
    } catch (e: any) {
      toast.error(
        e?.message ??
          "Erro ao salvar. Verifique se já não existe um registro para este militar/TAF/chamada.",
      );
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      toast.success("Registro removido.");
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover.");
    }
  }

  const militarById = useMemo(
    () => new Map(militares.map((m) => [m.id, m])),
    [militares],
  );

  // Avaliadores vêem apenas seus próprios registros; admin vê todos
  const resultadosPorPapel = useMemo(() => {
    if (isAdmin) return resultados;
    return resultados.filter((r) => r.avaliador_id === user?.id);
  }, [resultados, isAdmin, user?.id]);

  const filtrados = useMemo(() => {
    return resultadosPorPapel.filter((r) => {
      if (fTaf !== "todos" && r.taf_numero !== Number(fTaf)) return false;
      if (fCh !== "todos" && r.chamada !== Number(fCh)) return false;
      if (fPosto !== "todos") {
        const m = militarById.get(r.militar_id);
        if (m?.posto !== fPosto) return false;
      }
      return true;
    });
  }, [resultadosPorPapel, fTaf, fCh, fPosto, militarById]);

  function exportarPlanilha() {
    const rows = filtrados.map((r) => {
      const m = militarById.get(r.militar_id);
      const p = POSTOS.find((x) => x.value === m?.posto);
      const mc = extractMencoes(r.observacoes, r.mencao);
      return {
        Militar: m?.nome ?? "",
        "Nome de guerra": m?.nome_guerra ?? "",
        Categoria: p?.label ?? "",
        TAF: r.taf_numero,
        Chamada: r.chamada,
        Data: r.data_aplicacao,
        "Corrida (m)": r.corrida_metros ?? "",
        "Menção COR": mc.COR,
        Flexão: r.flexao ?? "",
        "Menção FLEX": mc.FLEX,
        Abdominal: r.abdominal ?? "",
        "Menção ABD": mc.ABD,
        Barra: r.barra ?? "",
        "Menção BAR": mc.BAR,
        "Menção Final": mc.FIN,
        Observações: r.observacoes ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TAF");
    XLSX.writeFile(wb, `TAF_CCAP_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // Shared dialog content (new/edit)
  const dialogContent = (
    <DialogContent className="max-w-lg w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6 top-2 translate-y-0 sm:top-[50%] sm:translate-y-[-50%]">
      <DialogHeader>
        <DialogTitle className="font-display tracking-wide">
          {form.id ? "Editar registro" : "Registrar TAF"}
        </DialogTitle>
      </DialogHeader>
      <div className="grid gap-3 py-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Militar</Label>
            {militarSel ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span className="flex-1 truncate text-sm">{militarSel.nome}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setForm({ ...form, militar_id: "" });
                    setMilitarSearch("");
                  }}
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 opacity-70" />
                  <Input
                    value={militarSearch}
                    onChange={(e) => setMilitarSearch(e.target.value)}
                    placeholder="Buscar militar pelo nome..."
                    className="pl-9"
                    autoComplete="off"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto rounded-md border">
                  {(() => {
                    const q = militarSearch.trim().toLowerCase();
                    const filtered = militares.filter(
                      (m) =>
                        !q ||
                        m.nome.toLowerCase().includes(q) ||
                        (m.nome_guerra ?? "").toLowerCase().includes(q),
                    );
                    if (!filtered.length) {
                      return (
                        <div className="space-y-2 p-3 text-center text-sm">
                          <p className="text-muted-foreground">
                            Nenhum militar encontrado.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setNovoMilitar({
                                nome: militarSearch.trim(),
                                nome_guerra: "",
                                posto: "soldado",
                                data_nascimento: "",
                              });
                              setNovoMilitarOpen(true);
                            }}
                          >
                            <UserPlus className="mr-2 h-4 w-4" />
                            Cadastrar "{militarSearch.trim() || "novo militar"}"
                          </Button>
                        </div>
                      );
                    }
                    return POSTOS.map((p) => {
                      const list = filtered.filter((m) => m.posto === p.value);
                      if (!list.length) return null;
                      return (
                        <div key={p.value}>
                          <div className="sticky top-0 bg-muted/60 px-3 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                            {p.plural}
                          </div>
                          {list.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setForm({ ...form, militar_id: m.id });
                                setMilitarSearch("");
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent active:bg-accent/70"
                            >
                              <span className="flex-1 truncate">{m.nome}</span>
                              {m.nome_guerra && (
                                <span className="text-xs text-muted-foreground">
                                  {m.nome_guerra}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            )}
          </div>
          <div className="space-y-2">
            <Label>Data de aplicação</Label>
            <Input
              type="date"
              value={form.data_aplicacao}
              onChange={(e) =>
                setForm({ ...form, data_aplicacao: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2">
          <div className="space-y-2">
            <Label>TAF</Label>
            <Select
              value={String(form.taf_numero)}
              onValueChange={(v) =>
                setForm({ ...form, taf_numero: Number(v) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAF_NUMEROS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}º TAF
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Chamada</Label>
            <Select
              value={String(form.chamada)}
              onValueChange={(v) => setForm({ ...form, chamada: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAMADAS.map((c) => (
                  <SelectItem key={c} value={String(c)}>
                    {c}ª Chamada
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            Exercícios
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ExField
              label="Flexão"
              exVal={form.flexao}
              onEx={(v) => setForm({ ...form, flexao: v })}
              unit="rep."
            />
            <ExField
              label="Abdominal"
              exVal={form.abdominal}
              onEx={(v) => setForm({ ...form, abdominal: v })}
              unit="rep."
            />
            <ExField
              label="Corrida"
              exVal={form.corrida_metros}
              onEx={(v) => setForm({ ...form, corrida_metros: v })}
              unit="m"
            />
            <ExField
              label="Barra"
              exVal={form.barra}
              onEx={(v) => setForm({ ...form, barra: v })}
              unit="rep."
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>
            Menção final{" "}
            <span className="text-xs text-muted-foreground">
              (auto por idade: {mencaoFinalAuto ?? "—"})
            </span>
          </Label>
          <Input
            placeholder={mencaoFinalAuto ?? "—"}
            value={form.mencao ?? ""}
            onChange={(e) => setForm({ ...form, mencao: e.target.value })}
          />
        </div>

        <div className="rounded-md border border-dashed border-border bg-muted/20 p-2 text-xs">
          <p className="mb-1 uppercase tracking-widest text-muted-foreground">
            Menções automáticas por idade
            {idade != null
              ? ` — ${idade} anos`
              : militarSel && !militarSel.data_nascimento
                ? " — cadastre a data de nascimento"
                : ""}
          </p>
          <div className="flex flex-wrap gap-3">
            <span>
              COR: <b>{mencoesAuto.COR ?? "—"}</b>
            </span>
            <span>
              FLEX: <b>{mencoesAuto.FLEX ?? "—"}</b>
            </span>
            <span>
              ABD: <b>{mencoesAuto.ABD ?? "—"}</b>
            </span>
            <span>
              BAR: <b>{mencoesAuto.BAR ?? "—"}</b>
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea
            rows={1}
            value={form.observacoes ?? ""}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          />
        </div>
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Registros
          </p>
          <h1 className="mt-1 text-2xl font-display tracking-wide text-primary sm:text-3xl">
            Resultados do TAF
          </h1>
          {!isAdmin && (
            <p className="mt-1 text-xs text-muted-foreground">
              Exibindo apenas registros lançados por você.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} disabled={militares.length === 0} size="default">
                <Plus className="mr-2 h-4 w-4" />
                Novo registro
              </Button>
            </DialogTrigger>
            {dialogContent}
          </Dialog>

          {/* Cadastro rápido de militar dentro do fluxo de registro */}
          <Dialog open={novoMilitarOpen} onOpenChange={setNovoMilitarOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display tracking-wide">
                  Cadastrar novo militar
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    value={novoMilitar.nome}
                    onChange={(e) =>
                      setNovoMilitar({ ...novoMilitar, nome: e.target.value })
                    }
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome de guerra</Label>
                  <Input
                    value={novoMilitar.nome_guerra}
                    onChange={(e) =>
                      setNovoMilitar({ ...novoMilitar, nome_guerra: e.target.value })
                    }
                    placeholder="Ex.: SILVA"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Posto / Graduação</Label>
                  <Select
                    value={novoMilitar.posto}
                    onValueChange={(v) =>
                      setNovoMilitar({ ...novoMilitar, posto: v as Posto })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSTOS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data de nascimento</Label>
                  <Input
                    type="date"
                    value={novoMilitar.data_nascimento}
                    onChange={(e) =>
                      setNovoMilitar({
                        ...novoMilitar,
                        data_nascimento: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setNovoMilitarOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!novoMilitar.nome.trim()) {
                      toast.error("Informe o nome.");
                      return;
                    }
                    try {
                      const created: any = await saveMilitar.mutateAsync({
                        nome: novoMilitar.nome.trim(),
                        nome_guerra: novoMilitar.nome_guerra.trim() || null,
                        posto: novoMilitar.posto,
                        data_nascimento: novoMilitar.data_nascimento || null,
                      });
                      toast.success("Militar cadastrado. Agora registre o TAF.");
                      setNovoMilitarOpen(false);
                      setMilitarSearch("");
                      if (created?.id) {
                        // Abre o formulário de TAF já com o novo militar selecionado
                        setForm({ ...emptyForm(), militar_id: created.id });
                        setOpen(true);
                      }
                    } catch (e: any) {
                      toast.error(e?.message ?? "Erro ao cadastrar militar.");
                    }
                  }}
                  disabled={saveMilitar.isPending}
                >
                  {saveMilitar.isPending ? "Salvando..." : "Cadastrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {isAdmin && (
            <Button
              variant="outline"
              onClick={exportarPlanilha}
              disabled={filtrados.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Planilha
            </Button>
          )}
        </div>
      </div>

      {/* Busca rápida de militar — abre o formulário de registro já com o militar selecionado */}
      <QuickSearch
        militares={militares}
        onSelect={openForMilitar}
        onAddNew={openAddNew}
      />

      {militares.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Use a busca acima para cadastrar o primeiro militar e registrar um TAF.
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-3">
          <Select value={fTaf} onValueChange={setFTaf}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos TAFs</SelectItem>
              {TAF_NUMEROS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}º TAF
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fCh} onValueChange={setFCh}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas chamadas</SelectItem>
              {CHAMADAS.map((c) => (
                <SelectItem key={c} value={String(c)}>
                  {c}ª Chamada
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fPosto} onValueChange={setFPosto}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas categorias</SelectItem>
              {POSTOS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.plural}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center">
            <Badge variant="outline">{filtrados.length} registro(s)</Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── MOBILE: cards empilhados ── */}
      <div className="md:hidden space-y-3">
        {isLoading && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Carregando...
          </p>
        )}
        {!isLoading && filtrados.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Nenhum registro encontrado.
            </CardContent>
          </Card>
        )}
        {filtrados.map((r) => {
          const m = militarById.get(r.militar_id);
          const mc = extractMencoes(r.observacoes, r.mencao);
          const keys = ["COR", "FLEX", "ABD", "BAR", "FIN"] as const;
          const rawValues: Record<string, number | null> = {
            COR: r.corrida_metros,
            FLEX: r.flexao,
            ABD: r.abdominal,
            BAR: r.barra,
            FIN: null,
          };
          const suffixes: Record<string, string> = { COR: "m", FLEX: "", ABD: "", BAR: "", FIN: "" };
          return (
            <Card key={r.id} className="border-border/70">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m?.nome ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {m?.nome_guerra ? `${m.nome_guerra} · ` : ""}
                      {r.taf_numero}º TAF · {r.chamada}ª Chamada ·{" "}
                      {new Date(r.data_aplicacao).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9"
                      onClick={() => setConfirmDelete(r)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1 text-center">
                  {keys.map((k) => (
                    <div key={k} className="space-y-0.5">
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
                        {k}
                      </div>
                      <span
                        className={`inline-block w-full rounded border px-0.5 py-0.5 text-[11px] font-medium ${mencaoColor(mc[k])}`}
                      >
                        {mc[k]}
                      </span>
                      <div className="text-[9px] tabular-nums text-muted-foreground">
                        {rawValues[k] != null
                          ? `${rawValues[k]}${suffixes[k]}`
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── DESKTOP: tabela ── */}
      <Card className="hidden md:block">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg tracking-wide text-primary">
            Histórico
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="px-3 py-2">Militar</th>
                <th className="px-3 py-2">NG</th>
                <th className="px-2 py-2 text-center">TAF</th>
                <th className="px-2 py-2 text-center">Ch.</th>
                <th className="px-2 py-2 text-center">COR</th>
                <th className="px-2 py-2 text-center">FLEX</th>
                <th className="px-2 py-2 text-center">ABD</th>
                <th className="px-2 py-2 text-center">BAR</th>
                <th className="px-2 py-2 text-center">FIN</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoading && filtrados.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
              {filtrados.map((r) => {
                const m = militarById.get(r.militar_id);
                const mc = extractMencoes(r.observacoes, r.mencao);
                const cell = (v: string, raw?: number | null, suffix = "") => (
                  <div className="flex flex-col items-center gap-0.5">
                    <span
                      className={`inline-block min-w-[2.25rem] rounded border px-1.5 py-0.5 text-xs font-medium ${mencaoColor(v)}`}
                    >
                      {v}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {raw == null ? "—" : `${raw}${suffix}`}
                    </span>
                  </div>
                );
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border/50 hover:bg-muted/40"
                  >
                    <td className="px-3 py-2 font-medium">{m?.nome ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {m?.nome_guerra ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-center">{r.taf_numero}º</td>
                    <td className="px-2 py-2 text-center">{r.chamada}ª</td>
                    <td className="px-2 py-2 text-center">
                      {cell(mc.COR, r.corrida_metros, "m")}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {cell(mc.FLEX, r.flexao)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {cell(mc.ABD, r.abdominal)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {cell(mc.BAR, r.barra)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={`inline-block min-w-[2.25rem] rounded border px-1.5 py-0.5 text-xs font-medium ${mencaoColor(mc.FIN)}`}
                      >
                        {mc.FIN}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setConfirmDelete(r)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Busca rápida de militar ──────────────────────────────────────────────────

type Militar = import("@/lib/data").Militar;

function QuickSearch({
  militares,
  onSelect,
  onAddNew,
}: {
  militares: Militar[];
  onSelect: (m: Militar) => void;
  onAddNew: (nome: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const lower = q.trim().toLowerCase();
    if (!lower) return [];
    return militares
      .filter(
        (m) =>
          m.nome.toLowerCase().includes(lower) ||
          (m.nome_guerra ?? "").toLowerCase().includes(lower),
      )
      .slice(0, 8);
  }, [q, militares]);

  const showDropdown = open && q.trim().length > 0;

  function handleSelect(m: Militar) {
    setQ("");
    setOpen(false);
    onSelect(m);
  }

  function handleAddNew() {
    const nome = q.trim();
    setQ("");
    setOpen(false);
    onAddNew(nome);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder="Buscar militar para registrar TAF..."
          className="flex h-12 w-full rounded-md border border-input bg-background pl-10 pr-4 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          autoComplete="off"
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-background shadow-lg">
          {results.length > 0 ? (
            <>
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={() => handleSelect(m)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent active:bg-accent/70"
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{m.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.nome_guerra ? `${m.nome_guerra} · ` : ""}
                      {postoLabel(m.posto)}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    Registrar TAF
                  </span>
                </button>
              ))}
              {/* Opção de adicionar mesmo quando há resultados */}
              <div className="border-t border-border">
                <button
                  type="button"
                  onMouseDown={handleAddNew}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <UserPlus className="h-4 w-4 shrink-0" />
                  Adicionar &ldquo;{q.trim()}&rdquo; como novo militar
                </button>
              </div>
            </>
          ) : (
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Nenhum militar encontrado para &ldquo;{q.trim()}&rdquo;.
              </p>
              <button
                type="button"
                onMouseDown={handleAddNew}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80"
              >
                <UserPlus className="h-4 w-4" />
                Adicionar &ldquo;{q.trim()}&rdquo; e registrar TAF
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Auxiliar de campo de exercício ───────────────────────────────────────────

function ExField({
  label,
  exVal,
  onEx,
  unit,
}: {
  label: string;
  exVal?: string;
  onEx: (v: string) => void;
  unit: string;
}) {
  return (
    <div className="space-y-1.5 rounded border border-border/70 bg-background p-2">
      <div className="text-xs font-medium text-primary">{label}</div>
      <div>
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {unit}
        </Label>
        <Input
          className="h-9"
          inputMode="numeric"
          value={exVal ?? ""}
          onChange={(e) => onEx(e.target.value)}
        />
      </div>
    </div>
  );
}
