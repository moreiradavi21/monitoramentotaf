import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { matchesMilitar } from "./military-search";

describe("military name search", () => {
  const militar = { nome: "João Antônio da Conceição", nome_guerra: "ÁGUIA" };
  test("matches full name without accents", () => assert.equal(matchesMilitar(militar, "joao antonio da conceicao"), true));
  test("matches war name without accents", () => assert.equal(matchesMilitar(militar, "aguia"), true));
  test("ignores case, surrounding and repeated spaces", () => assert.equal(matchesMilitar(militar, "  JOÃO   ANTÔNIO  "), true));
  test("does not match unrelated names", () => assert.equal(matchesMilitar(militar, "Silva"), false));
  test("accepts a missing war name", () => assert.equal(matchesMilitar({ nome: "José", nome_guerra: null }, "jose"), true));
});