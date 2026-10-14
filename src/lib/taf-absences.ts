import { CHAMADAS, TAF_NUMEROS, pelotaoLabel } from "./taf";
import { normalizeSearch } from "./military-search";
import type { Militar, TafResultado } from "./data";

export type TafSelection = "todos" | "1" | "2" | "3";
export type ChamadaSelection = "todos" | "1" | "2";
type Performance = Pick<TafResultado, "militar_id" | "taf_numero" | "chamada" | "flexao" | "abdominal" | "corrida_metros" | "barra" | "mencao" | "observacoes">;

export function realizouTaf(result: Performance): boolean {
  const mention = normalizeSearch(result.mencao ?? "");
  if (/dispens|nao realiz|nao execut|ausente|faltou|^nr$|^n\/r$/.test(mention)) return false;
  return [result.flexao, result.abdominal, result.corrida_metros, result.barra].some(value => value !== null)
    || /^(e|excelente|mb|muito bom|b|bom|r|regular|suf|suficiente|i|insuf|insuficiente)$/.test(mention);
}

/** One absence per selected TAF/call; all expands to the six possible sessions. */
export function getTafAbsences(militares: Militar[], resultados: Performance[], taf: TafSelection, chamada: ChamadaSelection) {
  const tafs = taf === "todos" ? TAF_NUMEROS : [Number(taf)];
  const chamadas = chamada === "todos" ? CHAMADAS : [Number(chamada)];
  const performed = new Set(resultados.filter(realizouTaf).map(r => `${r.militar_id}:${r.taf_numero}:${r.chamada}`));
  return [...militares].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).flatMap(militar =>
    tafs.flatMap(tafNumero => chamadas.flatMap(chamadaNumero => {
      const key = `${militar.id}:${tafNumero}:${chamadaNumero}`;
      if (performed.has(key)) return [];
      const record = resultados.find(r => `${r.militar_id}:${r.taf_numero}:${r.chamada}` === key);
      return [{ militar, taf: tafNumero, chamada: chamadaNumero,
        situacao: record?.mencao || "Sem registro", observacoes: record?.observacoes ?? "" }];
    })),
  );
}

export function groupAbsencesByPelotao(rows: ReturnType<typeof getTafAbsences>) {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const label = row.militar.pelotao ? pelotaoLabel(row.militar.pelotao) : "Sem pelotão";
    const group = groups.get(label) ?? [];
    group.push(row);
    groups.set(label, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
}