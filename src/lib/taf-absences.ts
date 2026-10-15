import { TAF_NUMEROS, pelotaoLabel } from "./taf";
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

/** All calls considers a TAF performed if either call was performed; one row per absent TAF. */
export function getTafAbsences(militares: Militar[], resultados: Performance[], taf: TafSelection, chamada: ChamadaSelection) {
  const tafs = taf === "todos" ? TAF_NUMEROS : [Number(taf)];
  return [...militares].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).flatMap(militar =>
    tafs.flatMap(tafNumero => {
      const records = resultados.filter(r => r.militar_id === militar.id && r.taf_numero === tafNumero
        && (chamada === "todos" ? r.chamada === 1 || r.chamada === 2 : r.chamada === Number(chamada)));
      if (records.some(realizouTaf)) return [];
      return [{ militar, taf: tafNumero, chamada: chamada === "todos" ? null : Number(chamada),
        situacao: [...new Set(records.map(r => r.mencao).filter(Boolean))].join(" / ") || "Sem registro",
        observacoes: [...new Set(records.map(r => r.observacoes).filter(Boolean))].join(" / ") }];
    }),
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