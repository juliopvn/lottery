# Prompt para agente: Implementación por fases de "Lottery" (Next.js + Stripe + MongoDB)

## Rol y forma de trabajo

Eres un ingeniero full-stack senior. Vas a implementar desde cero una app de loterías siguiendo **fases estrictas**. Reglas de trabajo:

1. **No avances de fase** hasta cumplir todos los criterios de salida de la fase actual (lint, typecheck y tests en verde). Al terminar cada fase, haz un commit con mensaje convencional (`feat:`, `chore:`, `test:`…) y resume qué hiciste y qué queda pendiente.
2. **No crees ni reescribas `README.md`**: ya existe en el repositorio. Solo lo modificarás en la Fase 12, y únicamente para añadir la sección de despliegue público.
3. **Nunca subas secretos** al repositorio. Solo `.env.example` con valores de ejemplo; `.env.local` y `.env*.local` deben estar en `.gitignore`.
4. Si una decisión no está cubierta por este documento y es difícil de revertir (esquema de datos, proveedor, dominio, borrado de datos), **detente y pregunta**.
5. Toda regla de negocio se valida **en el servidor**. El cliente solo mejora la UX.
6. Todo el dinero se maneja **en centavos enteros** (`ticketPriceCents`, `prizeCents`). Nunca floats. La moneda es **MXN**.
7. **Flujo de repositorio**: el código fuente vive en **GitLab** y se replica por *push mirroring* a **GitHub**. GitHub es el que ejecuta CI (GitHub Actions) y el que está conectado a Vercel. No configures nada que dependa de hacer push directamente a GitHub ni de Pull Requests en GitHub.

---

## Contexto del proyecto

### Objetivos de aprendizaje / problemas a resolver
- Modelar un dominio con **reglas temporales**: la venta cierra 10 minutos antes del sorteo.
- **Stripe Checkout + webhooks** para confirmar compras de forma fiable.
- **Concurrencia**: dos usuarios no pueden comprar el mismo número en la misma lotería.
- **Magic link + JWT (`jose`)** como autenticación sin contraseñas.

### Arquitectura

```
┌──────────────┐      ┌──────────────────────┐      ┌───────────┐
│  Next.js     │ ───▶ │  API Routes          │ ───▶ │  MongoDB  │
│  user/admin  │      │  loterías, tickets,  │      │  lottery  │
└──────────────┘      │  perfil              │      └───────────┘
                      └──────────────────────┘
               Checkout ▼        ▲ webhook (pago confirmado)
                      ┌──────────────────────┐   ┌───────────────────────┐
                      │       Stripe         │   │ MailHog (local)       │ ← magic links
                      └──────────────────────┘   │ Resend (producción)   │
                                                 └───────────────────────┘
```

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind, `GlobalContext`, `proxy.ts` (protección de rutas) |
| Base de datos | MongoDB driver nativo (sin Mongoose), BD `lottery`, dinero en centavos |
| Pagos | Stripe Checkout + webhook |
| Auth | Magic link (MailHog en local, Resend en producción) + JWT con `jose` en cookie httpOnly |
| Tests | Vitest (unitarios/integración) + Playwright (E2E) |
| CI/CD | GitHub Actions + Vercel |

### Colecciones MongoDB

| Colección | Campos clave |
|---|---|
| `users` | `email`, `role` (`user` \| `admin`), `clabe`, `name`, `createdAt` |
| `magic_links` | `email`, `token` (guardar hash, no el token en claro), `expiresAt`, `used` |
| `lotteries` | `name`, `closesAt`, `ticketPriceCents`, `prizeCents`, `totalNumbers`, `status` (`open` \| `closed` \| `drawn`), `winnerNumber`, `winnerId`, `drawnAt` |
| `tickets` | `lotteryId`, `userId`, `number`, `paidAt`, `stripeSessionId` |

Índices obligatorios:
- `users.email` único.
- `tickets` único compuesto `{ lotteryId: 1, number: 1 }` (garantía de número único).
- `tickets.stripeSessionId` único (idempotencia del webhook).
- `magic_links.expiresAt` TTL.
- `lotteries` por `{ status: 1, closesAt: 1 }`.

### Funcionalidades
- **Admin**: crear loterías (nombre, fecha de cierre, precio del boleto, premio, cantidad de números); puede haber varias activas a la vez; ejecutar el sorteo.
- **Usuario**: login con magic link; perfil con **CLABE** interbancaria (18 dígitos) para cobrar el premio; compra de boletos vía Stripe (hasta 10 minutos antes del cierre); consulta de sus boletos y de los resultados.

