import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { POSTOS, type Posto } from "@/lib/taf";
import { RequireAdmin } from "@/components/require-admin";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/importar")({
  component: () => (
    <RequireAdmin>
      <ImportarPage />
    </RequireAdmin>
  ),
});

type LinhaPreview = {
  nome: string;
  nome_guerra: string | null;
  posto: Posto;
  data_nascimento: string | null;
};

function normKey(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseData(v: any): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
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

function ImportarPage() {
  const qc = useQueryClient();
  const [postoDefault, setPostoDefault] = useState<Posto>("soldado");
  const [linhas, setLinhas] = useState<LinhaPreview[]>([]);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState<number | null>(null);

  function handleFile(f: File) {
    setFileName(f.name);
    setOk(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array", cellDates: true });
        const rows: LinhaPreview[] = [];
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
          for (const r of json) {
            const map: Record<string, any> = {};
            for (const k of Object.keys(r)) map[normKey(k)] = r[k];
            const nome =
              map["nome completo"] ??
              map["nome"] ??
              map["militar"] ??
              map["nome do militar"] ??
              "";
            if (!nome || typeof nome !== "string" || nome.trim().length < 3) continue;
            const nome_guerra =
              map["nome de guerra"] ?? map["nome guerra"] ?? map["ng"] ?? null;
            const dn =
              map["data de nascimento"] ??
              map["data nascimento"] ??
              map["nascimento"] ??
              map["dn"] ??
              null;
            const postoRaw = String(
              map["posto"] ?? map["graduacao"] ?? map["posto/graduacao"] ?? "",
            )
              .toUpperCase()
              .trim();
            let posto: Posto = postoDefault;
            if (/CAP|TEN|ASP|OFIC/.test(postoRaw)) posto = "oficial";
            else if (/SGT|SARG/.test(postoRaw)) posto = "sargento";
            else if (/^CB|CABO/.test(postoRaw)) posto = "cabo";
            else if (/SD EV|RECR|EV$/.test(postoRaw)) posto = "recruta";
            else if (/^SD|SOLD/.test(postoRaw)) posto = "soldado";
            rows.push({
              nome: nome.trim().toUpperCase(),
              nome_guerra: nome_guerra ? String(nome_guerra).trim().toUpperCase() : null,
              posto,
              data_nascimento: parseData(dn),
            });
          }
        }
        if (!rows.length) {
          toast.error(
            "Nenhuma linha encontrada. Verifique se há uma coluna 'Nome' na planilha.",
          );
          return;
        }
        setLinhas(rows);
        toast.success(`${rows.length} militares detectados.`);
      } catch (e: any) {
        toast.error("Não foi possível ler a planilha: " + (e?.message ?? ""));
      }
    };
    reader.readAsArrayBuffer(f);
  }

  async function salvar() {
    if (!linhas.length) return;
    setSaving(true);
    try {
      // Busca todos militares existentes para casar por nome
      const { data: existentes, error: e0 } = await supabase
        .from("militares")
        .select("id,nome");
      if (e0) throw e0;
      const byNome = new Map<string, string>();
      for (const m of existentes ?? []) byNome.set(m.nome.toUpperCase().trim(), m.id);

      const inserts: any[] = [];
      const updates: { id: string; payload: any }[] = [];
      for (const l of linhas) {
        const payload = {
          nome: l.nome,
          nome_guerra: l.nome_guerra,
          posto: l.posto,
          data_nascimento: l.data_nascimento,
        };
        const id = byNome.get(l.nome);
        if (id) updates.push({ id, payload });
        else inserts.push(payload);
      }

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

      setOk(linhas.length);
      qc.invalidateQueries({ queryKey: ["militares"] });
      toast.success(
        `Concluído — ${inserts.length} novos, ${updates.length} atualizados.`,
      );
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Ferramentas
        </p>
        <h1 className="mt-1 text-3xl font-display tracking-wide text-primary">
          Importar planilha
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie um arquivo .xlsx com as colunas <b>Nome</b> (obrigatório),{" "}
          <b>Nome de Guerra</b>, <b>Posto</b> e <b>Data Nascimento</b> para atualizar
          a relação de militares.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg tracking-wide text-primary">
            1. Selecione o arquivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Posto padrão (quando a planilha não informar)</Label>
              <Select
                value={postoDefault}
                onValueChange={(v) => setPostoDefault(v as Posto)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSTOS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.plural}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Arquivo .xlsx</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {fileName && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileSpreadsheet className="h-3 w-3" /> {fileName}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {linhas.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-display text-lg tracking-wide text-primary">
              2. Prévia ({linhas.length})
            </CardTitle>
            <Button onClick={salvar} disabled={saving}>
              <Upload className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar no sistema"}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2">Nome</th>
                  <th className="py-2">NG</th>
                  <th className="py-2">Posto</th>
                  <th className="py-2">Nasc.</th>
                </tr>
              </thead>
              <tbody>
                {linhas.slice(0, 200).map((l, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5">{l.nome}</td>
                    <td className="py-1.5 text-muted-foreground">
                      {l.nome_guerra ?? "—"}
                    </td>
                    <td className="py-1.5">
                      <Badge variant="outline">{l.posto}</Badge>
                    </td>
                    <td className="py-1.5 text-muted-foreground">
                      {l.data_nascimento ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {linhas.length > 200 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Exibindo 200 de {linhas.length} linhas — todas serão salvas.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {ok != null && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <p className="text-sm">
              Importação concluída — {ok} militares processados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
