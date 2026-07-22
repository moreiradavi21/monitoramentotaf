import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Download, Check, UserPlus, Search, ChevronRight, RotateCcw, ClipboardList, FileX } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useAuth } from "@/lib/auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

// ── Tipos ────────────────────────────────────────────────────────────────────

type EditForm = {
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

type Session = { data_aplicacao: string; taf_numero: number; chamada: number };
type EntryForm = {
  militar_id: string;
  flexao: string; abdominal: string; corrida_metros: string; barra: string;
  mencao: string; observacoes: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyEdit = (): EditForm => ({ militar_id: "", taf_numero: 1, chamada: 1, data_aplicacao: today() });
const emptyEntry = (): EntryForm => ({ militar_id: "", flexao: "", abdominal: "", corrida_metros: "", barra: "", mencao: "", observacoes: "" });

// ── Página principal ─────────────────────────────────────────────────────────

function RegistrosPage() {
  const queryClient = useQueryClient();
  const { data: militares = [] } = useMilitares();
  const { data: resultados = [], isLoading } = useResultados();
  const { isAdmin, user } = useAuth();
  const save = useSaveResultado();
  const del = useDeleteResultado();
  const saveMilitar = useSaveMilitar();

  // ── Estado: wizard "Registrar TAF" ──
  const [sessionOpen, setSessionOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [session, setSession] = useState<Session>({ data_aplicacao: today(), taf_numero: 1, chamada: 1 });
  const [entry, setEntry] = useState<EntryForm>(emptyEntry());
  const [entrySearch, setEntrySearch] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [saving, setSaving] = useState(false);

  // ── Estado: edição individual ──
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(emptyEdit());
  const [editSearch, setEditSearch] = useState("");

  // ── Estado: cadastro rápido de militar ──
  const [novoMilitarOpen, setNovoMilitarOpen] = useState(false);
  const [novoMilitar, setNovoMilitar] = useState<{ nome: string; nome_guerra: string; posto: Posto; data_nascimento: string }>(
    { nome: "", nome_guerra: "", posto: "soldado", data_nascimento: "" }
  );
  const [afterNew, setAfterNew] = useState<"entry" | "edit">("entry");

  // ── Estado: confirmar remoção ──
  const [confirmDelete, setConfirmDelete] = useState<TafResultado | null>(null);

  // ── Abas ──
  const [activeTab, setActiveTab] = useState<"resultados" | "pendentes">("resultados");

  // ── Filtros (resultados) ──
  const [fTaf, setFTaf] = useState<string>("todos");
  const [fCh, setFCh] = useState<string>("todos");
  const [fPosto, setFPosto] = useState<string>("todos");

  // ── Filtros (pendentes) ──
  const [pTaf, setPTaf] = useState<number>(1);
  const [pCh, setPCh] = useState<number>(1);
  const [pPosto, setPPosto] = useState<string>("todos");

  // ── Justificativa ──
  const [justOpen, setJustOpen] = useState(false);
  const [justMilitar, setJustMilitar] = useState<import("@/lib/data").Militar | null>(null);
  const [justText, setJustText] = useState("");
  const [justSaving, setJustSaving] = useState(false);

  // ── Helpers ──
  const num = (v: string) => { if (!v) return null; const n = Number(v.replace(",", ".")); return isNaN(n) ? null : n; };

  // ── Menções automáticas para o entry (wizard) ──
  const entryMilitar = militares.find(m => m.id === entry.militar_id);
  const entryIdade = calcIdade(entryMilitar?.data_nascimento ?? null, session.data_aplicacao);
  const entryMencoesAuto = useMemo(() => ({
    FLEX: mencaoPorIdade("flexao", entryIdade, num(entry.flexao)),
    ABD: mencaoPorIdade("abdominal", entryIdade, num(entry.abdominal)),
    COR: mencaoPorIdade("corrida", entryIdade, num(entry.corrida_metros)),
    BAR: mencaoPorIdade("barra", entryIdade, num(entry.barra)),
  }), [entryIdade, entry.flexao, entry.abdominal, entry.corrida_metros, entry.barra]);
  const entryMencaoFinalAuto = useMemo(() => mencaoFinalDe([entryMencoesAuto.FLEX, entryMencoesAuto.ABD, entryMencoesAuto.COR, entryMencoesAuto.BAR]), [entryMencoesAuto]);

  // ── Menções automáticas para edição ──
  const editMilitar = militares.find(m => m.id === editForm.militar_id);
  const editIdade = calcIdade(editMilitar?.data_nascimento ?? null, editForm.data_aplicacao);
  const editMencoesAuto = useMemo(() => ({
    FLEX: mencaoPorIdade("flexao", editIdade, num(editForm.flexao ?? "")),
    ABD: mencaoPorIdade("abdominal", editIdade, num(editForm.abdominal ?? "")),
    COR: mencaoPorIdade("corrida", editIdade, num(editForm.corrida_metros ?? "")),
    BAR: mencaoPorIdade("barra", editIdade, num(editForm.barra ?? "")),
  }), [editIdade, editForm.flexao, editForm.abdominal, editForm.corrida_metros, editForm.barra]);
  const editMencaoFinalAuto = useMemo(() => mencaoFinalDe([editMencoesAuto.FLEX, editMencoesAuto.ABD, editMencoesAuto.COR, editMencoesAuto.BAR]), [editMencoesAuto]);

  // ── Abrir wizard ──
  function openSession() {
    setSession({ data_aplicacao: today(), taf_numero: 1, chamada: 1 });
    setEntry(emptyEntry());
    setEntrySearch("");
    setSavedCount(0);
    setStep(1);
    setSessionOpen(true);
  }

  // ── Abrir edição ──
  function openEdit(r: TafResultado) {
    setEditForm({
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
    setEditSearch("");
    setEditOpen(true);
  }

  // ── Salvar um militar no wizard ──
  async function salvarEntry(andClose = false) {
    if (!entry.militar_id) { toast.error("Selecione o militar."); return; }
    setSaving(true);
    try {
      const mencao = entry.mencao.trim() || (entryMencaoFinalAuto ?? null);
      const partes: string[] = [];
      (["FLEX", "ABD", "COR", "BAR"] as const).forEach(k => { if (entryMencoesAuto[k]) partes.push(`${k}:${entryMencoesAuto[k]}`); });
      const observacoes = [partes.join(" "), entry.observacoes.trim()].filter(Boolean).join(" ").trim() || null;

      await save.mutateAsync({
        militar_id: entry.militar_id,
        taf_numero: session.taf_numero,
        chamada: session.chamada,
        data_aplicacao: session.data_aplicacao,
        flexao: num(entry.flexao),
        abdominal: num(entry.abdominal),
        corrida_metros: num(entry.corrida_metros),
        barra: num(entry.barra),
        nota_flexao: null, nota_abdominal: null, nota_corrida: null, nota_barra: null, nota_final: null,
        mencao: mencao === "—" ? null : mencao,
        observacoes,
        avaliador_id: user?.id ?? null,
      });

      const nome = entryMilitar?.nome_guerra ?? entryMilitar?.nome ?? "Militar";
      toast.success(`${nome} registrado.`);
      setSavedCount(c => c + 1);

      if (andClose) { setSessionOpen(false); }
      else { setEntry(emptyEntry()); setEntrySearch(""); }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  // ── Salvar edição individual ──
  async function salvarEdit() {
    if (!editForm.militar_id) { toast.error("Selecione o militar."); return; }
    const mencao = editForm.mencao?.trim() || (editMencaoFinalAuto ?? null);
    const partes: string[] = [];
    (["FLEX", "ABD", "COR", "BAR"] as const).forEach(k => { if (editMencoesAuto[k]) partes.push(`${k}:${editMencoesAuto[k]}`); });
    const obsUser = (editForm.observacoes ?? "").replace(/(FLEX|ABD|COR|BAR)\s*:\s*[A-Za-zÀ-ÿ]+/gi, "").trim();
    const observacoes = [partes.join(" "), obsUser].filter(Boolean).join(" ").trim() || null;
    try {
      await save.mutateAsync({
        id: editForm.id,
        militar_id: editForm.militar_id,
        taf_numero: editForm.taf_numero,
        chamada: editForm.chamada,
        data_aplicacao: editForm.data_aplicacao,
        flexao: num(editForm.flexao ?? ""),
        abdominal: num(editForm.abdominal ?? ""),
        corrida_metros: num(editForm.corrida_metros ?? ""),
        barra: num(editForm.barra ?? ""),
        nota_flexao: null, nota_abdominal: null, nota_corrida: null, nota_barra: null, nota_final: null,
        mencao: mencao === "—" ? null : mencao,
        observacoes,
        avaliador_id: editForm.id ? undefined : (user?.id ?? null),
      });
      toast.success("Registro atualizado.");
      setEditOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar.");
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try { await del.mutateAsync(confirmDelete.id); toast.success("Registro removido."); setConfirmDelete(null); }
    catch (e: any) { toast.error(e?.message ?? "Erro ao remover."); }
  }

  // ── Mapas e filtros ──
  const militarById = useMemo(() => new Map(militares.map(m => [m.id, m])), [militares]);
  const resultadosPorPapel = useMemo(() => isAdmin ? resultados : resultados.filter(r => r.avaliador_id === user?.id || r.avaliador_id === null), [resultados, isAdmin, user?.id]);
  const filtrados = useMemo(() => resultadosPorPapel.filter(r => {
    if (fTaf !== "todos" && r.taf_numero !== Number(fTaf)) return false;
    if (fCh !== "todos" && r.chamada !== Number(fCh)) return false;
    if (fPosto !== "todos" && militarById.get(r.militar_id)?.posto !== fPosto) return false;
    return true;
  }), [resultadosPorPapel, fTaf, fCh, fPosto, militarById]);

  // ── Pendentes: militares sem resultado na edição selecionada ──
  const pendentes = useMemo(() => {
    const comResultado = new Set(
      resultados.filter(r => r.taf_numero === pTaf && r.chamada === pCh).map(r => r.militar_id)
    );
    return militares
      .filter(m => !comResultado.has(m.id))
      .filter(m => pPosto === "todos" || m.posto === pPosto);
  }, [militares, resultados, pTaf, pCh, pPosto]);

  // ── Salvar justificativa (cria resultado DISPENSADO) ──
  async function salvarJustificativa() {
    if (!justMilitar) return;
    if (!justText.trim()) { toast.error("Informe a justificativa."); return; }
    setJustSaving(true);
    try {
      await save.mutateAsync({
        militar_id: justMilitar.id,
        taf_numero: pTaf,
        chamada: pCh,
        data_aplicacao: new Date().toISOString().slice(0, 10),
        flexao: null, abdominal: null, corrida_metros: null, barra: null,
        nota_flexao: null, nota_abdominal: null, nota_corrida: null, nota_barra: null, nota_final: null,
        mencao: "DISPENSADO",
        observacoes: justText.trim(),
        avaliador_id: user?.id ?? null,
      });
      toast.success(`Justificativa registrada para ${justMilitar.nome_guerra ?? justMilitar.nome}.`);
      setJustOpen(false);
      setJustText("");
      setJustMilitar(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar justificativa.");
    } finally {
      setJustSaving(false);
    }
  }

  function exportarPlanilha() {
    const rows = filtrados.map(r => {
      const m = militarById.get(r.militar_id);
      const p = POSTOS.find(x => x.value === m?.posto);
      const mc = extractMencoes(r.observacoes, r.mencao);
      return { Militar: m?.nome ?? "", "Nome de guerra": m?.nome_guerra ?? "", Categoria: p?.label ?? "", TAF: r.taf_numero, Chamada: r.chamada, Data: r.data_aplicacao, "Corrida (m)": r.corrida_metros ?? "", "Menção COR": mc.COR, Flexão: r.flexao ?? "", "Menção FLEX": mc.FLEX, Abdominal: r.abdominal ?? "", "Menção ABD": mc.ABD, Barra: r.barra ?? "", "Menção BAR": mc.BAR, "Menção Final": mc.FIN, Observações: r.observacoes ?? "" };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TAF");
    XLSX.writeFile(wb, `TAF_CCAP_${today()}.xlsx`);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Registros</p>
          <h1 className="mt-1 text-2xl font-display tracking-wide text-primary sm:text-3xl">Resultados do TAF</h1>
          {!isAdmin && <p className="mt-1 text-xs text-muted-foreground">Exibindo apenas registros lançados por você.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* ── Botão Novo Registro → abre wizard ── */}
          <Button onClick={openSession} disabled={militares.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Novo registro
          </Button>

          {isAdmin && (
            <Button variant="outline" onClick={exportarPlanilha} disabled={filtrados.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Planilha
            </Button>
          )}
        </div>
      </div>

      {/* ── WIZARD: Registrar TAF ── */}
      <Dialog open={sessionOpen} onOpenChange={(o) => { if (!o) setSessionOpen(false); }}>
        {/* Mobile: tela cheia. Desktop: modal centralizado */}
        <DialogContent className="flex flex-col gap-0 p-0 inset-0 h-[100dvh] w-full rounded-none translate-x-0 translate-y-0 top-0 left-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-lg sm:rounded-lg">

          {/* Cabeçalho fixo */}
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-6">
            <div>
              <h2 className="font-display text-base font-semibold tracking-wide">Registrar TAF</h2>
              {step === 2 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="font-medium text-primary">{session.taf_numero}º TAF · {session.chamada}ª Chamada</span>
                  <span>·</span>
                  <span>{new Date(session.data_aplicacao + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                  {savedCount > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{savedCount} ✓</Badge>}
                  <button onClick={() => setStep(1)} className="ml-1 text-primary underline underline-offset-2">alterar</button>
                </div>
              )}
            </div>
            <button onClick={() => setSessionOpen(false)} className="rounded-sm p-1 opacity-70 hover:opacity-100 focus:outline-none">
              <span className="sr-only">Fechar</span>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Corpo rolável */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">

            {/* ── Etapa 1 ── */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Defina os dados do teste. Eles serão aplicados a todos os militares desta sessão.
                </p>
                <div className="space-y-2">
                  <Label>Data do teste</Label>
                  <Input type="date" value={session.data_aplicacao} onChange={e => setSession(s => ({ ...s, data_aplicacao: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>TAF</Label>
                    <Select value={String(session.taf_numero)} onValueChange={v => setSession(s => ({ ...s, taf_numero: Number(v) }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TAF_NUMEROS.map(n => <SelectItem key={n} value={String(n)}>{n}º TAF</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Chamada</Label>
                    <Select value={String(session.chamada)} onValueChange={v => setSession(s => ({ ...s, chamada: Number(v) }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CHAMADAS.map(c => <SelectItem key={c} value={String(c)}>{c}ª Chamada</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* ── Etapa 2 ── */}
            {step === 2 && (
              <div className="space-y-4">

                {/* Seleção de militar */}
                <div className="space-y-2">
                  <Label>Militar</Label>
                  {entry.militar_id ? (
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2.5 bg-primary/5">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{entryMilitar?.nome}</p>
                        {entryMilitar?.nome_guerra && <p className="text-xs text-muted-foreground">{entryMilitar.nome_guerra}</p>}
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => { setEntry(e => ({ ...e, militar_id: "" })); setEntrySearch(""); }}>Trocar</Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 opacity-50" />
                        <Input value={entrySearch} onChange={e => setEntrySearch(e.target.value)} placeholder="Digite o nome do militar..." className="pl-9 h-11 text-base" autoComplete="off" autoFocus />
                      </div>
                      {entrySearch.trim().length === 0 ? (
                        <p className="px-1 pt-1 text-xs text-muted-foreground">Digite para buscar na lista de militares.</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto rounded-md border bg-background shadow-sm">
                          {(() => {
                            const q = entrySearch.trim().toLowerCase();
                            const filtered = militares.filter(m => m.nome.toLowerCase().includes(q) || (m.nome_guerra ?? "").toLowerCase().includes(q));
                            if (!filtered.length) return (
                              <div className="space-y-2 p-3 text-center text-sm">
                                <p className="text-muted-foreground">Nenhum militar encontrado.</p>
                                <Button type="button" size="sm" variant="secondary" onClick={() => { setNovoMilitar({ nome: entrySearch.trim(), nome_guerra: "", posto: "soldado", data_nascimento: "" }); setAfterNew("entry"); setNovoMilitarOpen(true); }}>
                                  <UserPlus className="mr-2 h-4 w-4" />Cadastrar "{entrySearch.trim()}"
                                </Button>
                              </div>
                            );
                            return POSTOS.map(p => {
                              const list = filtered.filter(m => m.posto === p.value);
                              if (!list.length) return null;
                              return (
                                <div key={p.value}>
                                  <div className="sticky top-0 bg-muted/70 px-3 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">{p.plural}</div>
                                  {list.map(m => (
                                    <button key={m.id} type="button" onClick={() => { setEntry(e => ({ ...e, militar_id: m.id })); setEntrySearch(""); }} className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm active:bg-accent hover:bg-accent">
                                      <span className="flex-1 truncate">{m.nome}</span>
                                      {m.nome_guerra && <span className="text-xs text-muted-foreground shrink-0">{m.nome_guerra}</span>}
                                    </button>
                                  ))}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Exercícios — grade 2×2 compacta */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Exercícios</p>
                  <div className="grid grid-cols-2 gap-2">
                    <ExFieldCompact label="Flexão" unit="rep." value={entry.flexao} onChange={v => setEntry(e => ({ ...e, flexao: v }))} />
                    <ExFieldCompact label="Abdominal" unit="rep." value={entry.abdominal} onChange={v => setEntry(e => ({ ...e, abdominal: v }))} />
                    <ExFieldCompact label="Corrida" unit="m" value={entry.corrida_metros} onChange={v => setEntry(e => ({ ...e, corrida_metros: v }))} />
                    <ExFieldCompact label="Barra" unit="rep." value={entry.barra} onChange={v => setEntry(e => ({ ...e, barra: v }))} />
                  </div>
                </div>

                {/* Menções automáticas — linha compacta */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Auto{entryIdade != null ? ` (${entryIdade}a)` : ""}:</span>
                  {(["COR","FLEX","ABD","BAR"] as const).map(k => (
                    <span key={k} className="tabular-nums">{k} <b>{entryMencoesAuto[k] ?? "—"}</b></span>
                  ))}
                  <span className="ml-auto font-semibold text-primary">Final: {entryMencaoFinalAuto ?? "—"}</span>
                </div>

                {/* Menção manual */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Menção final <span className="text-xs font-normal text-muted-foreground">(opcional — usa automática se vazio)</span></Label>
                  <Input placeholder={entryMencaoFinalAuto ?? "—"} value={entry.mencao} onChange={e => setEntry(x => ({ ...x, mencao: e.target.value }))} className="h-10" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Observações</Label>
                  <Textarea rows={2} value={entry.observacoes} onChange={e => setEntry(x => ({ ...x, observacoes: e.target.value }))} className="resize-none text-sm" />
                </div>
              </div>
            )}
          </div>

          {/* Rodapé fixo */}
          <div className="shrink-0 border-t bg-background px-4 py-3 sm:px-6">
            {step === 1 ? (
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSessionOpen(false)}>Cancelar</Button>
                <Button onClick={() => { if (!session.data_aplicacao) { toast.error("Informe a data."); return; } setStep(2); }} className="flex-1 sm:flex-none">
                  Próximo <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" size="sm" onClick={() => setSessionOpen(false)} className="order-last sm:order-first">Encerrar sessão</Button>
                <Button variant="secondary" onClick={() => salvarEntry(false)} disabled={saving || !entry.militar_id} className="flex-1 sm:flex-none">
                  {saving ? "Salvando..." : "Registrar próximo"}
                </Button>
                <Button onClick={() => salvarEntry(true)} disabled={saving || !entry.militar_id} className="flex-1 sm:flex-none">
                  {saving ? "Salvando..." : "Registrar e concluir"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: edição individual ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="flex flex-col gap-0 p-0 inset-0 h-[100dvh] w-full rounded-none translate-x-0 translate-y-0 top-0 left-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-lg sm:rounded-lg">
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-6">
            <h2 className="font-display text-base font-semibold tracking-wide">Editar registro</h2>
            <button onClick={() => setEditOpen(false)} className="rounded-sm p-1 opacity-70 hover:opacity-100">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Militar</Label>
                {editMilitar ? (
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span className="flex-1 truncate text-sm">{editMilitar.nome}</span>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 opacity-70" />
                      <Input value={editSearch} onChange={e => setEditSearch(e.target.value)} placeholder="Buscar militar..." className="pl-9" autoComplete="off" />
                    </div>
                    <div className="max-h-44 overflow-y-auto rounded-md border">
                      {militares.filter(m => !editSearch || m.nome.toLowerCase().includes(editSearch.toLowerCase())).map(m => (
                        <button key={m.id} type="button" onClick={() => { setEditForm(f => ({ ...f, militar_id: m.id })); setEditSearch(""); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent">
                          <span className="flex-1 truncate">{m.nome}</span>
                          {m.nome_guerra && <span className="text-xs text-muted-foreground">{m.nome_guerra}</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label>Data de aplicação</Label>
                <Input type="date" value={editForm.data_aplicacao} onChange={e => setEditForm(f => ({ ...f, data_aplicacao: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>TAF</Label>
                <Select value={String(editForm.taf_numero)} onValueChange={v => setEditForm(f => ({ ...f, taf_numero: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TAF_NUMEROS.map(n => <SelectItem key={n} value={String(n)}>{n}º TAF</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chamada</Label>
                <Select value={String(editForm.chamada)} onValueChange={v => setEditForm(f => ({ ...f, chamada: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CHAMADAS.map(c => <SelectItem key={c} value={String(c)}>{c}ª Chamada</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Exercícios</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <ExField label="Flexão" unit="rep." exVal={editForm.flexao} onEx={v => setEditForm(f => ({ ...f, flexao: v }))} />
                <ExField label="Abdominal" unit="rep." exVal={editForm.abdominal} onEx={v => setEditForm(f => ({ ...f, abdominal: v }))} />
                <ExField label="Corrida" unit="m" exVal={editForm.corrida_metros} onEx={v => setEditForm(f => ({ ...f, corrida_metros: v }))} />
                <ExField label="Barra" unit="rep." exVal={editForm.barra} onEx={v => setEditForm(f => ({ ...f, barra: v }))} />
              </div>
            </div>
            <div className="rounded-md border border-dashed border-border bg-muted/20 p-2 text-xs">
              <p className="mb-1 uppercase tracking-widest text-muted-foreground">Menções automáticas por idade{editIdade != null ? ` — ${editIdade} anos` : ""}</p>
              <div className="flex flex-wrap gap-3">
                {(["COR", "FLEX", "ABD", "BAR"] as const).map(k => <span key={k}>{k}: <b>{editMencoesAuto[k] ?? "—"}</b></span>)}
                <span className="ml-auto font-medium">Final: <b>{editMencaoFinalAuto ?? "—"}</b></span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Menção final <span className="text-xs text-muted-foreground">(auto: {editMencaoFinalAuto ?? "—"})</span></Label>
              <Input placeholder={editMencaoFinalAuto ?? "—"} value={editForm.mencao ?? ""} onChange={e => setEditForm(f => ({ ...f, mencao: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={1} value={editForm.observacoes ?? ""} onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
          </div>
          </div>
          <div className="shrink-0 border-t bg-background px-4 py-3 sm:px-6">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={salvarEdit} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: cadastro rápido de militar ── */}
      <Dialog open={novoMilitarOpen} onOpenChange={setNovoMilitarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display tracking-wide">Cadastrar novo militar</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2"><Label>Nome completo</Label><Input value={novoMilitar.nome} onChange={e => setNovoMilitar(x => ({ ...x, nome: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Nome de guerra</Label><Input value={novoMilitar.nome_guerra} onChange={e => setNovoMilitar(x => ({ ...x, nome_guerra: e.target.value }))} placeholder="Ex.: SILVA" /></div>
            <div className="space-y-2">
              <Label>Posto / Graduação</Label>
              <Select value={novoMilitar.posto} onValueChange={v => setNovoMilitar(x => ({ ...x, posto: v as Posto }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{POSTOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Data de nascimento</Label><Input type="date" value={novoMilitar.data_nascimento} onChange={e => setNovoMilitar(x => ({ ...x, data_nascimento: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoMilitarOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!novoMilitar.nome.trim()) { toast.error("Informe o nome."); return; }
              try {
                const created: any = await saveMilitar.mutateAsync({ nome: novoMilitar.nome.trim(), nome_guerra: novoMilitar.nome_guerra.trim() || null, posto: novoMilitar.posto, data_nascimento: novoMilitar.data_nascimento || null });
                toast.success("Militar cadastrado.");
                setNovoMilitarOpen(false);
                await queryClient.refetchQueries({ queryKey: ["militares"] });
                if (created?.id) {
                  if (afterNew === "entry") { setEntry(e => ({ ...e, militar_id: created.id })); setEntrySearch(""); }
                  else { setEditForm(f => ({ ...f, militar_id: created.id })); setEditSearch(""); }
                }
              } catch (e: any) { toast.error(e?.message ?? "Erro ao cadastrar."); }
            }} disabled={saveMilitar.isPending}>{saveMilitar.isPending ? "Salvando..." : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: justificativa ── */}
      <Dialog open={justOpen} onOpenChange={o => { if (!o) { setJustOpen(false); setJustText(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wide">Justificativa de Dispensa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {justMilitar && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span className="font-medium">{justMilitar.nome}</span>
                {justMilitar.nome_guerra && <span className="ml-2 text-muted-foreground">({justMilitar.nome_guerra})</span>}
                <div className="mt-0.5 text-xs text-muted-foreground">{pTaf}º TAF · {pCh}ª Chamada</div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Motivo da dispensa</Label>
              <Textarea
                rows={3}
                placeholder="Ex.: Afastado por motivo de saúde, licença, missão externa..."
                value={justText}
                onChange={e => setJustText(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setJustOpen(false); setJustText(""); }}>Cancelar</Button>
            <Button onClick={salvarJustificativa} disabled={justSaving || !justText.trim()}>
              {justSaving ? "Salvando..." : "Registrar dispensa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {militares.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Cadastre militares para começar a registrar TAFs.</CardContent></Card>
      )}

      {/* ── Abas: Resultados | Pendentes ── */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "resultados" | "pendentes")}>
        <TabsList>
          <TabsTrigger value="resultados" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Resultados
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="gap-2">
            <FileX className="h-4 w-4" />
            Pendentes
            {pendentes.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{pendentes.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Aba Resultados ── */}
        <TabsContent value="resultados" className="mt-4 space-y-4">
          {/* Filtros */}
          <Card>
            <CardContent className="flex flex-wrap gap-2 p-3">
              <Select value={fTaf} onValueChange={setFTaf}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todos">Todos TAFs</SelectItem>{TAF_NUMEROS.map(n => <SelectItem key={n} value={String(n)}>{n}º TAF</SelectItem>)}</SelectContent>
              </Select>
              <Select value={fCh} onValueChange={setFCh}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todos">Todas chamadas</SelectItem>{CHAMADAS.map(c => <SelectItem key={c} value={String(c)}>{c}ª Chamada</SelectItem>)}</SelectContent>
              </Select>
              <Select value={fPosto} onValueChange={setFPosto}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todos">Todas categorias</SelectItem>{POSTOS.map(p => <SelectItem key={p.value} value={p.value}>{p.plural}</SelectItem>)}</SelectContent>
              </Select>
              <div className="ml-auto flex items-center"><Badge variant="outline">{filtrados.length} registro(s)</Badge></div>
            </CardContent>
          </Card>

      {/* ── MOBILE: cards ── */}
      <div className="md:hidden space-y-3">
        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && filtrados.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum registro encontrado.</CardContent></Card>}
        {filtrados.map(r => {
          const m = militarById.get(r.militar_id);
          const mc = extractMencoes(r.observacoes, r.mencao);
          const keys = ["COR", "FLEX", "ABD", "BAR", "FIN"] as const;
          const rawValues: Record<string, number | null> = { COR: r.corrida_metros, FLEX: r.flexao, ABD: r.abdominal, BAR: r.barra, FIN: null };
          const suffixes: Record<string, string> = { COR: "m", FLEX: "", ABD: "", BAR: "", FIN: "" };
          return (
            <Card key={r.id} className="border-border/70">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m?.nome ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{m?.nome_guerra ? `${m.nome_guerra} · ` : ""}{r.taf_numero}º TAF · {r.chamada}ª Chamada · {new Date(r.data_aplicacao).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setConfirmDelete(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1 text-center">
                  {keys.map(k => (
                    <div key={k} className="space-y-0.5">
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{k}</div>
                      <span className={`inline-block w-full rounded border px-0.5 py-0.5 text-[11px] font-medium ${mencaoColor(mc[k])}`}>{mc[k]}</span>
                      <div className="text-[9px] tabular-nums text-muted-foreground">{rawValues[k] != null ? `${rawValues[k]}${suffixes[k]}` : "—"}</div>
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
        <CardHeader className="pb-2"><CardTitle className="font-display text-lg tracking-wide text-primary">Histórico</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="px-3 py-2">Militar</th><th className="px-3 py-2">NG</th>
                <th className="px-2 py-2 text-center">TAF</th><th className="px-2 py-2 text-center">Ch.</th>
                <th className="px-2 py-2 text-center">COR</th><th className="px-2 py-2 text-center">FLEX</th>
                <th className="px-2 py-2 text-center">ABD</th><th className="px-2 py-2 text-center">BAR</th>
                <th className="px-2 py-2 text-center">FIN</th><th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && filtrados.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">Nenhum registro encontrado.</td></tr>}
              {filtrados.map(r => {
                const m = militarById.get(r.militar_id);
                const mc = extractMencoes(r.observacoes, r.mencao);
                const cell = (v: string, raw?: number | null, suffix = "") => (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`inline-block min-w-[2.25rem] rounded border px-1.5 py-0.5 text-xs font-medium ${mencaoColor(v)}`}>{v}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{raw == null ? "—" : `${raw}${suffix}`}</span>
                  </div>
                );
                return (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">{m?.nome ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{m?.nome_guerra ?? "—"}</td>
                    <td className="px-2 py-2 text-center">{r.taf_numero}º</td>
                    <td className="px-2 py-2 text-center">{r.chamada}ª</td>
                    <td className="px-2 py-2 text-center">{cell(mc.COR, r.corrida_metros, "m")}</td>
                    <td className="px-2 py-2 text-center">{cell(mc.FLEX, r.flexao)}</td>
                    <td className="px-2 py-2 text-center">{cell(mc.ABD, r.abdominal)}</td>
                    <td className="px-2 py-2 text-center">{cell(mc.BAR, r.barra)}</td>
                    <td className="px-2 py-2 text-center"><span className={`inline-block min-w-[2.25rem] rounded border px-1.5 py-0.5 text-xs font-medium ${mencaoColor(mc.FIN)}`}>{mc.FIN}</span></td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

        </TabsContent>

        {/* ── Aba Pendentes ── */}
        <TabsContent value="pendentes" className="mt-4 space-y-4">
          {/* Filtros da aba pendentes */}
          <Card>
            <CardContent className="flex flex-wrap gap-2 p-3">
              <Select value={String(pTaf)} onValueChange={v => setPTaf(Number(v))}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>{TAF_NUMEROS.map(n => <SelectItem key={n} value={String(n)}>{n}º TAF</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(pCh)} onValueChange={v => setPCh(Number(v))}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>{CHAMADAS.map(c => <SelectItem key={c} value={String(c)}>{c}ª Chamada</SelectItem>)}</SelectContent>
              </Select>
              <Select value={pPosto} onValueChange={setPPosto}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todos">Todas categorias</SelectItem>{POSTOS.map(p => <SelectItem key={p.value} value={p.value}>{p.plural}</SelectItem>)}</SelectContent>
              </Select>
              <div className="ml-auto flex items-center">
                <Badge variant={pendentes.length > 0 ? "destructive" : "outline"}>{pendentes.length} pendente(s)</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Lista pendentes — mobile */}
          <div className="md:hidden space-y-3">
            {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>}
            {!isLoading && pendentes.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
                Todos os militares realizaram ou foram dispensados do {pTaf}º TAF · {pCh}ª Chamada.
              </CardContent></Card>
            )}
            {pendentes.map(m => (
              <Card key={m.id} className="border-border/70">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{m.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.nome_guerra ?? "—"} · {POSTOS.find(p => p.value === m.posto)?.label ?? m.posto}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setJustMilitar(m); setJustText(""); setJustOpen(true); }}
                  >
                    <FileX className="mr-1.5 h-3.5 w-3.5" />
                    Justificar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Lista pendentes — desktop */}
          <Card className="hidden md:block">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg tracking-wide text-primary">
                Militares sem registro — {pTaf}º TAF · {pCh}ª Chamada
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                    <th className="px-3 py-2">Militar</th>
                    <th className="px-3 py-2">Nome de guerra</th>
                    <th className="px-3 py-2">Categoria</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Carregando...</td></tr>}
                  {!isLoading && pendentes.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Todos os militares realizaram ou foram dispensados do {pTaf}º TAF · {pCh}ª Chamada.
                    </td></tr>
                  )}
                  {pendentes.map(m => (
                    <tr key={m.id} className="border-b border-border/50 hover:bg-muted/40">
                      <td className="px-3 py-2 font-medium">{m.nome}</td>
                      <td className="px-3 py-2 text-muted-foreground">{m.nome_guerra ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{POSTOS.find(p => p.value === m.posto)?.label ?? m.posto}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setJustMilitar(m); setJustText(""); setJustOpen(true); }}
                        >
                          <FileX className="mr-1.5 h-3.5 w-3.5" />
                          Justificar dispensa
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover registro?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Auxiliar de campo de exercício ───────────────────────────────────────────

type Militar = import("@/lib/data").Militar;

function ExField({ label, exVal, onEx, unit }: { label: string; exVal?: string; onEx: (v: string) => void; unit: string }) {
  return (
    <div className="space-y-1.5 rounded border border-border/70 bg-background p-2">
      <div className="text-xs font-medium text-primary">{label}</div>
      <div>
        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{unit}</Label>
        <Input className="h-9" inputMode="numeric" value={exVal ?? ""} onChange={e => onEx(e.target.value)} />
      </div>
    </div>
  );
}

/** Versão compacta usada no wizard mobile */
function ExFieldCompact({ label, unit, value, onChange }: { label: string; unit: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded border border-border/70 bg-background px-3 py-2">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-primary">{label}</span>
        <span className="text-[10px] text-muted-foreground">{unit}</span>
      </div>
      <Input className="h-10 text-base" inputMode="numeric" value={value ?? ""} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
