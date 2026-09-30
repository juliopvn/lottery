import { config } from "dotenv";
config({ path: ".env.local" });

import { ObjectId } from "mongodb";
import { getEnv } from "@/lib/env";
import { getDb } from "@/lib/db/client";
import { ensureIndexes } from "@/lib/db/indexes";
import { computeClabeCheckDigit } from "@/lib/domain/clabe";
import type { LotteryDoc, TicketDoc, UserDoc } from "@/lib/db/types";

/**
 * Seed idempotente, exclusivo para local y CI. Nunca contra Atlas:
 * aborta si NODE_ENV=production o si MONGODB_URI apunta a mongodb+srv://.
 *
 *   npm run seed          -> agrega/actualiza datos de ejemplo (no duplica)
 *   npm run seed:reset    -> igual, pero antes vacía las colecciones
 *   npm run seed:e2e      -> dataset mínimo y determinista para Playwright
 */

const args = process.argv.slice(2);
const shouldReset = args.includes("--reset");
const isE2ESeed = args.includes("--e2e");

function buildTestClabe(accountSuffix: string): string {
  const first17 = `002180${accountSuffix.padStart(11, "0")}`;
  if (first17.length !== 17) {
    throw new Error(`accountSuffix inválido, first17 quedó en ${first17.length} dígitos`);
  }
  const check = computeClabeCheckDigit(first17);
  return `${first17}${check}`;
}

function assertSafeToSeed(mongoUri: string, nodeEnv: string): void {
  if (nodeEnv === "production") {
    throw new Error("Abortado: el seed nunca debe ejecutarse con NODE_ENV=production.");
  }
  if (mongoUri.startsWith("mongodb+srv://")) {
    throw new Error("Abortado: el seed nunca debe apuntar a un cluster Atlas (mongodb+srv://).");
  }
}

