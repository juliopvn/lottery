/**
 * Logger estructurado mínimo (JSON por línea). Nunca registres CLABE, tokens
 * de magic link en claro, ni datos de tarjeta/Stripe sensibles.
 */
type LogFields = Record<string, string | number | boolean | null | undefined>;

function log(level: "info" | "warn" | "error", event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, fields?: LogFields) => log("info", event, fields),
  warn: (event: string, fields?: LogFields) => log("warn", event, fields),
  error: (event: string, fields?: LogFields) => log("error", event, fields),
};
