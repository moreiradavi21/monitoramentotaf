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
      return "bg-gold/20 text-gold-foreground border-gold/40";
    case "Muito Bom":
      return "bg-primary/15 text-primary border-primary/30";
    case "Bom":
      return "bg-secondary/20 text-secondary-foreground border-secondary/40";
    case "Regular":
      return "bg-muted text-muted-foreground border-border";
    case "Insuficiente":
      return "bg-destructive/15 text-destructive border-destructive/40";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
