/** Los números de boleto son enteros de 1 a `totalNumbers`, ambos inclusive. */
export function isValidTicketNumber(number: number, totalNumbers: number): boolean {
  return Number.isInteger(number) && number >= 1 && number <= totalNumbers;
}

export const MIN_TOTAL_NUMBERS = 1;
export const MAX_TOTAL_NUMBERS = 100_000;

export function isValidTotalNumbers(totalNumbers: number): boolean {
  return (
    Number.isInteger(totalNumbers) &&
    totalNumbers >= MIN_TOTAL_NUMBERS &&
    totalNumbers <= MAX_TOTAL_NUMBERS
  );
}
