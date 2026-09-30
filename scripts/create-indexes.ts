import { config } from "dotenv";
config({ path: ".env.local" });

import { getDb } from "@/lib/db/client";
import { ensureIndexes } from "@/lib/db/indexes";

async function main() {
  const db = await getDb();
  await ensureIndexes(db);
  console.log(`Índices creados/verificados en la base "${db.databaseName}".`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Error creando índices:", error);
  process.exit(1);
});
