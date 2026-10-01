import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    // La respuesta nunca expone detalles de configuración, pero el motivo
    // real queda en los logs del servidor para poder diagnosticarlo.
    logger.error("health_check_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
