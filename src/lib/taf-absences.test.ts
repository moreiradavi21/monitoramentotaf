import { describe, expect, test } from "bun:test";
import { getTafAbsences, groupAbsencesByPelotao } from "./taf-absences";
import type { Militar } from "./data";

const militares: Militar[] = [
  { id: "a", nome: "João", nome_guerra: "Águia", posto: "soldado", pelotao: "saude", identificacao: null, data_nascimento: null, categoria_taf: "belico_masculino", created_at: "" },
  { id: "b", nome: "José", nome_guerra: null, posto: "cabo", pelotao: null, identificacao: null, data_nascimento: null, categoria_taf: "belico_masculino", created_at: "" },
];
const record = (overrides = {}) => ({ militar_id: "a", taf_numero: 1, chamada: 1, flexao: 30, abdominal: null, corrida_metros: null, barra: null, mencao: "B", observacoes: null, ...overrides });

describe("absence report selection", () => {
  test("selects each TAF 1, 2 or 3 independently", () => {
    for (const taf of ["1", "2", "3"] as const) {
      const rows = getTafAbsences(militares, [record()], taf, "1");
      expect(rows.map(r => [r.militar.id, r.taf])).toEqual(taf === "1" ? [["b", 1]] : [["a", Number(taf)], ["b", Number(taf)]]);
    }
  });
  test("selects first or second call independently", () => {
    expect(getTafAbsences(militares, [record()], "1", "1").map(r => r.militar.id)).toEqual(["b"]);
    expect(getTafAbsences(militares, [record()], "1", "2").map(r => [r.militar.id, r.chamada])).toEqual([["a", 2], ["b", 2]]);
  });
  test("all expands to three TAFs and two calls", () => {
    const rows = getTafAbsences([militares[0]], [], "todos", "todos");
    expect(rows.map(r => [r.taf, r.chamada])).toEqual([[1, 1], [1, 2], [2, 1], [2, 2], [3, 1], [3, 2]]);
  });
  test("includes dispensed soldiers and their reason", () => {
    const rows = getTafAbsences(militares, [record({ flexao: null, mencao: "DISPENSADO", observacoes: "Licença" })], "1", "1");
    expect(rows[0].situacao).toBe("DISPENSADO");
    expect(rows[0].observacoes).toBe("Licença");
  });
  test("insufficient and zero-valued performed tests are not absent", () => {
    expect(getTafAbsences(militares, [record({ flexao: 0, mencao: "I" })], "1", "1").map(r => r.militar.id)).toEqual(["b"]);
  });
  test("separates platoons and keeps unassigned soldiers", () => {
    const groups = groupAbsencesByPelotao(getTafAbsences(militares, [], "1", "1"));
    expect(groups.map(([label, rows]) => [label, rows.map(r => r.militar.id)])).toEqual([["Pel Saúde", ["a"]], ["Sem pelotão", ["b"]]]);
  });
});