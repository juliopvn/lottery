import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI es obligatorio"),
  MONGODB_DB: z.string().min(1, "MONGODB_DB es obligatorio"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  MAGIC_LINK_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  ADMIN_EMAIL: z.email(),

  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY es obligatorio"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "STRIPE_WEBHOOK_SECRET es obligatorio"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY es obligatorio"),
  STRIPE_CURRENCY: z.string().default("mxn"),

  EMAIL_PROVIDER: z.enum(["mailhog", "resend"]).default("mailhog"),
  EMAIL_FROM: z.string().min(1, "EMAIL_FROM es obligatorio"),
  MAILHOG_HOST: z.string().default("localhost"),
  MAILHOG_PORT: z.coerce.number().int().positive().default(1025),
  RESEND_API_KEY: z.string().optional(),

  E2E: z.coerce.boolean().default(false),
  E2E_REAL_STRIPE: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Variables de entorno inválidas o faltantes:\n${issues}\n\nRevisa tu archivo .env.local contra .env.example.`
    );
  }

  if (parsed.data.EMAIL_PROVIDER === "resend" && !parsed.data.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY es obligatorio cuando EMAIL_PROVIDER=resend");
  }

  if (parsed.data.NODE_ENV === "production" && parsed.data.E2E) {
    throw new Error("E2E no puede estar activo en producción (NODE_ENV=production)");
  }

  return parsed.data;
}

/** Entorno validado y con tipos. Lanza en el primer acceso si falta o es inválido. */
export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = loadEnv();
  }
  return cachedEnv;
}
