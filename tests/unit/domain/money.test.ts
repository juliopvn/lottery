import { describe, expect, it } from "vitest";
import {
  centsToPesos,
  formatCents,
  isValidTicketPriceCents,
  MIN_TICKET_PRICE_CENTS,
  pesosToCents,
} from "@/lib/domain/money";

describe("money", () => {
  it("convierte pesos a centavos redondeando", () => {
    expect(pesosToCents(150)).toBe(15000);
    expect(pesosToCents(10.5)).toBe(1050);
    expect(pesosToCents(10.005)).toBe(1001); // redondeo bancario simple
  });

  it("convierte centavos a pesos", () => {
    expect(centsToPesos(15000)).toBe(150);
    expect(centsToPesos(1050)).toBe(10.5);
  });

  it("rechaza centavos no enteros al convertir a pesos", () => {
    expect(() => centsToPesos(10.5)).toThrow();
  });

  it("formatea centavos como moneda MXN", () => {
    expect(formatCents(15000)).toContain("150");
    expect(formatCents(15000)).toMatch(/\$/);
  });

  it("exige el mínimo de Stripe ($10.00 MXN = 1000 centavos)", () => {
    expect(MIN_TICKET_PRICE_CENTS).toBe(1000);
    expect(isValidTicketPriceCents(999)).toBe(false);
    expect(isValidTicketPriceCents(1000)).toBe(true);
    expect(isValidTicketPriceCents(1000.5)).toBe(false);
  });
});
