import { describe, expect, test } from "bun:test";
import { matchesMilitar } from "./military-search";

describe("military name search", () => {
  const militar = { nome: "João Antônio da Conceição", nome_guerra: "ÁGUIA" };
  test("matches full name without accents", () => expect(matchesMilitar(militar, "joao antonio da conceicao")).toBe(true));
  test("matches war name without accents", () => expect(matchesMilitar(militar, "aguia")).toBe(true));
  test("ignores case, surrounding and repeated spaces", () => expect(matchesMilitar(militar, "  JOÃO   ANTÔNIO  ")).toBe(true));
  test("does not match unrelated names", () => expect(matchesMilitar(militar, "Silva")).toBe(false));
  test("accepts a missing war name", () => expect(matchesMilitar({ nome: "José", nome_guerra: null }, "jose")).toBe(true));
});