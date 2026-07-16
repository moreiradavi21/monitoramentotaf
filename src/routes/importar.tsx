import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Users,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { PELOTOES, pelotaoLabel } from "@/lib/taf";
import { RequireAdmin } from "@/components/require-admin";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// ── Mapeamento aba → pelotão ──────────────────────────────────────────────

const SHEET_MAP: Record<string, string> = {
  "saude": "saude",
  "saúde": "saude",
  "pel saude": "saude",
  "pel saúde": "saude",
  "pel com": "comunicacoes",
  "comunicacoes": "comunicacoes",
  "comunicações": "comunicacoes",
  "pel comunicacoes": "comunicacoes",
  "pel comunicações": "comunicacoes",
  "morteiro": "morteiro",
  "pel morteiro": "morteiro",
  "anticarro": "anticarro",
  "pel anticarro": "anticarro",
  "aprov": "aprove",
  "aprove": "aprove",
  "enc mat": "enc_mat",
  "enc. mat": "enc_mat",
  "encarregado de material": "enc_mat",
  "seç cmd": "sec_cmd",
  "sec cmd": "sec_cmd",
  "seção cmd": "sec_cmd",
  "seç cmd su": "sec_cmd_su",
  "sec cmd su": "sec_cmd_su",
  "seção cmd su": "sec_cmd_su",
  "sessão comando subunidade": "sec_cmd_su",
  "cmd su": "sec_cmd_su",
  "pmt": "pmt",
  "pel transporte": "pmt",
  "pelotão de transporte": "pmt",
  "pel de transporte": "pmt",
  "transporte": "pmt",
};

function resolvePelotao(sheetName: string): string | null {
  return SHEET_MAP[sheetName.toLowerCase().trim()] ?? null;
}

// ── Normalização de posto ─────────────────────────────────────────────────

type Posto = "oficial" | "sargento" | "cabo" | "soldado" | "recruta";

function normalizePosto(raw: string): Posto {
  const s = raw.toUpperCase().trim().replace(/[°ºª.]/g, "").replace(/\s+/g, " ");
  if (/CAP|TEN|ASP|OFIC|BGD|CEL|COR|MAJ|GEN/.test(s)) return "oficial";
  if (/SGT|SARG|SUBTEN|^ST /.test(s)) return "sargento";
  if (/^CB |^CABO/.test(s)) return "cabo";
  if (/RCT|RECR|EV$|SD EV/.test(s)) return "recruta";
  return "soldado";
}

// ── Normalização de chave de coluna ──────────────────────────────────────

function normKey(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[áàäâã]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöôõ]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ç/g, "c");
}

function getCol(map: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    const v = map[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function parseData(v: any): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (br) {
    let [, d, m, y] = br;
    if (y.length === 2) y = (Number(y) > 30 ? "19" : "20") + y;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return null;
}

// ── Tipos ─────────────────────────────────────────────────────────────────

type LinhaImport = {
  nome: string;
  nome_guerra: string | null;
  posto: Posto;
  data_nascimento: string | null;
  pelotao: string;
};

type Grupo = {
  pelotao: string;
  sheetName: string;
  linhas: LinhaImport[];
};

// ── Rota ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/importar")({
  component: () => (
    <RequireAdmin>
      <ImportarPage />
    </RequireAdmin>
  ),
});

// ── Componente ────────────────────────────────────────────────────────────

function ImportarPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ criados: number; atualizados: number } | null>(null);

  const parseFile = useCallback((file: File) => {
    setFileName(file.name);
    setGrupos([]);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array", cellDates: true });
        const parsed: Grupo[] = [];

        for (const sheetName of wb.SheetNames) {
          const pelotao = resolvePelotao(sheetName);
          if (!pelotao) continue;

          const ws = wb.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "", raw: false });
          const jsonRaw = XLSX.utils.sheet_to_json<any>(ws, { defval: "", raw: true });

          const linhas: LinhaImport[] = [];
          json.forEach((r: any, idx: number) => {
            const map: Record<string, any> = {};
            for (const k of Object.keys(r)) map[normKey(k)] = r[k];

            const mapRaw: Record<string, any> = {};
            const rawRow = jsonRaw[idx] ?? {};
            for (const k of Object.keys(rawRow)) mapRaw[normKey(k)] = rawRow[k];

            const nome = getCol(map, "nome completo", "nome", "militar", "nome do militar");
            if (!nome || nome.length < 3) return;

            const nome_guerra = getCol(map, "nome de guerra", "nome guerra", "ng") || null;
            const postoRaw = getCol(map, "posto", "graduacao", "posto/graduacao", "posto de graduacao");
            const posto = normalizePosto(postoRaw || "SD");

            const dnKey = Object.keys(mapRaw).find(
              (k) => k.includes("nasc") || k.includes("data"),
            );
            const dn = dnKey ? mapRaw[dnKey] : null;

            linhas.push({
              nome: nome.toUpperCase(),
              nome_guerra: nome_guerra ? nome_guerra.toUpperCase() : null,
              posto,
              data_nascimento: parseData(dn),
              pelotao,
            });
          });

          if (linhas.length > 0) {
            parsed.push({ pelotao, sheetName, linhas });
          }
        }

        if (!parsed.length) {
          toast.error(
            "Nenhuma aba reconhecida. Verifique os nomes: Pel Com, Morteiro, Anticarro, Saúde, APROV, Enc Mat, Seç Cmd, Seç Cmd Su.",
          );
          return;
        }

        const total = parsed.reduce((s, g) => s + g.linhas.length, 0);
        setGrupos(parsed);
        const exp: Record<string, boolean> = {};
        parsed.forEach((g) => { exp[g.pelotao] = true; });
        setExpanded(exp);
        toast.success(`${total} militares em ${parsed.length} pelotão(ões) detectados.`);
      } catch (e: any) {
        toast.error("Não foi possível ler a planilha: " + (e?.message ?? ""));
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  function handleFile(file: File) {
    if (!/\.(xlsx|xls|ods)$/i.test(file.name)) {
      toast.error("Selecione um arquivo .xlsx, .xls ou .ods.");
      return;
    }
    parseFile(file);
  }

  async function salvar() {
    const todasLinhas = grupos.flatMap((g) => g.linhas);
    if (!todasLinhas.length) return;
    setSaving(true);
    try {
      // Pelotões presentes na planilha (só esses serão sincronizados)
      const pelotoesImportados = [...new Set(grupos.map((g) => g.pelotao))];

      // Busca TODOS os militares para evitar violação de unique constraint em nome
      const { data: todos, error: e0 } = await supabase
        .from("militares")
        .select("id,nome,pelotao");
      if (e0) throw e0;

      // Normalização compatível com o índice único do banco: lower(nome) + espaços colapsados
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

      // byNome: mapa global nome normalizado → id
      const byNome = new Map<string, string>();
      for (const m of todos ?? []) byNome.set(norm(m.nome), m.id);

      // existentesNoPelotao: apenas dos pelotões importados (para a lógica de remoção)
      const existentesNoPelotao = (todos ?? []).filter((m) =>
        m.pelotao ? pelotoesImportados.includes(m.pelotao) : false
      );

      const linhasUnicas = new Map<string, LinhaImport>();
      for (const l of todasLinhas) linhasUnicas.set(norm(l.nome), l);

      const nomesNaPlanilha = new Set(linhasUnicas.keys());
      const inserts: any[] = [];
      const updates: { id: string; payload: any }[] = [];

      for (const l of linhasUnicas.values()) {
        const payload = {
          nome: l.nome,
          nome_guerra: l.nome_guerra,
          posto: l.posto,
          data_nascimento: l.data_nascimento,
          pelotao: l.pelotao,
        };
        const id = byNome.get(norm(l.nome));
        if (id) updates.push({ id, payload });
        else inserts.push(payload);
      }

      // Remove militares dos pelotões importados que não estão na planilha
      const idsParaRemover = existentesNoPelotao
        .filter((m) => !nomesNaPlanilha.has(norm(m.nome)))
        .map((m) => m.id);

      if (inserts.length) {
        const { error } = await supabase.from("militares").insert(inserts);
        if (error) throw error;
      }
      for (const u of updates) {
        const { error } = await supabase
          .from("militares")
          .update(u.payload)
          .eq("id", u.id);
        if (error) throw error;
      }
      if (idsParaRemover.length) {
        const { error } = await supabase
          .from("militares")
          .delete()
          .in("id", idsParaRemover);
        if (error) throw error;
      }

      const duplicadosIgnorados = todasLinhas.length - linhasUnicas.size;
      setResult({ criados: inserts.length, atualizados: updates.length });
      qc.invalidateQueries({ queryKey: ["militares"] });
      toast.success(
        `Concluído — ${inserts.length} criados, ${updates.length} atualizados, ${idsParaRemover.length} removidos${duplicadosIgnorados ? `, ${duplicadosIgnorados} duplicados ignorados` : ""}.`
      );
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  }

  const totalLinhas = grupos.reduce((s, g) => s + g.linhas.length, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Cabeçalho */}
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Ferramentas</p>
        <h1 className="mt-1 text-3xl font-display tracking-wide text-primary">Importar Planilha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie a planilha geral com uma aba por pelotão. Cada aba é identificada automaticamente
          e os militares são associados ao pelotão correto.
        </p>
      </div>

      {/* Zona de upload */}
      {!grupos.length && (
        <Card>
          <CardContent className="p-0">
            <div
              className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-base font-medium">Arraste a planilha aqui ou clique para selecionar</p>
                <p className="mt-1 text-sm text-muted-foreground">Formatos aceitos: .xlsx, .xls, .ods</p>
              </div>
              <Button variant="outline" type="button">
                <Upload className="mr-2 h-4 w-4" />
                Selecionar arquivo
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.ods"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview com grupos por pelotão */}
      {grupos.length > 0 && (
        <div className="space-y-4">
          {/* Barra de ação */}
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{fileName}</span>
                <span className="text-sm text-muted-foreground">
                  — {grupos.length} pelotão(ões), {totalLinhas} militares
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setGrupos([]); setFileName(""); setResult(null); }}
                  disabled={saving}
                >
                  Trocar arquivo
                </Button>
                <Button onClick={salvar} disabled={saving || !!result}>
                  {saving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando…</>
                  ) : result ? (
                    <><CheckCircle2 className="mr-2 h-4 w-4" />Importado</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" />Importar {totalLinhas} militares</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Resultado */}
          {result && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="flex flex-wrap gap-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-display font-bold text-green-600">{result.criados}</span>
                  <span className="text-sm text-muted-foreground">criados</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-display font-bold text-blue-600">{result.atualizados}</span>
                  <span className="text-sm text-muted-foreground">atualizados</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card por pelotão */}
          {grupos.map((grupo) => {
            const open = expanded[grupo.pelotao] ?? true;
            return (
              <Card key={grupo.pelotao}>
                <CardHeader
                  className="cursor-pointer select-none"
                  onClick={() =>
                    setExpanded((p) => ({ ...p, [grupo.pelotao]: !p[grupo.pelotao] }))
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">
                        {pelotaoLabel(grupo.pelotao)}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (aba: {grupo.sheetName})
                        </span>
                      </CardTitle>
                      <Badge variant="secondary">{grupo.linhas.length}</Badge>
                    </div>
                    {open ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>

                {open && (
                  <CardContent className="pt-0">
                    <div className="overflow-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">#</th>
                            <th className="px-3 py-2 text-left">Nome</th>
                            <th className="px-3 py-2 text-left">Nome de guerra</th>
                            <th className="px-3 py-2 text-left">Posto</th>
                            <th className="px-3 py-2 text-left">Nasc.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grupo.linhas.slice(0, 200).map((l, i) => (
                            <tr key={i} className="border-t hover:bg-muted/30">
                              <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                              <td className="px-3 py-1.5 font-medium">{l.nome}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{l.nome_guerra ?? "—"}</td>
                              <td className="px-3 py-1.5">
                                <Badge variant="outline" className="capitalize">{l.posto}</Badge>
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground">{l.data_nascimento ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {grupo.linhas.length > 200 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          Exibindo 200 de {grupo.linhas.length} linhas — todas serão salvas.
                        </p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Referência de nomes de aba */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Nomes de aba reconhecidos na planilha</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {[
              { sheet: "Pel Com", label: "Pel Comunicações" },
              { sheet: "Morteiro", label: "Pel Morteiro" },
              { sheet: "Anticarro", label: "Pel Anticarro" },
              { sheet: "Saúde", label: "Pel Saúde" },
              { sheet: "APROV", label: "Pel Aprove" },
              { sheet: "Enc Mat", label: "ENC MAT" },
              { sheet: "Seç Cmd", label: "Seção CMD" },
              { sheet: "Seç Cmd Su", label: "Seção Cmd Su" },
              { sheet: "PMT", label: "Pel Transporte" },
            ].map((item) => (
              <div key={item.sheet} className="flex items-center gap-2">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{item.sheet}</code>
                <span className="text-muted-foreground">→ {item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
