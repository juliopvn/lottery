/**
 * Validación de CLABE interbancaria mexicana (18 dígitos).
 * Pura y testeada: sin BD, sin red.
 *
 * Dígito de control: pesos [3,7,1] repetidos sobre los primeros 17 dígitos,
 * suma de (dígito × peso) mod 10, control = (10 − suma mod 10) mod 10.
 */

const WEIGHTS = [3, 7, 1] as const;

export interface ClabeValidationResult {
  valid: boolean;
  reason?: "length" | "format" | "checksum";
}

/** Calcula el dígito de control esperado para los primeros 17 dígitos. */
export function computeClabeCheckDigit(first17Digits: string): number {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const digit = Number(first17Digits[i]);
    const weight = WEIGHTS[i % 3] as number;
    sum += (digit * weight) % 10;
  }
  return (10 - (sum % 10)) % 10;
}

export function validateClabe(clabe: string): ClabeValidationResult {
  if (clabe.length !== 18) {
    return { valid: false, reason: "length" };
  }
  if (!/^\d{18}$/.test(clabe)) {
    return { valid: false, reason: "format" };
  }

  const expectedControl = computeClabeCheckDigit(clabe.slice(0, 17));
  const actualControl = Number(clabe[17]);

  if (expectedControl !== actualControl) {
    return { valid: false, reason: "checksum" };
  }

  return { valid: true };
}

/** Enmascara una CLABE para mostrarla en UI: •••• •••• ••12 3456 */
export function maskClabe(clabe: string): string {
  if (clabe.length !== 18) return clabe;
  const last6 = clabe.slice(-6);
  return `•••• •••• ••${last6.slice(0, 2)} ${last6.slice(2)}`;
}

const BANK_CODES: Record<string, string> = {
  "002": "Banamex",
  "006": "Bancomext",
  "009": "Banobras",
  "012": "BBVA México",
  "014": "Santander",
  "019": "Banjercito",
  "021": "HSBC",
  "030": "Bajío",
  "036": "Inbursa",
  "042": "Mifel",
  "044": "Scotiabank",
  "058": "Banregio",
  "059": "Invex",
  "060": "Bansi",
  "062": "Afirme",
  "072": "Banorte",
  "102": "Multiva",
  "106": "Bank of America",
  "127": "Azteca",
  "128": "Autofin",
  "129": "Barclays",
  "130": "Compartamos",
  "132": "Multiva Banco",
  "133": "Actinver",
  "136": "Intercam",
  "137": "Bancoppel",
  "138": "ABC Capital",
  "140": "Consubanco",
  "141": "Volkswagen Bank",
  "143": "CIBanco",
  "145": "Bbase",
  "166": "Banco del Bienestar",
  "168": "Hipotecaria Federal",
  "646": "STP",
  "647": "Telecomm",
  "648": "Evercore",
  "649": "Skandia",
  "650": "ICBC",
  "677": "Caja Popular Mexicana",
  "901": "CLS",
};

/** Devuelve el nombre del banco a partir de los 3 primeros dígitos, si se reconoce. */
export function getBankHint(clabe: string): string | undefined {
  if (clabe.length < 3) return undefined;
  return BANK_CODES[clabe.slice(0, 3)];
}