### Reglas de solución (no negociables)
1. **Regla de los 10 minutos**: se valida en el servidor comparando `closesAt - 10min` con la hora actual al crear la Checkout Session.
2. **El boleto no existe hasta que Stripe confirma**: elegir número → Checkout Session → webhook `checkout.session.completed` → insertar ticket. Un pago abandonado no bloquea números.
3. **Número único por lotería**: el índice único compuesto hace que la BD rechace compras duplicadas aunque lleguen a la vez.
4. **Sorteo**: elige un número ganador **entre los vendidos** (con `crypto.randomInt`), marca la lotería como `drawn` y registra `winnerNumber` y `winnerId`. El premio se paga por transferencia SPEI manual del admin a la CLABE del perfil. La CLABE no interviene en Stripe: Stripe solo cobra los boletos; el pago del premio es externo.
5. **Dinero siempre en centavos**.

### Casos límite que DEBES resolver explícitamente
- **Carrera de pago**: dos usuarios pagan el mismo número casi a la vez. El segundo insert falla por el índice único (`E11000`) → el webhook debe **reembolsar automáticamente** ese pago vía Stripe (`refunds.create`) y registrar el evento. Antes de crear la sesión, comprueba que el número no esté vendido (fallo rápido), pero la garantía real es el índice.
- **Pago que se completa tarde**: Stripe exige que una Checkout Session dure al menos 30 min, por lo que un pago puede completarse después del cierre. En el webhook: si la lotería ya no está `open` o `now >= closesAt`, reembolsa y no insertes ticket. Usa además `expires_at` lo más corto que permita Stripe.
- **Idempotencia del webhook**: Stripe puede reenviar eventos; el índice único en `stripeSessionId` debe hacer que un reenvío sea un no-op que responde 200.
- **Verificación de firma**: el webhook lee el body crudo y valida con `STRIPE_WEBHOOK_SECRET`; si falla, 400.
- **Sorteo sin boletos vendidos**: la lotería pasa a `drawn` sin ganador y la UI lo muestra.
- **Sorteo antes de tiempo**: solo se permite si `now >= closesAt`; debe ser atómico (`findOneAndUpdate` con `status: 'closed'|'open'` como condición) para evitar doble sorteo.
- **Cierre automático**: el estado `closed` se deriva de la hora (o se actualiza al leer/sortear); no dependas de un cron para la regla de venta.
- **Magic link**: un solo uso, expira (p. ej. 15 min), token aleatorio de 32 bytes guardado como hash SHA-256.
- **Ganador sin CLABE**: el admin ve un aviso; el usuario ve un aviso en su perfil pidiendo completarlo.

---

## Estructura de carpetas sugerida

```
/app
  /(public)/login, /verify
  /(user)/lotteries, /lotteries/[id], /my-tickets, /profile
  /(admin)/admin, /admin/lotteries/new, /admin/lotteries/[id]
  /api/auth/request-link, /api/auth/verify, /api/auth/logout
  /api/lotteries, /api/lotteries/[id], /api/lotteries/[id]/draw
  /api/tickets, /api/profile
  /api/stripe/checkout, /api/stripe/webhook
/lib
  /db (cliente Mongo singleton, índices, repositorios)
  /auth (jose, sesión, magic links)
  /email (interfaz EmailSender + MailHogSender + ResendSender)
  /stripe
  /domain (reglas puras: canBuy, validateNumber, pickWinner, money)
  /validation (zod)
/context/GlobalContext.tsx
/proxy.ts
/scripts/seed.ts
/tests/unit, /tests/integration
/e2e (Playwright)
docker-compose.yml
.env.example
AGENTS.md
```

La lógica de dominio (`/lib/domain`) debe ser **pura y testeable** sin BD ni red; inyecta el reloj (`now: Date`) como parámetro para poder probar la regla de los 10 minutos.

---

# BLOQUE A — LOCAL (objetivo: funcionar al 100% en local)

