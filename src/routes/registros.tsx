import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Download, Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  mencaoParaNota,
  mencaoColor,
  extractMencoes,
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
  nota_flexao?: string;
  nota_abdominal?: string;
  nota_corrida?: string;
  nota_barra?: string;
  nota_final?: string;
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
  const { isAdmin } = useAuth();
  const save = useSaveResultado();
  const del = useDeleteResultado();
  const saveMilitar = useSaveMilitar();

  const [militarPickerOpen, setMilitarPickerOpen] = useState(false);
  const [militarSearch, setMilitarSearch] = useState("");
  const [novoMilitarOpen, setNovoMilitarOpen] = useState(false);
  const [novoMilitar, setNovoMilitar] = useState<{ nome: string; nome_guerra: string; posto: Posto; data_nascimento: string }>({
    nome: "",
    nome_guerra: "",
    posto: "soldado",
    data_nascimento: "",
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm());
  const [confirmDelete, setConfirmDelete] = useState<TafResultado | null>(null);

  const [fTaf, setFTaf] = useState<string>("todos");
  const [fCh, setFCh] = useState<string>("todos");
  const [fPosto, setFPosto] = useState<string>("todos");

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
      nota_flexao: r.nota_flexao?.toString() ?? "",
      nota_abdominal: r.nota_abdominal?.toString() ?? "",
      nota_corrida: r.nota_corrida?.toString() ?? "",
      nota_barra: r.nota_barra?.toString() ?? "",
      nota_final: r.nota_final?.toString() ?? "",
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

  // auto media
  const autoMedia = useMemo(() => {
    const notas = [form.nota_flexao, form.nota_abdominal, form.nota_corrida, form.nota_barra]
      .map(num)
      .filter((n): n is number => n != null);
    if (!notas.length) return null;
    return notas.reduce((a, b) => a + b, 0) / notas.length;
  }, [form.nota_flexao, form.nota_abdominal, form.nota_corrida, form.nota_barra]);

  // Cálculo automático de menções por idade a partir das tabelas do Anexo A
  const militarSel = militares.find((m) => m.id === form.militar_id);
  const idade = calcIdade(militarSel?.data_nascimento ?? null, form.data_aplicacao);
  const mencoesAuto = useMemo(() => {
    return {
      FLEX: mencaoPorIdade("flexao", idade, num(form.flexao)),
      ABD: mencaoPorIdade("abdominal", idade, num(form.abdominal)),
      COR: mencaoPorIdade("corrida", idade, num(form.corrida_metros)),
      BAR: mencaoPorIdade("barra", idade, num(form.barra)),
    };
  }, [idade, form.flexao, form.abdominal, form.corrida_metros, form.barra]);
  const mencaoFinalAuto = useMemo(
    () => mencaoFinalDe([mencoesAuto.FLEX, mencoesAuto.ABD, mencoesAuto.COR, mencoesAuto.BAR]),
    [mencoesAuto],
  );

  async function handleSave() {
    if (!form.militar_id) {
      toast.error("Selecione o militar.");
      return;
    }
    const finalNota = num(form.nota_final) ?? autoMedia;
    const mencao =
      form.mencao && form.mencao.trim().length
        ? form.mencao.trim()
        : mencaoFinalAuto ?? mencaoParaNota(finalNota);
    // Observações: mescla o texto do usuário com as menções calculadas por exercício
    const partes: string[] = [];
    (["FLEX", "ABD", "COR", "BAR"] as const).forEach((k) => {
      if (mencoesAuto[k]) partes.push(`${k}:${mencoesAuto[k]}`);
    });
    const obsAuto = partes.join(" ");
    const obsUser = (form.observacoes ?? "")
      .replace(/(FLEX|ABD|COR|BAR)\s*:\s*[A-Za-zÀ-ÿ]+/gi, "")
      .trim();
    const observacoes = [obsAuto, obsUser].filter(Boolean).join(" ").trim() || null;
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
        nota_flexao: num(form.nota_flexao),
        nota_abdominal: num(form.nota_abdominal),
        nota_corrida: num(form.nota_corrida),
        nota_barra: num(form.nota_barra),
        nota_final: finalNota,
        mencao: mencao === "—" ? null : mencao,
        observacoes,
      });
      toast.success(form.id ? "Registro atualizado." : "TAF registrado.");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar. Verifique se já não existe um registro para este militar/TAF/chamada.");
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

  const filtrados = useMemo(() => {
    return resultados.filter((r) => {
      if (fTaf !== "todos" && r.taf_numero !== Number(fTaf)) return false;
      if (fCh !== "todos" && r.chamada !== Number(fCh)) return false;
      if (fPosto !== "todos") {
        const m = militarById.get(r.militar_id);
        if (m?.posto !== fPosto) return false;
      }
      return true;
    });
  }, [resultados, fTaf, fCh, fPosto, militarById]);

  function exportarPlanilha() {
    const rows = filtrados.map((r) => {
      const m = militarById.get(r.militar_id);
      const p = POSTOS.find((x) => x.value === m?.posto);
      const mc = extractMencoes(r.observacoes, r.mencao);
      return {
        Militar: m?.nome ?? "",
        Categoria: p?.label ?? "",
        TAF: r.taf_numero,
        Chamada: r.chamada,
        Data: r.data_aplicacao,
        "Corrida (m)": r.corrida_metros ?? "",
        "Menção COR": mc.COR,
        "Flexão": r.flexao ?? "",
        "Menção FLEX": mc.FLEX,
        "Abdominal": r.abdominal ?? "",
        "Menção ABD": mc.ABD,
        "Barra": r.barra ?? "",
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Registros
          </p>
          <h1 className="mt-1 text-3xl font-display tracking-wide text-primary">
            Resultados do TAF
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registre e edite os resultados dos exercícios por militar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} disabled={militares.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Novo registro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="font-display tracking-wide">
                {form.id ? "Editar registro" : "Registrar TAF"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Militar</Label>
                  <Popover open={militarPickerOpen} onOpenChange={setMilitarPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        <span className="truncate">
                          {militarSel ? militarSel.nome : "Buscar militar..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" side="bottom" sideOffset={4}>
                      <Command
                        filter={(value, search) =>
                          value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                        }
                      >
                        <CommandInput
                          placeholder="Digite o nome..."
                          value={militarSearch}
                          onValueChange={setMilitarSearch}
                        />
                        <CommandList className="max-h-52">
                          <CommandEmpty>
                            <div className="space-y-2 py-2 text-center text-sm">
                              <p className="text-muted-foreground">Nenhum militar encontrado.</p>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setNovoMilitar({
                                    nome: militarSearch.trim(),
                                    posto: "soldado",
                                    data_nascimento: "",
                                  });
                                  setMilitarPickerOpen(false);
                                  setNovoMilitarOpen(true);
                                }}
                              >
                                <UserPlus className="mr-2 h-4 w-4" />
                                Cadastrar "{militarSearch.trim() || "novo militar"}"
                              </Button>
                            </div>
                          </CommandEmpty>
                          {POSTOS.map((p) => {
                            const list = militares.filter((m) => m.posto === p.value);
                            if (!list.length) return null;
                            return (
                              <CommandGroup key={p.value} heading={p.plural}>
                                {list.map((m) => (
                                  <CommandItem
                                    key={m.id}
                                    value={m.nome}
                                    onSelect={() => {
                                      setForm({ ...form, militar_id: m.id });
                                      setMilitarPickerOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        form.militar_id === m.id ? "opacity-100" : "opacity-0",
                                      )}
                                    />
                                    {m.nome}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            );
                          })}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>TAF</Label>
                  <Select
                    value={String(form.taf_numero)}
                    onValueChange={(v) => setForm({ ...form, taf_numero: Number(v) })}
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

              <div className="rounded-md border border-border bg-muted/30 p-2">
                <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                  Exercícios
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <ExField
                    label="Flexão"
                    exVal={form.flexao}
                    notaVal={form.nota_flexao}
                    onEx={(v) => setForm({ ...form, flexao: v })}
                    onNota={(v) => setForm({ ...form, nota_flexao: v })}
                    unit="rep."
                  />
                  <ExField
                    label="Abdominal"
                    exVal={form.abdominal}
                    notaVal={form.nota_abdominal}
                    onEx={(v) => setForm({ ...form, abdominal: v })}
                    onNota={(v) => setForm({ ...form, nota_abdominal: v })}
                    unit="rep."
                  />
                  <ExField
                    label="Corrida"
                    exVal={form.corrida_metros}
                    notaVal={form.nota_corrida}
                    onEx={(v) => setForm({ ...form, corrida_metros: v })}
                    onNota={(v) => setForm({ ...form, nota_corrida: v })}
                    unit="m"
                  />
                  <ExField
                    label="Barra"
                    exVal={form.barra}
                    notaVal={form.nota_barra}
                    onEx={(v) => setForm({ ...form, barra: v })}
                    onNota={(v) => setForm({ ...form, nota_barra: v })}
                    unit="rep."
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Nota final{" "}
                    <span className="text-xs text-muted-foreground">
                      (média automática: {autoMedia != null ? autoMedia.toFixed(2) : "—"})
                    </span>
                  </Label>
                  <Input
                    inputMode="decimal"
                    placeholder={autoMedia != null ? autoMedia.toFixed(2) : "0,00"}
                    value={form.nota_final ?? ""}
                    onChange={(e) => setForm({ ...form, nota_final: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Menção{" "}
                    <span className="text-xs text-muted-foreground">
                      (auto por idade: {mencaoFinalAuto ?? "—"})
                    </span>
                  </Label>
                  <Input
                    placeholder={mencaoFinalAuto ?? mencaoParaNota(autoMedia)}
                    value={form.mencao ?? ""}
                    onChange={(e) => setForm({ ...form, mencao: e.target.value })}
                  />
                </div>
              </div>

              <div className="rounded-md border border-dashed border-border bg-muted/20 p-2 text-xs">
                <p className="uppercase tracking-widest text-muted-foreground">
                  Menções automáticas por idade
                  {idade != null ? ` — ${idade} anos` : militarSel && !militarSel.data_nascimento ? " — cadastre a data de nascimento do militar" : ""}
                </p>
                <div className="flex flex-wrap gap-3">
                  <span>COR: <b>{mencoesAuto.COR ?? "—"}</b></span>
                  <span>FLEX: <b>{mencoesAuto.FLEX ?? "—"}</b></span>
                  <span>ABD: <b>{mencoesAuto.ABD ?? "—"}</b></span>
                  <span>BAR: <b>{mencoesAuto.BAR ?? "—"}</b></span>
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={novoMilitarOpen} onOpenChange={setNovoMilitarOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display tracking-wide">
                Cadastrar novo militar
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={novoMilitar.nome}
                  onChange={(e) => setNovoMilitar({ ...novoMilitar, nome: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label>Posto / Graduação</Label>
                <Select
                  value={novoMilitar.posto}
                  onValueChange={(v) => setNovoMilitar({ ...novoMilitar, posto: v as Posto })}
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
                    setNovoMilitar({ ...novoMilitar, data_nascimento: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNovoMilitarOpen(false)}>
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
                      posto: novoMilitar.posto,
                      data_nascimento: novoMilitar.data_nascimento || null,
                    });
                    toast.success("Militar cadastrado.");
                    setNovoMilitarOpen(false);
                    setMilitarSearch("");
                    // Tenta vincular imediatamente pelo id retornado; senão, pelo nome
                    if (created?.id) {
                      setForm((f) => ({ ...f, militar_id: created.id }));
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
          <Button variant="outline" onClick={exportarPlanilha} disabled={filtrados.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Baixar planilha
          </Button>
        )}
        </div>
      </div>

      {militares.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Cadastre militares antes de registrar TAFs.{" "}
            <Link className="text-primary underline" to="/militares">
              Ir para Militares
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Select value={fTaf} onValueChange={setFTaf}>
            <SelectTrigger className="w-[140px]">
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
            <SelectTrigger className="w-[160px]">
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
            <SelectTrigger className="w-[200px]">
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
          <div className="ml-auto flex items-center text-sm text-muted-foreground">
            <Badge variant="outline">{filtrados.length} registro(s)</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg tracking-wide text-primary">
            Histórico
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="px-3 py-2">Militar</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-2 py-2 text-center">TAF</th>
                <th className="px-2 py-2 text-center">Chamada</th>
                <th className="px-2 py-2 text-center" title="Corrida">COR</th>
                <th className="px-2 py-2 text-center" title="Flexão">FLEX</th>
                <th className="px-2 py-2 text-center" title="Abdominal">ABD</th>
                <th className="px-2 py-2 text-center" title="Barra">BAR</th>
                <th className="px-2 py-2 text-center" title="Menção final">FIN</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoading && filtrados.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
              {filtrados.map((r) => {
                const m = militarById.get(r.militar_id);
                const p = POSTOS.find((x) => x.value === m?.posto);
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
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">{m?.nome ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {m?.identificacao ?? p?.label ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-center">{r.taf_numero}º</td>
                    <td className="px-2 py-2 text-center">{r.chamada}ª</td>
                    <td className="px-2 py-2 text-center">{cell(mc.COR, r.corrida_metros, "m")}</td>
                    <td className="px-2 py-2 text-center">{cell(mc.FLEX, r.flexao)}</td>
                    <td className="px-2 py-2 text-center">{cell(mc.ABD, r.abdominal)}</td>
                    <td className="px-2 py-2 text-center">{cell(mc.BAR, r.barra)}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`inline-block min-w-[2.25rem] rounded border px-1.5 py-0.5 text-xs font-medium ${mencaoColor(mc.FIN)}`}>
                        {mc.FIN}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
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

function ExField({
  label,
  exVal,
  notaVal,
  onEx,
  onNota,
  unit,
}: {
  label: string;
  exVal?: string;
  notaVal?: string;
  onEx: (v: string) => void;
  onNota: (v: string) => void;
  unit: string;
}) {
  return (
    <div className="space-y-1.5 rounded border border-border/70 bg-background p-2">
      <div className="text-xs font-medium text-primary">{label}</div>
      <div>
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Execução ({unit})
        </Label>
        <Input
          className="h-8"
          inputMode="numeric"
          value={exVal ?? ""}
          onChange={(e) => onEx(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Nota (0–10)
        </Label>
        <Input
          className="h-8"
          inputMode="decimal"
          value={notaVal ?? ""}
          onChange={(e) => onNota(e.target.value)}
        />
      </div>
    </div>
  );
}
