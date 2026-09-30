# AGENTS.md — guía para agentes que trabajen en este repo

## Resumen del proyecto

**Lottery** es una app de loterías/rifas en Next.js 16 (App Router). Un admin crea
loterías con número de boletos, precio y premio; los usuarios inician sesión
sin contraseña (magic link), eligen un número y pagan con Stripe Checkout; el
boleto solo existe tras la confirmación del webhook de Stripe. Al cerrar la
venta (10 minutos antes del sorteo), el admin sortea un ganador entre los
boletos vendidos con `crypto.randomInt`, y el premio se paga por SPEI manual a
la CLABE del perfil del ganador. Ver la arquitectura completa y las reglas de
negocio en `PROMT.md`.

## Comandos

```bash
docker compose up -d        # Mongo (27017) + MailHog (SMTP 1025, UI 8025)
npm install
npm run db:indexes          # crea/verifica los índices (idempotente)
npm run seed                # datos de ejemplo para desarrollo local (idempotente)
npm run seed:reset          # igual, pero vacía las colecciones antes
npm run dev                 # http://localhost:3000
stripe listen --forward-to localhost:3000/api/stripe/webhook   # en otra terminal

npm run lint
npm run typecheck
npm run test                 # Vitest: unitarios + integración (mongodb-memory-server)
npm run test:watch
npm run seed:e2e             # dataset mínimo y determinista para Playwright
npm run test:e2e             # Playwright (levanta la app y corre seed:e2e solo)
npm run test:e2e:ui          # modo UI de Playwright

npm run build && npm run start
```

## Mapa de carpetas

| Ruta | Responsabilidad |
|---|---|
| `app/(public)` | `/`, `/login`, `/verify` — sin sesión |
| `app/(user)` | `/lotteries`, `/lotteries/[id]`, `/my-tickets`, `/profile` — requiere sesión |
| `app/(admin)` | `/admin`, `/admin/lotteries/new`, `/admin/lotteries/[id]` — requiere `role=admin` |
| `app/api/auth` | magic link (`request-link`, `verify`) y `logout` |
| `app/api/lotteries` | catálogo, alta y sorteo |
| `app/api/tickets`, `app/api/profile` | boletos y perfil del usuario logueado |
| `app/api/stripe` | creación de Checkout Session y webhook |
| `app/api/test` | **solo si `E2E=1`**: crear loterías con `closesAt` exacto y consultar el usuario de sesión, para Playwright |
| `lib/domain` | reglas puras (dinero, CLABE, regla de los 10 min, sorteo). Sin BD ni red; el reloj (`now`) se inyecta como parámetro |
| `lib/db` | cliente Mongo singleton, tipos, índices, repositorios por colección |
| `lib/auth` | JWT de sesión (`jose`), magic link (token + hash), cookies, guards de rol |
| `lib/email` | interfaz `EmailSender` + `MailHogSender`/`ResendSender`, elegido por `EMAIL_PROVIDER` |
| `lib/stripe` | cliente Stripe y creación de la Checkout Session |
| `lib/validation` | esquemas `zod` de entrada de cada API |
| `context/GlobalContext.tsx` | usuario de sesión en el cliente (id, email, rol, si ya tiene CLABE) |
| `proxy.ts` | protección de rutas (reemplaza a `middleware.ts` en Next 16); primera barrera, no la única |
| `scripts/` | `create-indexes.ts`, `seed.ts` (`--reset`, `--e2e`) |
| `tests/unit`, `tests/integration` | Vitest (dominio puro, JWT/magic link, índices únicos, webhook de Stripe, sorteo atómico) |
| `e2e/` | Playwright: helpers (`mailhog.ts`, `stripeWebhook.ts`, `testApi.ts`, `auth.ts`) + specs |

## Invariantes que nunca se rompen

1. **Dinero en centavos enteros** (`ticketPriceCents`, `prizeCents`). Nunca floats. Moneda MXN. Mínimo de boleto: `MIN_TICKET_PRICE_CENTS` (1000 = $10.00 MXN, exigido por Stripe).
2. **Regla de los 10 minutos** se valida en el servidor (`canBuy` en `lib/domain/lottery.ts`), nunca solo en el cliente.
3. **El boleto no existe hasta que el webhook de Stripe lo confirma.** Nada se reserva al crear la Checkout Session.
4. **Índice único `{ lotteryId, number }`** en `tickets` es la única garantía real de "un número, un dueño"; el chequeo previo en `/api/stripe/checkout` es solo un fallo rápido.
5. **Webhook idempotente y con firma verificada**: body crudo, `runtime = "nodejs"`, `stripe.webhooks.constructEvent`; un reenvío con el mismo `stripeSessionId` es un no-op (200).
6. **Sorteo atómico**: `drawLotteryAtomic` usa `findOneAndUpdate` con `status` en la condición del filtro para que dos sorteos concurrentes no puedan tener éxito los dos.
7. **CLABE nunca en logs.** `lib/logging/logger.ts` es el único logger estructurado; no le pases el objeto de usuario completo.
8. **Los seeds solo corren en local y CI.** `scripts/seed.ts` aborta si `NODE_ENV=production` o si `MONGODB_URI` empieza por `mongodb+srv://`. En producción no se ejecuta ningún seed: el admin se obtiene por `ADMIN_EMAIL` al iniciar sesión (`findOrCreateUserForLogin`).
9. **Toda entrada de API se valida con `zod`** (`lib/validation/*`), incluso si el cliente ya validó.
10. **`/api/test/*` nunca existe fuera de `E2E=1`**, y `E2E=1` nunca puede coexistir con `NODE_ENV=production` (validado en `lib/env.ts`).

## Convenciones

- TypeScript estricto (`strict`, `noUncheckedIndexedAccess`, etc. en `tsconfig.json`).
- Lógica de dominio pura en `lib/domain`, con el reloj inyectado (`now: Date`) para poder testear reglas temporales sin mockear `Date`.
- Los repositorios (`lib/db/repositories`) son la única capa que toca Mongo directamente; los route handlers no arman queries a mano.
- Commits convencionales (`feat:`, `fix:`, `chore:`, `test:`, `docs:`…).
- Server Components leen de los repositorios directamente; las mutaciones desde el cliente pasan por `app/api/*`.

## Cómo añadir una variable de entorno

1. Añádela (y su validación) a `lib/env.ts` (`envSchema`).
2. Documéntala con un valor de ejemplo en `.env.example`.
3. Si aplica en producción: agrégala en Vercel (Production y/o Preview, ver `docs/deploy-checklist.md`).
4. Si CI la necesita (build, tests o E2E): agrégala a `.github/workflows/ci.yml` (y a `deploy.yml` si el build de producción la requiere).

## Definición de "hecho"

- `npm run lint && npm run typecheck && npm run test && npm run build` en verde.
- Si el cambio afecta un flujo de usuario, `npm run test:e2e` también en verde.
- Todo comportamiento nuevo o modificado tiene un test (unitario, de integración o E2E, el que corresponda).
- No se rompió ninguno de los invariantes de la sección anterior.

## Qué NO hacer

- No reescribir `README.md` (solo se edita en la fase de despliegue, y solo para añadir la sección "🌐 Despliegue público").
- No subir secretos al repositorio. Solo `.env.example` con valores de ejemplo.
- No ejecutar ningún seed contra Atlas ni contra una URI `mongodb+srv://`.
- No añadir campos al esquema de datos sin confirmarlo antes: es una decisión difícil de revertir.
- No saltarse la validación del servidor confiando en que el cliente ya validó.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