## Fase 0 — Andamiaje y tooling
- Inicializa Next.js 16 + TypeScript estricto + Tailwind + ESLint + Prettier.
- Añade Vitest, Playwright, `zod`, `jose`, `mongodb`, `stripe`, `nodemailer` (para MailHog), `resend`.
- `docker-compose.yml` con **MongoDB** (27017) y **MailHog** (SMTP 1025, UI 8025).
- Scripts en `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `seed`, `db:indexes`.
- Crea **`.env.example`** (ver sección dedicada) y **`AGENTS.md`** (ver sección dedicada).
- Validación de variables de entorno al arrancar con `zod` (`/lib/env.ts`) que falle con mensaje claro.

**Salida**: `npm run lint && npm run typecheck && npm run build` en verde; `docker compose up -d` levanta Mongo y MailHog.

## Fase 1 — Capa de datos, índices y seeds
- Cliente Mongo singleton (compatible con hot reload de Next).
- Tipos TS por colección y repositorios.
- `scripts/create-indexes.ts` idempotente con todos los índices listados.
- **`scripts/seed.ts`** idempotente (puede ejecutarse varias veces sin duplicar) y **exclusivo para local y CI**: debe abortar si `NODE_ENV=production` o si `MONGODB_URI` empieza por `mongodb+srv://` (Atlas). Flag `--reset` para limpiar la BD local. Datos:
  - 1 admin (`ADMIN_EMAIL` del env) y 3 usuarios (uno con CLABE válida de prueba, uno sin CLABE).
  - Loterías que cubran todos los estados y casos temporales:
    - abierta con cierre en varios días (compra permitida),
    - abierta con cierre en **5 minutos** (compra bloqueada por la regla de 10 min),
    - cerrada pendiente de sorteo con boletos vendidos,
    - sorteada con ganador,
    - sorteada sin boletos vendidos,
    - una con `totalNumbers` pequeño (p. ej. 10) casi agotada.
  - Boletos pagados distribuidos entre usuarios, con `stripeSessionId` ficticios con prefijo `seed_`.
- Script separado `seed:e2e` que genere un estado determinista para Playwright.

**Salida**: tests de integración (Vitest contra la Mongo de docker o `mongodb-memory-server`) que verifican que el índice único rechaza un número duplicado, incluso con inserciones concurrentes (`Promise.all`).

## Fase 2 — Autenticación (magic link + JWT)
- `POST /api/auth/request-link`: valida email, crea usuario si no existe (rol `user`), genera token, guarda hash y envía email mediante la interfaz `EmailSender`. Respuesta genérica (no revela si el email existe). Rate limit básico por email/IP.
- Interfaz `EmailSender` con implementación **MailHog** (SMTP) ahora; la de Resend se añade en la Fase 9. Se selecciona por `EMAIL_PROVIDER`.
- `GET /verify?token=…`: valida, marca `used`, emite JWT (HS256, `jose`) en cookie `httpOnly`, `secure` en prod, `sameSite=lax`, expiración 7 días.
- `proxy.ts`: protege `/(user)` y `/(admin)`; `/admin` y `/api/*` de admin exigen `role=admin` (verifícalo también en cada route handler, no solo en el proxy).
- `GlobalContext`: usuario actual, rol y helpers de sesión.
- Logout.
- **Bootstrap del admin sin seed**: al verificar un magic link, si el email coincide con `ADMIN_EMAIL`, el usuario se crea o actualiza con `role: 'admin'`. Así producción no necesita seed: el admin inicia sesión y ya tiene permisos.

**Salida**: tests unitarios de firma/verificación JWT y de expiración/uso único del magic link.

## Fase 3 — Admin: gestión de loterías
- Formulario y `POST /api/lotteries` con validación zod: `closesAt` en el futuro, precio y premio enteros en centavos (la UI acepta pesos y convierte), `totalNumbers` entre 1 y un máximo razonable.
- `ticketPriceCents` debe ser **≥ 1000** (Stripe exige un cargo mínimo de $10.00 MXN). Define el mínimo como constante en `/lib/domain/money.ts` y cúbrelo con un test.
- Listado admin con estado, boletos vendidos / total y recaudación.
- Detalle admin con lista de boletos.

## Fase 4 — Usuario: perfil y catálogo
- `/profile`: nombre y CLABE. Validación en `/lib/domain/clabe.ts` (pura y testeada): exactamente 18 dígitos y dígito de control correcto (pesos `3,7,1` repetidos sobre los 17 primeros dígitos, suma de `(dígito × peso) mod 10`, control = `(10 − suma mod 10) mod 10`). Opcional: mostrar el banco a partir de los 3 primeros dígitos. Mostrar enmascarada (`•••• •••• ••12 3456`).
- `/lotteries`: loterías abiertas con cuenta regresiva hasta el cierre de ventas (`closesAt - 10min`).
- `/lotteries/[id]`: rejilla de números con vendidos deshabilitados.
- `/my-tickets`: boletos del usuario y resultado de cada lotería.

