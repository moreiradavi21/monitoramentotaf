import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef, useCallback } from "react";
import { Pencil, Trash2, UserPlus, Search, FileSpreadsheet, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

import { POSTOS, PELOTOES, pelotaoLabel, postoLabel, type Posto } from "@/lib/taf";
import {
  useDeleteMilitar,
  useMilitares,
  useSaveMilitar,
  type Militar,
} from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

import { RequireAdmin } from "@/components/require-admin";

// ── Importação inline ─────────────────────────────────────────────────────

const SHEET_MAP: Record<string, string> = {
  "saude": "saude", "saúde": "saude", "pel saude": "saude", "pel saúde": "saude",
  "pel com": "comunicacoes", "comunicacoes": "comunicacoes", "comunicações": "comunicacoes",
  "morteiro": "morteiro", "pel morteiro": "morteiro",
  "anticarro": "anticarro", "pel anticarro": "anticarro",
  "aprov": "aprove", "aprove": "aprove",
  "enc mat": "enc_mat", "enc. mat": "enc_mat",
  "seç cmd": "sec_cmd", "sec cmd": "sec_cmd", "seção cmd": "sec_cmd",
  "seç cmd su": "sec_cmd_su", "sec cmd su": "sec_cmd_su", "seção cmd su": "sec_cmd_su",
  "sessão comando subunidade": "sec_cmd_su", "cmd su": "sec_cmd_su",
  "pmt": "pmt", "pel transporte": "pmt", "pelotão de transporte": "pmt",
  "pel de transporte": "pmt", "transporte": "pmt",
};

type PostoVal = "oficial" | "sargento" | "cabo" | "soldado" | "recruta";
type LinhaImport = { nome: string; nome_guerra: string | null; posto: PostoVal; data_nascimento: string | null; pelotao: string };
type GrupoImport = { pelotao: string; sheetName: string; count: number; linhas: LinhaImport[] };

function normKey(s: string) {
  return s.toLowerCase().trim().replace(/[áàãâä]/g,"a").replace(/[éèêë]/g,"e").replace(/[íìîï]/g,"i").replace(/[óòõôö]/g,"o").replace(/[úùûü]/g,"u").replace(/ç/g,"c");
}
function getCol(map: Record<string,any>, ...keys: string[]): string {
  for (const k of keys) { const v = map[k]; if (v != null && String(v).trim()) return String(v).trim(); }
  return "";
}
function parsePosto(raw: string): PostoVal {
  const s = raw.toUpperCase().trim().replace(/[°ºª.]/g,"").replace(/\s+/g," ");
  if (/CAP|TEN|OFIC|BGD|CEL|COR|MAJ|GEN/.test(s)) return "oficial";
  if (/SGT|SARG|SUBTEN|^ST /.test(s)) return "sargento";
  if (/^CB |^CABO/.test(s)) return "cabo";
  if (/RCT|RECR|EV$/.test(s)) return "recruta";
  return "soldado";
}
function parseDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0,10);
  if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v); if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`; }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (br) { let [,d,m,y]=br; if(y.length===2)y=(Number(y)>30?"19":"20")+y; return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`; }
  return null;
}

