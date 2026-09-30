/**
 * Elige un número ganador entre los vendidos. `randomInt` se inyecta para
 * poder testear de forma determinista; en producción es `crypto.randomInt`.
 */
export function pickWinner(
  soldNumbers: number[],
  randomInt: (maxExclusive: number) => number
): number | null {
  if (soldNumbers.length === 0) return null;
  const index = randomInt(soldNumbers.length);
  return soldNumbers[index] ?? null;
}
