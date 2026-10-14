export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function matchesMilitar(
  militar: { nome: string; nome_guerra?: string | null },
  query: string,
): boolean {
  const term = normalizeSearch(query);
  return !term || normalizeSearch(militar.nome).includes(term) || normalizeSearch(militar.nome_guerra ?? "").includes(term);
}