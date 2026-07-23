export const POSTOS = [
  { value: "oficial", label: "Oficiais", plural: "Oficiais" },
  { value: "sargento", label: "Sargento", plural: "Sargentos" },
  { value: "cabo", label: "Cabo", plural: "Cabos" },
  { value: "soldado", label: "Soldado", plural: "Soldados" },
  { value: "recruta", label: "Recruta", plural: "Recrutas" },
] as const;

export type Posto = (typeof POSTOS)[number]["value"];

export const postoLabel = (p: Posto) =>
  POSTOS.find((x) => x.value === p)?.label ?? p;

export const postoPlural = (p: Posto) =>
  POSTOS.find((x) => x.value === p)?.plural ?? p;

export const PELOTOES = [
  { value: "comunicacoes", label: "Pel Comunicações" },
  { value: "morteiro", label: "Pel Morteiro" },
  { value: "anticarro", label: "Pel Anticarro" },
  { value: "saude", label: "Pel Saúde" },
  { value: "aprove", label: "Pel Aprove" },
  { value: "enc_mat", label: "ENC MAT" },
  { value: "sec_cmd", label: "Seção CMD" },
  { value: "sec_cmd_su", label: "Seção Cmd Su" },
  { value: "pmt", label: "Pel Transporte" },
] as const;

export type Pelotao = (typeof PELOTOES)[number]["value"];

export const pelotaoLabel = (p: string) =>
  PELOTOES.find((x) => x.value === p)?.label ?? p;

export const TAF_NUMEROS = [1, 2, 3] as const;
export const CHAMADAS = [1, 2] as const;

export function mencaoParaNota(nota: number | null | undefined): string {
  if (nota == null) return "—";
  if (nota >= 9) return "Excelente";
  if (nota >= 7) return "Muito Bom";
  if (nota >= 6) return "Bom";
  if (nota >= 5) return "Regular";
  return "Insuficiente";
}

export function mencaoColor(mencao: string | null | undefined): string {
  switch (mencao) {
    case "Excelente":
    case "E":
      return "bg-gold/20 text-gold-foreground border-gold/40";
    case "Muito Bom":
    case "MB":
      return "bg-primary/15 text-primary border-primary/30";
    case "Bom":
    case "B":
      return "bg-secondary/20 text-secondary-foreground border-secondary/40";
    case "Regular":
    case "R":
    case "SUF":
      return "bg-muted text-muted-foreground border-border";
    case "Insuficiente":
    case "I":
    case "INSUF":
      return "bg-destructive/15 text-destructive border-destructive/40";
    case "DISPENSADO":
      return "bg-orange-500/10 text-orange-600 border-orange-400/40";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export type ExerKey = "COR" | "FLEX" | "ABD" | "BAR" | "FIN";

/**
 * Extrai as menções por exercício das observações, no formato
 * "FLEX:X ABD:Y COR:Z BAR:W SUF:V". FIN vem da menção final do registro.
 */
export function extractMencoes(
  observacoes: string | null | undefined,
  mencaoFinal: string | null | undefined,
): Record<ExerKey, string> {
  const out: Record<ExerKey, string> = {
    COR: "—",
    FLEX: "—",
    ABD: "—",
    BAR: "—",
    FIN: mencaoFinal ?? "—",
  };
  if (observacoes) {
    const re = /(FLEX|ABD|COR|BAR)\s*:\s*([A-Za-zÀ-ÿ]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(observacoes))) {
      const key = m[1].toUpperCase() as Exclude<ExerKey, "FIN">;
      out[key] = m[2].toUpperCase();
    }
  }
  return out;
}

const MENCAO_SCORE: Record<string, number> = {
  E: 5,
  EXCELENTE: 5,
  MB: 4,
  "MUITO BOM": 4,
  B: 3,
  BOM: 3,
  R: 2,
  REGULAR: 2,
  SUF: 2,
  I: 1,
  INSUF: 1,
  INSUFICIENTE: 1,
};

/** Média das menções: converte cada menção em score 1..5, calcula média,
 *  devolve label + score. */
export function mencaoMedia(
  mencoes: (string | null | undefined)[],
): { label: string; short: string; score: number | null } {
  const scores = mencoes
    .map((m) => (m ? MENCAO_SCORE[m.trim().toUpperCase()] : undefined))
    .filter((n): n is number => typeof n === "number");
  if (!scores.length) return { label: "—", short: "—", score: null };
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg >= 4.5) return { label: "Excelente", short: "E", score: avg };
  if (avg >= 3.5) return { label: "Muito Bom", short: "MB", score: avg };
  if (avg >= 2.5) return { label: "Bom", short: "B", score: avg };
  if (avg >= 1.5) return { label: "Regular", short: "R", score: avg };
  return { label: "Insuficiente", short: "I", score: avg };
}

// ── Categorias TAF ────────────────────────────────────────────────────────────

export const CATEGORIAS_TAF = [
  { value: "belico_masculino", label: "Bélico Masculino" },
  { value: "belico_feminino", label: "Bélico Feminino" },
  { value: "saude_masculino", label: "Saúde Masculino" },
  { value: "saude_feminino", label: "Saúde Feminino" },
] as const;

export type CategoriaTaf = (typeof CATEGORIAS_TAF)[number]["value"];

export const categoriaTafLabel = (c: string | null | undefined): string =>
  CATEGORIAS_TAF.find((x) => x.value === c)?.label ?? (c ?? "—");

/** Retorna true se a categoria inclui exercício de Barra Fixa. */
export const categoriaTafTemBarra = (c: string | null | undefined): boolean =>
  c === "belico_masculino" || c === "belico_feminino" || !c;

/**
 * Para Bélico Feminino, idades 40-49 a barra é sustentação (segundos),
 * não repetições.
 */
export const barraEhSustentacao = (
  c: string | null | undefined,
  idade: number | null | undefined,
): boolean =>
  c === "belico_feminino" && idade != null && idade >= 40 && idade <= 49;
