import { describe, expect, it } from "vitest";
import { canBuy, canDraw, effectiveStatus, saleClosesAt } from "@/lib/domain/lottery";

const BASE_DATE = new Date("2026-01-01T12:00:00.000Z");

describe("lottery — regla de los 10 minutos", () => {
  it("saleClosesAt resta exactamente 10 minutos a closesAt", () => {
    expect(saleClosesAt(BASE_DATE).toISOString()).toBe("2026-01-01T11:50:00.000Z");
  });

  it("permite comprar si la lotería está open y faltan más de 10 minutos", () => {
    const now = new Date(BASE_DATE.getTime() - 11 * 60_000);
    expect(canBuy({ status: "open", closesAt: BASE_DATE }, now)).toBe(true);
  });

  it("bloquea la compra exactamente en el límite de los 10 minutos", () => {
    const atCutoff = new Date(BASE_DATE.getTime() - 10 * 60_000);
    expect(canBuy({ status: "open", closesAt: BASE_DATE }, atCutoff)).toBe(false);
  });

  it("bloquea la compra dentro de la ventana de 10 minutos antes del cierre", () => {
    const now = new Date(BASE_DATE.getTime() - 5 * 60_000);
    expect(canBuy({ status: "open", closesAt: BASE_DATE }, now)).toBe(false);
  });

  it("nunca permite comprar si la lotería no está open", () => {
    const now = new Date(BASE_DATE.getTime() - 60 * 60_000);
    expect(canBuy({ status: "closed", closesAt: BASE_DATE }, now)).toBe(false);
    expect(canBuy({ status: "drawn", closesAt: BASE_DATE }, now)).toBe(false);
  });
});

describe("lottery — sorteo", () => {
  it("no permite sortear antes de closesAt", () => {
    const before = new Date(BASE_DATE.getTime() - 1000);
    expect(canDraw({ status: "open", closesAt: BASE_DATE }, before)).toBe(false);
  });

  it("permite sortear justo en closesAt o después", () => {
    expect(canDraw({ status: "open", closesAt: BASE_DATE }, BASE_DATE)).toBe(true);
    expect(canDraw({ status: "closed", closesAt: BASE_DATE }, new Date(BASE_DATE.getTime() + 1))).toBe(
      true
    );
  });

  it("no permite sortear dos veces", () => {
    const after = new Date(BASE_DATE.getTime() + 60_000);
    expect(canDraw({ status: "drawn", closesAt: BASE_DATE }, after)).toBe(false);
  });
});

describe("lottery — estado derivado por hora", () => {
  it("una lotería open cuyo closesAt ya pasó se ve como closed", () => {
    const after = new Date(BASE_DATE.getTime() + 1000);
    expect(effectiveStatus({ status: "open", closesAt: BASE_DATE }, after)).toBe("closed");
  });

  it("una lotería open cuyo closesAt no ha llegado sigue open", () => {
    const before = new Date(BASE_DATE.getTime() - 1000);
    expect(effectiveStatus({ status: "open", closesAt: BASE_DATE }, before)).toBe("open");
  });

  it("drawn siempre se mantiene drawn", () => {
    const before = new Date(BASE_DATE.getTime() - 1000);
    expect(effectiveStatus({ status: "drawn", closesAt: BASE_DATE }, before)).toBe("drawn");
  });
});