async function upsertUser(
  db: Awaited<ReturnType<typeof getDb>>,
  data: Pick<UserDoc, "email" | "role"> & Partial<Pick<UserDoc, "name" | "clabe">>
): Promise<UserDoc> {
  const users = db.collection<UserDoc>("users");
  const now = new Date();
  const result = await users.findOneAndUpdate(
    { email: data.email },
    {
      $set: { role: data.role, name: data.name, clabe: data.clabe },
      $setOnInsert: { _id: new ObjectId(), email: data.email, createdAt: now },
    },
    { upsert: true, returnDocument: "after" }
  );
  if (!result) throw new Error(`No se pudo crear/actualizar el usuario ${data.email}`);
  return result;
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

let seedTicketCounter = 0;
function seedTicket(lotteryId: ObjectId, userId: ObjectId, number: number, paidAt: Date): TicketDoc {
  seedTicketCounter += 1;
  return {
    _id: new ObjectId(),
    lotteryId,
    userId,
    number,
    paidAt,
    stripeSessionId: `seed_${lotteryId.toString().slice(-6)}_${seedTicketCounter}`,
    createdAt: paidAt,
  };
}

async function resetCollections(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  await Promise.all([
    db.collection("users").deleteMany({}),
    db.collection("magic_links").deleteMany({}),
    db.collection("lotteries").deleteMany({}),
    db.collection("tickets").deleteMany({}),
  ]);
  console.log("Colecciones vaciadas (--reset).");
}

async function seedE2E(db: Awaited<ReturnType<typeof getDb>>, adminEmail: string): Promise<void> {
  await upsertUser(db, { email: adminEmail, role: "admin", name: "Admin E2E" });
  await upsertUser(db, { email: "e2e-user@example.com", role: "user", name: "Usuaria E2E Uno" });
  await upsertUser(db, { email: "e2e-user-2@example.com", role: "user", name: "Usuario E2E Dos" });

  console.log("Seed E2E: admin + 2 usuarios de prueba, sin loterías precargadas.");
  console.log("Cada spec de Playwright crea sus propias loterías vía /api/test/lotteries para aislarse entre workers.");
}

async function seedLocal(db: Awaited<ReturnType<typeof getDb>>, adminEmail: string): Promise<void> {
  await upsertUser(db, { email: adminEmail, role: "admin", name: "Admin Lottery" });

  const userWithClabe = await upsertUser(db, {
    email: "ana@example.com",
    role: "user",
    name: "Ana Ejemplo",
    clabe: buildTestClabe("11835971"),
  });
  const userWithoutClabe = await upsertUser(db, {
    email: "beto@example.com",
    role: "user",
    name: "Beto Ejemplo",
  });
  const anotherUserWithClabe = await upsertUser(db, {
    email: "carla@example.com",
    role: "user",
    name: "Carla Ejemplo",
    clabe: buildTestClabe("22946102"),
  });

  const lotteries = db.collection<LotteryDoc>("lotteries");
  const tickets = db.collection<TicketDoc>("tickets");

  // Devuelve el _id REAL del documento (el de una corrida anterior si ya
  // existía por nombre, o el recién generado si es la primera vez), para que
  // los tickets referencien siempre el lotteryId correcto en corridas repetidas.
  async function upsertLottery(doc: LotteryDoc): Promise<ObjectId> {
    const { _id, ...fields } = doc;
    const result = await lotteries.findOneAndUpdate(
      { name: doc.name },
      { $set: fields, $setOnInsert: { _id } },
      { upsert: true, returnDocument: "after" }
    );
    if (!result) throw new Error(`No se pudo crear/actualizar la lotería "${doc.name}"`);
    return result._id;
  }

  async function upsertTickets(lotteryId: ObjectId, docs: TicketDoc[]): Promise<void> {
    for (const doc of docs) {
      const { _id, lotteryId: docLotteryId, number, ...fields } = doc;
      await tickets.updateOne(
        { lotteryId: docLotteryId, number },
        { $set: fields, $setOnInsert: { _id, lotteryId: docLotteryId, number } },
        { upsert: true }
      );
    }
  }

  // 1) Abierta, cierre en varios días: compra permitida.
  const openId = await upsertLottery({
    _id: new ObjectId(),
    name: "Rifa de la Tablet",
    closesAt: daysFromNow(5),
    ticketPriceCents: 15000,
    prizeCents: 500_000,
    totalNumbers: 50,
    status: "open",
    winnerNumber: null,
    winnerId: null,
    drawnAt: null,
    createdAt: new Date(),
  });
  await upsertTickets(openId, [
    seedTicket(openId, userWithClabe._id, 7, new Date()),
    seedTicket(openId, userWithoutClabe._id, 23, new Date()),
  ]);

  // 2) Abierta, cierre en 5 minutos: compra bloqueada por la regla de 10 min.
  await upsertLottery({
    _id: new ObjectId(),
    name: "Rifa Relámpago",
    closesAt: minutesFromNow(5),
    ticketPriceCents: 2000,
    prizeCents: 20_000,
    totalNumbers: 20,
    status: "open",
    winnerNumber: null,
    winnerId: null,
    drawnAt: null,
    createdAt: new Date(),
  });

  // 3) Cerrada (venta terminada), pendiente de sorteo, con boletos vendidos.
  const pendingId = await upsertLottery({
    _id: new ObjectId(),
    name: "Rifa Pendiente de Sorteo",
    closesAt: minutesFromNow(-15),
    ticketPriceCents: 10000,
    prizeCents: 200_000,
    totalNumbers: 30,
    status: "closed",
    winnerNumber: null,
    winnerId: null,
    drawnAt: null,
    createdAt: new Date(),
  });
  await upsertTickets(pendingId, [
    seedTicket(pendingId, userWithClabe._id, 3, new Date()),
    seedTicket(pendingId, anotherUserWithClabe._id, 12, new Date()),
    seedTicket(pendingId, userWithoutClabe._id, 19, new Date()),
  ]);

  // 4) Sorteada con ganador.
  const drawnId = await upsertLottery({
    _id: new ObjectId(),
    name: "Rifa de la Bicicleta",
    closesAt: daysFromNow(-2),
    ticketPriceCents: 5000,
    prizeCents: 150_000,
    totalNumbers: 25,
    status: "drawn",
    winnerNumber: 5,
    winnerId: userWithClabe._id,
    drawnAt: daysFromNow(-2),
    createdAt: daysFromNow(-9),
  });
  await upsertTickets(drawnId, [
    seedTicket(drawnId, userWithClabe._id, 5, daysFromNow(-8)),
    seedTicket(drawnId, anotherUserWithClabe._id, 9, daysFromNow(-7)),
    seedTicket(drawnId, userWithoutClabe._id, 14, daysFromNow(-6)),
  ]);

  // 5) Sorteada sin boletos vendidos.
  await upsertLottery({
    _id: new ObjectId(),
    name: "Rifa Sin Participantes",
    closesAt: daysFromNow(-1),
    ticketPriceCents: 8000,
    prizeCents: 100_000,
    totalNumbers: 40,
    status: "drawn",
    winnerNumber: null,
    winnerId: null,
    drawnAt: daysFromNow(-1),
    createdAt: daysFromNow(-4),
  });

  // 6) totalNumbers pequeño, casi agotada.
  const almostSoldOutId = await upsertLottery({
    _id: new ObjectId(),
    name: "Rifa Mini (casi agotada)",
    closesAt: daysFromNow(2),
    ticketPriceCents: 3000,
    prizeCents: 25_000,
    totalNumbers: 10,
    status: "open",
    winnerNumber: null,
    winnerId: null,
    drawnAt: null,
    createdAt: new Date(),
  });
  const buyers = [userWithClabe, userWithoutClabe, anotherUserWithClabe];
  await upsertTickets(
    almostSoldOutId,
    Array.from({ length: 8 }, (_, i) =>
      seedTicket(almostSoldOutId, buyers[i % buyers.length]!._id, i + 1, new Date())
    )
  );

  console.log("Seed local: 4 usuarios (1 admin) y 6 loterías cubriendo todos los estados.");
}

async function main(): Promise<void> {
  const env = getEnv();
  assertSafeToSeed(env.MONGODB_URI, env.NODE_ENV);

  const db = await getDb();
  await ensureIndexes(db);

  if (shouldReset) {
    await resetCollections(db);
  }

  if (isE2ESeed) {
    await seedE2E(db, env.ADMIN_EMAIL);
  } else {
    await seedLocal(db, env.ADMIN_EMAIL);
  }

  console.log(`Listo. Base de datos: "${db.databaseName}".`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Error en el seed:", error);
  process.exit(1);
});
