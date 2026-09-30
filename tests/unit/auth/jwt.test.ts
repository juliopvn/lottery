import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";

const SECRET = "unit-test-secret-at-least-32-characters-long";

describe("session JWT (jose)", () => {
  it("firma y verifica un token válido, recuperando el payload", async () => {
    const token = await signSessionToken({ sub: "abc123", email: "user@example.com", role: "user" }, SECRET);
    const payload = await verifySessionToken(token, SECRET);

    expect(payload).toEqual({ sub: "abc123", email: "user@example.com", role: "user" });
  });

  it("rechaza un token firmado con un secreto distinto", async () => {
    const token = await signSessionToken({ sub: "abc123", email: "user@example.com", role: "user" }, SECRET);
    const payload = await verifySessionToken(token, "otro-secreto-completamente-distinto-de-32");
    expect(payload).toBeNull();
  });

  it("rechaza un token manipulado", async () => {
    const token = await signSessionToken({ sub: "abc123", email: "user@example.com", role: "user" }, SECRET);
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifySessionToken(tampered, SECRET)).toBeNull();
  });

  it("rechaza basura que no es un JWT", async () => {
    expect(await verifySessionToken("no-soy-un-jwt", SECRET)).toBeNull();
  });

  it("conserva el rol admin en el payload", async () => {
    const token = await signSessionToken({ sub: "admin1", email: "admin@example.com", role: "admin" }, SECRET);
    const payload = await verifySessionToken(token, SECRET);
    expect(payload?.role).toBe("admin");
  });
});
