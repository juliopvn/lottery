import { MongoClient, type Db } from "mongodb";
import { getEnv } from "@/lib/env";

/**
 * Cliente Mongo singleton, compatible con el hot reload de Next.js en
 * desarrollo (evita abrir una conexión nueva en cada recarga de módulo).
 */

declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (!global.__mongoClientPromise) {
    const { MONGODB_URI } = getEnv();
    const client = new MongoClient(MONGODB_URI);
    global.__mongoClientPromise = client.connect();
  }
  return global.__mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  const { MONGODB_DB } = getEnv();
  return client.db(MONGODB_DB);
}
