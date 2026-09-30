import { describe, expect, it } from "vitest";
import { isValidTicketNumber, isValidTotalNumbers } from "@/lib/domain/ticket";

describe("isValidTicketNumber", () => {
  it("acepta números dentro del rango 1..totalNumbers", () => {
    expect(isValidTicketNumber(1, 10)).toBe(true);
    expect(isValidTicketNumber(10, 10)).toBe(true);
    expect(isValidTicketNumber(5, 10)).toBe(true);
  });

  it("rechaza 0, negativos, y fuera de rango", () => {
    expect(isValidTicketNumber(0, 10)).toBe(false);
    expect(isValidTicketNumber(-1, 10)).toBe(false);
    expect(isValidTicketNumber(11, 10)).toBe(false);
  });

  it("rechaza no enteros", () => {
    expect(isValidTicketNumber(1.5, 10)).toBe(false);
  });
});

describe("isValidTotalNumbers", () => {
  it("acepta el rango permitido", () => {
    expect(isValidTotalNumbers(1)).toBe(true);
    expect(isValidTotalNumbers(100_000)).toBe(true);
  });

  it("rechaza 0 y valores por encima del máximo", () => {
    expect(isValidTotalNumbers(0)).toBe(false);
    expect(isValidTotalNumbers(100_001)).toBe(false);
  });
});
