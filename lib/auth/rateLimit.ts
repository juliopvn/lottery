/**
 * Rate limit básico en memoria, por clave (email o IP), ventana fija.
 *
 * Limitación conocida: es por instancia del proceso, no distribuido. En un
 * despliegue serverless con múltiples instancias esto es un "mejor esfuerzo",
 * no una garantía dura. Para un proyecto de portafolio es suficiente; una
 * capa real usaría Redis/Upstash compartido.
 */

interface Bucket {
  count: number;
  windowStartMs: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export function checkRateLimit(key: string, config: RateLimitConfig, now: Date = new Date()): boolean {
  const nowMs = now.getTime();
  const existing = buckets.get(key);

  if (!existing || nowMs - existing.windowStartMs >= config.windowMs) {
    buckets.set(key, { count: 1, windowStartMs: nowMs });
    return true;
  }

  if (existing.count >= config.maxRequests) {
    return false;
  }

  existing.count += 1;
  return true;
}