function parseXlsx(file: File): Promise<GrupoImport[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array", cellDates: true });
        const grupos: GrupoImport[] = [];
        for (const sheetName of wb.SheetNames) {
          const pelotao = SHEET_MAP[sheetName.toLowerCase().trim()];
          if (!pelotao) continue;
          const ws = wb.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "", raw: false });
          const jsonRaw = XLSX.utils.sheet_to_json<any>(ws, { defval: "", raw: true });
          const linhas: LinhaImport[] = [];
          json.forEach((r: any, i: number) => {
            const map: Record<string,any> = {}; for (const k of Object.keys(r)) map[normKey(k)] = r[k];
            const mapR: Record<string,any> = {}; const rr = jsonRaw[i]??{}; for (const k of Object.keys(rr)) mapR[normKey(k)] = rr[k];
            const nome = getCol(map,"nome completo","nome","militar");
            if (!nome || nome.length < 3) return;
            const dnKey = Object.keys(mapR).find(k=>k.includes("nasc")||k.includes("data"));
            linhas.push({ nome: nome.toUpperCase(), nome_guerra: getCol(map,"nome de guerra","guerra","ng")||null, posto: parsePosto(getCol(map,"posto","graduacao")||"SD"), data_nascimento: parseDate(dnKey?mapR[dnKey]:null), pelotao });
          });
          if (linhas.length) grupos.push({ pelotao, sheetName, count: linhas.length, linhas });
        }
        resolve(grupos);
      } catch (e: any) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function ImportDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [grupos, setGrupos] = useState<GrupoImport[]>([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{criados:number;atualizados:number}|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!/\.(xlsx|xls|ods)$/i.test(file.name)) { toast.error("Selecione .xlsx, .xls ou .ods."); return; }
    setParsing(true); setGrupos([]); setResult(null); setFileName(file.name);
    try {
      const g = await parseXlsx(file);
      if (!g.length) { toast.error("Nenhuma aba reconhecida. Use: Pel Com, Morteiro, Anticarro, Saúde, APROV, Enc Mat, Seç Cmd, Seç Cmd Su."); return; }
      setGrupos(g);
      const total = g.reduce((s,x)=>s+x.count,0);
      toast.success(`${total} militares em ${g.length} pelotão(ões) detectados.`);
    } catch(e:any) { toast.error("Erro ao ler: "+(e?.message??"")); }
    finally { setParsing(false); }
  }

  async function salvar() {
    const all = grupos.flatMap(g=>g.linhas);
    if (!all.length) return;
    setSaving(true);
    try {
      // Pelotões presentes na planilha (só esses são sincronizados)
      const pelotoesImportados = [...new Set(grupos.map(g=>g.pelotao))];
      // Busca TODOS para evitar violação de unique constraint em nome
      const { data: todos, error: e0 } = await supabase.from("militares").select("id,nome,pelotao");
      if (e0) throw e0;
      const byNome = new Map((todos??[]).map(m=>[m.nome.toUpperCase().trim(), m.id]));
      const exNoPelotao = (todos??[]).filter(m=>m.pelotao ? pelotoesImportados.includes(m.pelotao) : false);
      const nomesNaPlanilha = new Set(all.map(l=>l.nome.toUpperCase().trim()));
      const inserts: any[]=[], updates: {id:string;payload:any}[]=[];
      for (const l of all) {
        const payload = { nome:l.nome, nome_guerra:l.nome_guerra, posto:l.posto, data_nascimento:l.data_nascimento, pelotao:l.pelotao };
        const id = byNome.get(l.nome.toUpperCase().trim());
        if (id) updates.push({id, payload}); else inserts.push(payload);
      }
      const idsRemover = exNoPelotao.filter(m=>!nomesNaPlanilha.has(m.nome.toUpperCase().trim())).map(m=>m.id);
      if (inserts.length) { const {error}=await supabase.from("militares").insert(inserts); if(error) throw error; }
      for (const u of updates) { const {error}=await supabase.from("militares").update(u.payload).eq("id",u.id); if(error) throw error; }
      if (idsRemover.length) { const {error}=await supabase.from("militares").delete().in("id",idsRemover); if(error) throw error; }
      setResult({criados:inserts.length, atualizados:updates.length});
      qc.invalidateQueries({queryKey:["militares"]});
      toast.success(`${inserts.length} criados, ${updates.length} atualizados, ${idsRemover.length} removidos.`);
    } catch(e:any) { toast.error("Erro: "+(e?.message??"")); }
    finally { setSaving(false); }
  }

  function resetDialog() { setGrupos([]); setFileName(""); setResult(null); }

  const total = grupos.reduce((s,g)=>s+g.count,0);

  return (
    <Dialog open={open} onOpenChange={(o)=>{ setOpen(o); if(!o) resetDialog(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Importar planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide">Importar planilha de efetivo</DialogTitle>
        </DialogHeader>

        {/* Upload */}
        {!grupos.length && !parsing && (
          <div
            className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border py-10 transition-colors hover:border-primary/50 hover:bg-muted/20"
            onClick={()=>fileRef.current?.click()}
          >
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Clique para selecionar a planilha</p>
              <p className="text-xs text-muted-foreground">.xlsx, .xls ou .ods · Uma aba por pelotão</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.ods" className="hidden"
              onChange={(e)=>{ const f=e.target.files?.[0]; if(f) handleFile(f); e.target.value=""; }} />
          </div>
        )}

        {parsing && (
          <div className="flex items-center justify-center gap-3 py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Lendo planilha…</span>
          </div>
        )}

        {/* Preview grupos */}
        {grupos.length > 0 && !result && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{fileName}</span> · {total} militares em {grupos.length} pelotão(ões)
            </p>
            <div className="divide-y divide-border rounded-md border">
              {grupos.map((g) => (
                <div key={g.pelotao} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-medium">{pelotaoLabel(g.pelotao)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">aba: {g.sheetName}</span>
                    <Badge variant="secondary">{g.count}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="font-medium">Importação concluída</p>
              <p className="text-sm text-muted-foreground">
                {result.criados} criados · {result.atualizados} atualizados
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {grupos.length > 0 && !result && (
            <>
              <Button variant="outline" onClick={resetDialog} disabled={saving}>Trocar arquivo</Button>
              <Button onClick={salvar} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Salvando…</> : <><Upload className="mr-2 h-4 w-4"/>Importar {total} militares</>}
              </Button>
            </>
          )}
          {result && <Button onClick={()=>setOpen(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const Route = createFileRoute("/militares")({
  component: () => (
    <RequireAdmin>
      <MilitaresPage />
    </RequireAdmin>
  ),
});

function MilitaresPage() {
  const { data: militares = [], isLoading } = useMilitares();
  const save = useSaveMilitar();
  const del = useDeleteMilitar();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Militar | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Militar | null>(null);
  const [filter, setFilter] = useState<Posto | "todos">("todos");
  const [q, setQ] = useState("");

  const [nome, setNome] = useState("");
  const [nomeGuerra, setNomeGuerra] = useState("");
  const [posto, setPosto] = useState<Posto>("soldado");
  const [pelotao, setPelotao] = useState<string>("");
  const [ident, setIdent] = useState("");
  const [dataNasc, setDataNasc] = useState("");

  function openNew() {
    setEditing(null);
    setNome("");
    setNomeGuerra("");
    setPosto("soldado");
    setPelotao("");
    setIdent("");
    setDataNasc("");
    setOpen(true);
  }

  function openEdit(m: Militar) {
    setEditing(m);
    setNome(m.nome);
    setNomeGuerra(m.nome_guerra ?? "");
    setPosto(m.posto);
    setPelotao(m.pelotao ?? "");
    setIdent(m.identificacao ?? "");
    setDataNasc(m.data_nascimento ?? "");
    setOpen(true);
  }

  async function handleSave() {
    if (!nome.trim()) {
      toast.error("Informe o nome completo do militar.");
      return;
    }
    try {
      await save.mutateAsync({
        id: editing?.id,
        nome: nome.trim(),
        nome_guerra: nomeGuerra.trim() || null,
        posto,
        pelotao: pelotao || null,
        identificacao: ident.trim() || null,
        data_nascimento: dataNasc || null,
      });
      toast.success(editing ? "Militar atualizado." : "Militar cadastrado.");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar.");
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      toast.success("Militar removido.");
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover.");
    }
  }

  const filtered = useMemo(() => {
    return militares.filter((m) => {
      if (filter !== "todos" && m.posto !== filter) return false;
      if (q && !m.nome.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [militares, filter, q]);

  const grouped = useMemo(() => {
    return POSTOS.map((p) => ({
      posto: p,
      list: filtered.filter((m) => m.posto === p.value),
    }));
  }, [filtered]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Efetivo
          </p>
          <h1 className="mt-1 text-3xl font-display tracking-wide text-primary">
            Militares
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro do efetivo da Companhia CCAP separado por categoria.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportDialog />
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <UserPlus className="mr-2 h-4 w-4" />
              Novo militar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display tracking-wide">
                {editing ? "Editar militar" : "Novo militar"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nome de guerra</Label>
                  <Input
                    value={nomeGuerra}
                    onChange={(e) => setNomeGuerra(e.target.value)}
                    placeholder="Ex.: SILVA"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Posto / Graduação</Label>
                  <Select value={posto} onValueChange={(v) => setPosto(v as Posto)}>
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
                  <Label>Pelotão / Seção</Label>
                  <Select
                    value={pelotao || "__none__"}
                    onValueChange={(v) => setPelotao(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Sem pelotão —</SelectItem>
                      {PELOTOES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Identificação (opcional)</Label>
                  <Input
                    placeholder="Ex.: nº interno"
                    value={ident}
                    onChange={(e) => setIdent(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de nascimento</Label>
                  <Input
                    type="date"
                    value={dataNasc}
                    onChange={(e) => setDataNasc(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A data de nascimento é usada para calcular automaticamente a menção do TAF por faixa etária.
              </p>
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
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar militar pelo nome..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {POSTOS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.plural}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando efetivo...</p>
      )}

      {!isLoading && militares.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum militar cadastrado. Clique em <b>Novo militar</b> para começar.
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {grouped.map(({ posto: p, list }) =>
          list.length === 0 ? null : (
            <Card key={p.value}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-lg tracking-wide text-primary">
                    {p.plural}
                  </CardTitle>
                  <Badge variant="outline">{list.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {list.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <div className="font-medium">{m.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {m.nome_guerra ? `NG: ${m.nome_guerra}` : ""}
                          {m.nome_guerra && m.pelotao ? " · " : ""}
                          {m.pelotao
                            ? PELOTOES.find((x) => x.value === m.pelotao)?.label ?? m.pelotao
                            : (!m.nome_guerra && (m.identificacao ?? "—"))}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(m)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setConfirmDelete(m)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ),
        )}
      </div>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover militar?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete &&
                `${postoLabel(confirmDelete.posto)} ${confirmDelete.nome} será removido, junto com todos os TAFs vinculados. Esta ação não pode ser desfeita.`}
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
