import { randomBytes, createHash } from "node:crypto";

const TOKEN_BYTES = 32;

/** Token aleatorio de 32 bytes (hex) y su hash SHA-256, listo para guardar en BD. */
export function generateMagicLinkToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  return { token, tokenHash: hashMagicLinkToken(token) };
}

export function hashMagicLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