## Fase 5 — Compra con Stripe (núcleo del proyecto)
- `POST /api/stripe/checkout` con `{ lotteryId, number }`:
  1. Sesión válida.
  2. Lotería `open` y `now < closesAt - 10min` (función pura `canBuy(lottery, now)`).
  3. Número en rango y no vendido.
  4. Crea Checkout Session con `metadata: { lotteryId, userId, number }`, `client_reference_id`, importe desde BD (nunca desde el cliente), `expires_at` mínimo permitido.
  5. Devuelve la URL de Stripe.
- `POST /api/stripe/webhook` (runtime Node, body crudo):
  - Verifica firma; maneja `checkout.session.completed`.
  - Revalida estado de la lotería; inserta ticket; en `E11000` por número → reembolso; en `E11000` por `stripeSessionId` → no-op.
  - Responde siempre rápido con 2xx tras procesar.
- Páginas `success` / `cancel`. En `success`, haz polling hasta que el ticket aparezca (el webhook puede tardar).

**Salida**: tests de integración del webhook con eventos firmados usando `stripe.webhooks.generateTestHeaderString`: pago normal, reenvío duplicado, número ya vendido (reembolso), pago tras cierre (reembolso), firma inválida.

## Fase 6 — Sorteo y resultados
- `POST /api/lotteries/[id]/draw` (admin): exige `now >= closesAt`, actualización atómica, `pickWinner` con `crypto.randomInt` sobre los boletos vendidos.
- Vista de resultados pública/usuario; el ganador ve un aviso destacado y, si no tiene CLABE, una llamada a completarlo.
- Vista admin con CLABE del ganador para la transferencia manual y un campo/estado "premio pagado" (opcional, pregunta antes de añadir campos al esquema).

## Fase 7 — Testing E2E (Playwright)
Configuración:
- `playwright.config.ts` con `webServer` que arranca la app, `globalSetup` que ejecuta `seed:e2e`.
- Helper que lee el magic link desde la **API de MailHog** (`GET http://localhost:8025/api/v2/messages`) para iniciar sesión sin intervención manual.
- Para pagos, dos estrategias:
  - **Por defecto (CI y local)**: tras crear la sesión, el test simula el webhook enviando un evento `checkout.session.completed` firmado con `STRIPE_WEBHOOK_SECRET` al endpoint real. Esto no depende de la página alojada de Stripe.
  - **Opcional local (`E2E_REAL_STRIPE=1`)**: recorrer Stripe Checkout con la tarjeta de prueba `4242 4242 4242 4242` con `stripe listen` activo.
- Un endpoint de soporte para tests (solo si `E2E=1`, nunca en producción) para manipular el reloj o crear loterías con `closesAt` concreto, si hace falta.

Escenarios mínimos:
1. Login por magic link (usuario y admin); acceso denegado a `/admin` para usuario normal.
2. Admin crea una lotería y aparece en el catálogo.
3. Usuario completa perfil con CLABE válida; CLABE con dígito de control incorrecto o longitud distinta de 18 muestra error.
4. Compra feliz: elige número → checkout → webhook → aparece en "Mis boletos" y el número queda deshabilitado.
5. Regla de 10 minutos: la lotería que cierra en 5 min no permite comprar (UI y API devuelven error).
6. Concurrencia: dos usuarios intentan el mismo número; solo uno obtiene el boleto y el otro recibe reembolso/aviso.
7. Admin ejecuta sorteo; el ganador lo ve en sus boletos; no se puede sortear dos veces.
8. Sorteo de una lotería sin ventas.
9. Pago abandonado (cancel) no bloquea el número.

**Criterio de salida del Bloque A**: con `docker compose up -d`, `npm run seed` y `npm run dev` + `stripe listen`, todo el flujo funciona manualmente; `lint`, `typecheck`, `test` y `test:e2e` en verde.

---

# BLOQUE B — PRODUCCIÓN

## Fase 8 — Preparación para producción
- Revisar que ninguna ruta de test/seed esté expuesta en producción.
- Cabeceras de seguridad básicas, cookies `secure`, `APP_URL` usado para construir magic links y URLs de éxito/cancelación de Stripe.
- Logs estructurados de webhook y sorteo (sin datos sensibles; CLABE nunca en logs).

## Fase 9 — Email con Resend
- Implementa `ResendSender` y selección por `EMAIL_PROVIDER=resend`.
- Remitente desde `EMAIL_FROM` en un dominio verificado en Resend.
- Plantilla simple del magic link (HTML + texto).

