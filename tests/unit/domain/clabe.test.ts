import { describe, expect, it } from "vitest";
import { computeClabeCheckDigit, getBankHint, maskClabe, validateClabe } from "@/lib/domain/clabe";

function buildClabe(first17: string): string {
  return `${first17}${computeClabeCheckDigit(first17)}`;
}

describe("clabe", () => {
  const validClabe = buildClabe("00218000011835971");

  it("acepta una CLABE con dígito de control correcto", () => {
    expect(validateClabe(validClabe)).toEqual({ valid: true });
  });

  it("rechaza longitudes distintas de 18", () => {
    expect(validateClabe("123")).toEqual({ valid: false, reason: "length" });
    expect(validateClabe("0".repeat(19))).toEqual({ valid: false, reason: "length" });
  });

  it("rechaza caracteres no numéricos", () => {
    const withLetter = "a" + "0".repeat(17);
    expect(validateClabe(withLetter)).toEqual({ valid: false, reason: "format" });
  });

  it("rechaza un dígito de control incorrecto", () => {
    const wrongDigit = validClabe.slice(0, 17) + String((Number(validClabe[17]) + 1) % 10);
    expect(validateClabe(wrongDigit)).toEqual({ valid: false, reason: "checksum" });
  });

  it("enmascara mostrando solo los últimos 6 dígitos", () => {
    const masked = maskClabe(validClabe);
    const last6 = validClabe.slice(-6);
    expect(masked).toBe(`•••• •••• ••${last6.slice(0, 2)} ${last6.slice(2)}`);
    expect(masked).not.toContain(validClabe.slice(0, 12));
  });

  it("identifica el banco por los primeros 3 dígitos cuando se reconoce", () => {
    expect(getBankHint("002" + "0".repeat(15))).toBe("Banamex");
    expect(getBankHint("999" + "0".repeat(15))).toBeUndefined();
  });
});
