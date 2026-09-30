import { describe, expect, it } from "vitest";
import { generateMagicLinkToken, hashMagicLinkToken } from "@/lib/auth/magicLink";

describe("magic link tokens", () => {
  it("genera un token de 32 bytes en hexadecimal (64 caracteres)", () => {
    const { token } = generateMagicLinkToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("el hash guardado nunca es igual al token en claro", () => {
    const { token, tokenHash } = generateMagicLinkToken();
    expect(tokenHash).not.toBe(token);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it("hashMagicLinkToken es determinista", () => {
    const { token, tokenHash } = generateMagicLinkToken();
    expect(hashMagicLinkToken(token)).toBe(tokenHash);
  });

  it("dos tokens generados son distintos entre sí", () => {
    const a = generateMagicLinkToken();
    const b = generateMagicLinkToken();
    expect(a.token).not.toBe(b.token);
  });
});