## Fase 10 — CI (GitHub Actions)
El repo llega a GitHub por *push mirroring* desde GitLab, así que los disparadores útiles son los `push` (los PR y merge requests viven en GitLab). **No actives en GitHub reglas de protección de rama con checks obligatorios**: bloquearían los pushes del mirror.

Workflow `.github/workflows/ci.yml` en `push` a cualquier rama y `workflow_dispatch`:
- Job `quality`: `npm ci`, `lint`, `typecheck`, `test` (unitarios + integración con service container de MongoDB).
- Job `e2e` (depende de `quality`): services `mongo` y `mailhog`, `npx playwright install --with-deps`, build, `seed:e2e`, `test:e2e`. Sube el reporte de Playwright como artifact si falla.
- Claves de Stripe **de prueba** como GitHub Secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` puede ser un valor fijo de test porque el webhook se simula).
- Cache de npm y de navegadores de Playwright.

## Fase 11 — CD y despliegue público (Vercel + Atlas + Cloudflare + Resend)
Dominio de producción: **`lottery.jpavon-tech.com`**. Stripe en **modo test** también en producción (proyecto de portafolio: nadie paga dinero real).

**Estrategia de despliegue: el CI decide.** Como no hay checks obligatorios en GitHub (ver Fase 10), Vercel no debe desplegar por su cuenta:
- `vercel.json` con `"git": { "deploymentEnabled": false }`.
- Workflow `.github/workflows/deploy.yml` que se dispara con `workflow_run` cuando `ci.yml` termina con éxito:
  - rama `main` → `vercel pull --environment=production`, `vercel build --prod`, `vercel deploy --prebuilt --prod`;
  - otras ramas → despliegue *preview* equivalente.
- Secrets de GitHub: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- Tras desplegar producción, un paso de smoke test hace `GET https://lottery.jpavon-tech.com/api/health` y falla el workflow si no responde 200.

El agente prepara los archivos; **las acciones en los paneles externos las hace el usuario** siguiendo un checklist que el agente debe entregar en `docs/deploy-checklist.md`, en este orden:

1. **GitHub**: crear el repo vacío y configurar el push mirroring desde GitLab (con un token de GitHub con permiso de escritura). Verificar que un push a GitLab aparece en GitHub y dispara `ci.yml`.
2. **MongoDB Atlas** (cluster existente):
   - Crear usuario de base de datos exclusivo con rol `readWrite` **solo** sobre `lottery` y `lottery_preview`.
   - Network Access: Vercel no tiene IPs fijas en planes estándar, así que se requiere `0.0.0.0/0` (la protección recae en el usuario y contraseña robustos).
   - Construir `MONGODB_URI` (`mongodb+srv://…`) sin nombre de BD en la ruta; el nombre va en `MONGODB_DB`.
   - Ejecutar solo `db:indexes` contra ambas BD (o crear los índices de forma idempotente al arrancar). **No se ejecuta ningún seed en producción**: el admin se obtiene por `ADMIN_EMAIL` al iniciar sesión y las loterías se crean desde la UI.
3. **Vercel**: crear el proyecto importando el repo de GitHub, obtener `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` (de `.vercel/project.json` tras `vercel link`), crear un token y cargar las variables de entorno:
   - Production: `APP_URL=https://lottery.jpavon-tech.com`, `MONGODB_DB=lottery`.
   - Preview: `APP_URL` con la URL de preview, `MONGODB_DB=lottery_preview`.
   - Ambos: `MONGODB_URI`, `JWT_SECRET` (distinto por entorno), `ADMIN_EMAIL`, claves de Stripe test, `STRIPE_CURRENCY=mxn`, `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`.
4. **Dominio**: añadir `lottery.jpavon-tech.com` en Vercel y, en **Cloudflare DNS**, crear el CNAME `lottery` hacia el destino que indique Vercel en modo **DNS only (nube gris)** para que Vercel emita el certificado SSL. Esperar a que Vercel lo marque como válido.
5. **Resend**: crear y verificar el subdominio de envío **`mail.jpavon-tech.com`**, añadiendo en Cloudflare los registros SPF, DKIM (y MX de retorno) que indique Resend, todos en modo DNS only. Remitente: `Lottery <no-reply@mail.jpavon-tech.com>`.
6. **Stripe (modo test)**: crear el endpoint de webhook `https://lottery.jpavon-tech.com/api/stripe/webhook` con el evento `checkout.session.completed`, copiar su `whsec_` a `STRIPE_WEBHOOK_SECRET` en Vercel Production y redesplegar. Las previews no reciben webhooks de Stripe; está bien.
7. Primer despliegue: push a `main` en GitLab → mirror → CI → deploy.

