/**
 * Todo el dinero se maneja en centavos enteros (MXN). Nunca floats.
 * Estas funciones son puras: sin BD, sin red, fáciles de testear.
 */

/** Stripe exige un cargo mínimo de $10.00 MXN por boleto. */
export const MIN_TICKET_PRICE_CENTS = 1000;

export function pesosToCents(pesos: number): number {
  if (!Number.isFinite(pesos)) {
    throw new Error("El monto en pesos debe ser un número finito");
  }
  return Math.round(pesos * 100);
}

export function centsToPesos(cents: number): number {
  if (!Number.isInteger(cents)) {
    throw new Error("Los centavos deben ser un entero");
  }
  return cents / 100;
}

const mxnFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export function formatCents(cents: number): string {
  return mxnFormatter.format(centsToPesos(cents));
}

export function isValidTicketPriceCents(cents: number): boolean {
  return Number.isInteger(cents) && cents >= MIN_TICKET_PRICE_CENTS;
}
