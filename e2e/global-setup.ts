import { execSync } from "node:child_process";

/** Ejecuta una vez antes de toda la suite: deja la BD en un estado determinista. */
export default function globalSetup(): void {
  execSync("npm run seed:e2e", { stdio: "inherit" });
}
