import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TAF_NUMEROS, CHAMADAS, postoLabel } from "@/lib/taf";
import { getTafAbsences, groupAbsencesByPelotao, type TafSelection, type ChamadaSelection } from "@/lib/taf-absences";
import type { Militar, TafResultado } from "@/lib/data";

export function TafAbsencesExport({ militares, resultados, loading }: { militares: Militar[]; resultados: TafResultado[]; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const [taf, setTaf] = useState<TafSelection>("1");
  const [chamada, setChamada] = useState<ChamadaSelection>("1");
  const rows = getTafAbsences(militares, resultados, taf, chamada);

  function download() {
    try {
      if (!rows.length) { toast.info("Nenhum militar sem realização nos TAFs e chamadas selecionados."); return; }
      const wb = XLSX.utils.book_new();
      groupAbsencesByPelotao(rows).forEach(([pelotao, group], index) => {
        const data = group.map(row => ({
          "Pelotão": pelotao, "Nome completo": row.militar.nome,
          "Nome de guerra": row.militar.nome_guerra ?? "", "Posto/Graduação": postoLabel(row.militar.posto),
          "TAF": `${row.taf}º TAF`, "Chamada": row.chamada === null ? "Todas as chamadas" : `${row.chamada}ª Chamada`,
          "Situação": row.situacao, "Observações": row.observacoes,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws["!cols"] = [24, 45, 24, 20, 12, 22, 24, 50].map(wch => ({ wch }));
        ws["!autofilter"] = { ref: ws["!ref"] ?? "A1:H1" };
        const name = `${index + 1} ${pelotao}`.replace(/[\\/\[\]*?:]/g, " ").slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, name);
      });
      XLSX.writeFile(wb, `Nao_realizaram_TAF_CCAP_${taf}TAF_${chamada}Ch_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setOpen(false);
      toast.success("Planilha de não realização gerada por pelotão.");
    } catch { toast.error("Não foi possível gerar a planilha. Tente novamente."); }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" disabled={loading || !militares.length}><FileX className="mr-2 h-4 w-4" />Não realizaram o TAF</Button></DialogTrigger>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Planilha — não realizaram o TAF</DialogTitle></DialogHeader>
      <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="absence-taf">TAF</Label>
          <Select value={taf} onValueChange={value => setTaf(value as TafSelection)}>
            <SelectTrigger id="absence-taf"><SelectValue /></SelectTrigger>
            <SelectContent>{TAF_NUMEROS.map(n => <SelectItem key={n} value={String(n)}>{n}º TAF</SelectItem>)}<SelectItem value="todos">Todos os TAFs</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label htmlFor="absence-chamada">Chamada</Label>
          <Select value={chamada} onValueChange={value => setChamada(value as ChamadaSelection)}>
            <SelectTrigger id="absence-chamada"><SelectValue /></SelectTrigger>
            <SelectContent>{CHAMADAS.map(n => <SelectItem key={n} value={String(n)}>{n}ª Chamada</SelectItem>)}<SelectItem value="todos">Todas as chamadas</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{new Set(rows.map(r => r.militar.id)).size} militar(es) · {rows.length} não realização(ões)</p>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={download} disabled={loading || !rows.length}><Download className="mr-2 h-4 w-4" />Gerar planilha</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}