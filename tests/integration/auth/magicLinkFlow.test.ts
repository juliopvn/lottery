import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { ensureIndexes } from "@/lib/db/indexes";
import { generateMagicLinkToken, hashMagicLinkToken } from "@/lib/auth/magicLink";
import {
  consumeMagicLink,
  createMagicLink,
  findValidMagicLinkByHash,
} from "@/lib/db/repositories/magicLinks";
import { findOrCreateUserForLogin } from "@/lib/db/repositories/users";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "lottery_magic_link_test";
  await ensureIndexes(await getDb());
});

afterAll(async () => {
  await mongo.stop();
});

describe("magic link — expiración y uso único", () => {
  it("un enlace vigente y no usado se encuentra por su hash", async () => {
    const { token, tokenHash } = generateMagicLinkToken();
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    await createMagicLink("user@example.com", tokenHash, expiresAt);

    const found = await findValidMagicLinkByHash(hashMagicLinkToken(token), new Date());
    expect(found).not.toBeNull();
    expect(found?.email).toBe("user@example.com");
  });

  it("un enlace vencido no se considera válido", async () => {
    const { token, tokenHash } = generateMagicLinkToken();
    const expiresAt = new Date(Date.now() - 1000); // ya expiró
    await createMagicLink("expired@example.com", tokenHash, expiresAt);

    const found = await findValidMagicLinkByHash(hashMagicLinkToken(token), new Date());
    expect(found).toBeNull();
  });

  it("un enlace solo puede consumirse (usarse) una vez", async () => {
    const { tokenHash } = generateMagicLinkToken();
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const link = await createMagicLink("once@example.com", tokenHash, expiresAt);

    const firstConsume = await consumeMagicLink(link._id);
    expect(firstConsume).toBe(true);

    const secondConsume = await consumeMagicLink(link._id);
    expect(secondConsume).toBe(false);

    // Tras consumirse, ya no debe encontrarse como válido (used: true).
    const found = await findValidMagicLinkByHash(tokenHash, new Date());
    expect(found).toBeNull();
  });

  it("el token guardado en BD es un hash, nunca el token en claro", async () => {
    const { token, tokenHash } = generateMagicLinkToken();
    const link = await createMagicLink("hash-check@example.com", tokenHash, new Date(Date.now() + 60_000));
    expect(link.tokenHash).not.toBe(token);
    expect(link.tokenHash).toBe(tokenHash);
  });
});

describe("bootstrap del admin sin seed", () => {
  it("crea un usuario normal para un email cualquiera", async () => {
    const user = await findOrCreateUserForLogin("someone@example.com", "admin@example.com");
    expect(user.role).toBe("user");
  });

  it("asigna role admin automáticamente cuando el email coincide con ADMIN_EMAIL", async () => {
    const user = await findOrCreateUserForLogin("admin@example.com", "admin@example.com");
    expect(user.role).toBe("admin");
  });

  it("es idempotente: volver a llamar con el mismo email no duplica el usuario", async () => {
    const first = await findOrCreateUserForLogin("repeat@example.com", "admin@example.com");
    const second = await findOrCreateUserForLogin("repeat@example.com", "admin@example.com");
    expect(first._id.toString()).toBe(second._id.toString());
  });
});