## Fase 12 — Verificación en producción y README
- `/api/health` comprueba conexión a Mongo y responde `{ status: "ok" }` sin exponer datos de configuración.
- Smoke test manual guiado en producción: login por magic link real (llega vía Resend), compra con la tarjeta de prueba `4242 4242 4242 4242`, webhook recibido en el panel de Stripe, boleto visible, sorteo como admin.
- **Actualiza el `README.md` existente** solo cuando el smoke test pase, añadiendo únicamente una sección "🌐 Despliegue público" con:
  - URL: https://lottery.jpavon-tech.com
  - Aviso de que los pagos son en modo test de Stripe (MXN) y la tarjeta de prueba a usar.
  - Badge del workflow `ci.yml` de GitHub.
  - Una línea sobre el flujo GitLab → GitHub (mirror) → GitHub Actions → Vercel.
  No modifiques el resto del contenido. El cambio se hace en GitLab (fuente), no en GitHub.

---

## `.env.example` a crear

```bash
# App
APP_URL=http://localhost:3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=lottery

# Auth
JWT_SECRET=cambia-esto-por-un-secreto-de-al-menos-32-caracteres
MAGIC_LINK_TTL_MINUTES=15
ADMIN_EMAIL=admin@example.com

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_CURRENCY=mxn

# Email: "mailhog" en local, "resend" en producción
EMAIL_PROVIDER=mailhog
EMAIL_FROM="Lottery <no-reply@mail.jpavon-tech.com>"
MAILHOG_HOST=localhost
MAILHOG_PORT=1025
RESEND_API_KEY=re_...

# Tests
E2E=0
E2E_REAL_STRIPE=0

# Despliegue (solo como GitHub Secrets, nunca en .env.local)
# VERCEL_TOKEN=
# VERCEL_ORG_ID=
# VERCEL_PROJECT_ID=
```

## `AGENTS.md` a crear

Debe servir de guía para cualquier agente que trabaje después en el repo. Contenido:
- Resumen del proyecto en 5 líneas y enlace a la arquitectura.
- Comandos: levantar servicios, seed, dev, `stripe listen`, tests unitarios y E2E, build.
- Mapa de carpetas y responsabilidad de cada una.
- **Invariantes que nunca se rompen**: dinero en centavos; regla de 10 minutos en servidor; ticket solo tras webhook; índice único `lotteryId+number`; webhook idempotente y con firma verificada; sorteo atómico; CLABE nunca en logs; los seeds solo corren en local y CI.
- Convenciones: TypeScript estricto, zod en toda entrada de API, lógica de dominio pura en `/lib/domain` con reloj inyectado, commits convencionales.
- Cómo añadir una variable de entorno (actualizar `lib/env.ts`, `.env.example`, Vercel y CI).
- Definición de "hecho": lint, typecheck, unit y E2E en verde; nuevo comportamiento cubierto por test.
- Qué no hacer: no reescribir `README.md`, no subir secretos, no ejecutar ningún seed contra Atlas.

---

## Datos del despliegue

- Dominio de producción: `lottery.jpavon-tech.com` (CNAME en Cloudflare, lo da de alta el usuario tras crear el proyecto en Vercel)
- Repositorio: fuente en GitLab `<grupo/repo>` → push mirror → GitHub `<owner/repo>` (**pendientes de definir**: el agente deja los placeholders y los pide antes de la Fase 12 para el badge del README)
- CI: GitHub Actions · CD: GitHub Actions → Vercel CLI (auto-deploy de Git en Vercel desactivado)
- Stripe: **modo test** en todos los entornos
- Moneda: **MXN** (cargo mínimo $10.00)
- Email: Resend con subdominio `mail.jpavon-tech.com`, remitente `no-reply@mail.jpavon-tech.com`
- Base de datos: cluster Atlas existente, BD `lottery` (prod) y `lottery_preview`, usuario dedicado con `readWrite` solo en ellas
- Admin: definido por `ADMIN_EMAIL` en cada entorno (en local, el del seed; en producción, el configurado en Vercel). Sin seed en producción.
- Datos bancarios del ganador: **CLABE** (18 dígitos), pago del premio por SPEI manual.

Empieza por la **Fase 0**. Al terminar cada fase, muestra el checklist de salida marcado y espera confirmación antes de pasar a la siguiente.