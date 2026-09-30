export type LotteryStatus = "open" | "closed" | "drawn";

export interface LotteryTiming {
  status: LotteryStatus;
  closesAt: Date;
}

/** La venta cierra 10 minutos antes del sorteo. Regla no negociable. */
export const SALE_CUTOFF_MINUTES = 10;

/** Instante en el que dejan de aceptarse compras para esta lotería. */
export function saleClosesAt(closesAt: Date): Date {
  return new Date(closesAt.getTime() - SALE_CUTOFF_MINUTES * 60_000);
}

/**
 * Regla de los 10 minutos, validada siempre en el servidor.
 * `now` se inyecta explícitamente para poder testear sin depender del reloj real.
 */
export function canBuy(lottery: LotteryTiming, now: Date): boolean {
  return lottery.status === "open" && now.getTime() < saleClosesAt(lottery.closesAt).getTime();
}

/** El sorteo solo puede ejecutarse cuando ya se alcanzó la hora de cierre. */
export function canDraw(lottery: LotteryTiming, now: Date): boolean {
  return lottery.status !== "drawn" && now.getTime() >= lottery.closesAt.getTime();
}

/**
 * Estado derivado por hora, sin depender de un cron: una lotería `open` cuyo
 * `closesAt` ya pasó se muestra como `closed` aunque el documento en BD no se
 * haya actualizado todavía (se actualiza de forma perezosa al leer o sortear).
 */
export function effectiveStatus(lottery: LotteryTiming, now: Date): LotteryStatus {
  if (lottery.status === "drawn") return "drawn";
  if (now.getTime() >= lottery.closesAt.getTime()) return "closed";
  return lottery.status;
}

export function msUntil(date: Date, now: Date): number {
  return Math.max(0, date.getTime() - now.getTime());
}
