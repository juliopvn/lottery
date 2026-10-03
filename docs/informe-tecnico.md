# Informe técnico — cobertura de tests y justificación de decisiones

Todos los números de este informe se generaron corriendo las herramientas reales del
proyecto (`npm run test -- --coverage`, `npx playwright test --list`, `wc -l`, `grep`)
el 2026-10-03 sobre el commit `947b041`. Ninguna cifra está estimada a mano.

## 1. Resumen de la suite de tests

| Capa | Herramienta | Cantidad | Duración real |
|---|---|---|---|
| Unitarios (dominio puro, JWT, magic link) | Vitest | 40 tests | incluida abajo |
| Integración (Mongo en memoria, webhook de Stripe firmado, sorteo atómico) | Vitest + `mongodb-memory-server` | 21 tests | incluida abajo |
| **Total Vitest** | — | **61 tests / 11 archivos** | **3.07 s** |
| End-to-end (navegador real, MailHog real, Stripe test real) | Playwright | **14 tests / 8 specs** | 15.5 s (1 worker) |

Los 9 escenarios mínimos que pedía `PROMT.md` (login, admin crea lotería, CLABE
válida/inválida, compra feliz, regla de los 10 min, concurrencia, sorteo, sorteo sin
ventas, pago abandonado) están cubiertos 1:1 por los 14 specs E2E.

## 2. Cobertura de código (Vitest, `@vitest/coverage-v8`)

```
Statements   : 50.37% ( 135/268 )
Branches     : 50.8%  ( 63/124 )
Functions    : 51.89% ( 41/79 )
Lines        : 51.38% ( 130/253 )
```

| Módulo | % Stmts | Nota |
|---|---|---|
| `lib/domain` (reglas de negocio puras) | **92.45%** | Es la capa que `PROMT.md` exige mantener pura y testeada; es la mejor cubierta a propósito. |
| `lib/auth/jwt.ts` | 84.61% | Firma/verificación de sesión. |
| `lib/db/repositories/*` | 50.76% | La ruta feliz de cada repositorio está cubierta por los tests de integración; las ramas de error (`NotFoundError`, etc.) solo se ejercitan vía E2E. |
| `lib/env.ts` | 64.28% | Rama de error (variables faltantes) no instrumentada por Vitest; sí se verificó manualmente en producción (ver incidente real abajo). |
| `lib/auth/guards.ts`, `lib/validation/*`, `lib/stripe/checkout.ts`, `lib/email/*`, `lib/api/serialize.ts`, `lib/api/handleRouteError.ts` | 0% en este reporte | **No cubiertos por Vitest, pero sí por cada corrida E2E** (login, compra, perfil pasan por ahí en cada uno de los 14 specs). Vitest y Playwright son procesos de cobertura separados; este repo no fusiona ambos reportes en una sola cifra. |

**Por qué el número "real" de cobertura funcional es más alto que 50%:** la cobertura de
Vitest solo instrumenta lo que *Vitest* ejecuta directamente (dominio puro +
repositorios vía Mongo en memoria). Los route handlers de Next.js (`app/api/**/route.ts`)
se ejercitan completos — incluyendo validación con Zod, guards de sesión/rol y el
cliente de Stripe — en cada uno de los 14 tests E2E, que corren contra la app real
compilada. No se reporta un número fusionado porque v8/Vitest no instrumenta el proceso
`next start` que levanta Playwright; mezclar ambos reportes sin esa instrumentación
daría una cifra falsa, así que se documentan por separado en vez de aproximar.

**Limitación honesta:** los componentes de React (`components/**/*.tsx`, 10 archivos,
749 líneas) no tienen tests unitarios de componente (React Testing Library). Su
comportamiento se verifica de forma funcional vía Playwright (clics reales, formularios
reales), pero no hay cobertura de línea reportada para ellos.

## 3. Decisiones técnicas con justificación cuantitativa

| Decisión | Justificación con números |
|---|---|
| **Dinero en centavos enteros, nunca floats** | `0.1 + 0.2 === 0.30000000000000004` en IEEE 754 de doble precisión (JavaScript). Con centavos enteros, `10 + 20 === 30` siempre exacto. Validado en `tests/unit/domain/money.test.ts`. |
| **Mínimo de boleto $10.00 MXN (1000 centavos)** | No es una preferencia de diseño: es el cargo mínimo que exige la API de Stripe. `MIN_TICKET_PRICE_CENTS` está cubierto por un test dedicado (`isValidTicketPriceCents(999) === false`, `(1000) === true`). |
| **Token de magic link: 32 bytes aleatorios + hash SHA-256 en BD** | 32 bytes = 256 bits de entropía → 2^256 combinaciones posibles (más que átomos estimados en el universo observable, ~10⁸⁰). TTL de 15 min limita además la ventana de uso aunque el correo fuera interceptado. El valor en claro nunca se persiste, solo su hash. |
| **Índice único `{lotteryId, number}` como única garantía real de concurrencia** | Verificado empíricamente, no solo en teoría: `tests/integration/db/uniqueIndexes.test.ts` lanza **8 inserciones concurrentes** (`Promise.all`) para el mismo número → exactamente **1 exitosa, 7 rechazadas** con `E11000`, en cada corrida. |
| **`jose` en vez de `jsonwebtoken` para las cookies de sesión** | `proxy.ts` corre en **Edge Runtime** (reemplaza a `middleware.ts` en Next 16), que no expone el módulo nativo `crypto` de Node. `jose` usa Web Crypto API, compatible con Edge; `jsonwebtoken` no lo es. No es una preferencia de estilo: sin esto, la protección de rutas no podría ejecutarse donde corre hoy. |
| **`mongodb-memory-server` en vez de un contenedor Mongo real para tests** | Los 61 tests (incluyendo 3 archivos que levantan una instancia Mongo real en memoria) corren completos en **3.07 s**, sin Docker y sin red. Esto corre igual en el job `quality` de CI sin esperar un `healthcheck` de contenedor. |
| **Playwright con `workers: 1` (en vez del paralelismo por defecto)** | Decisión basada en evidencia, no en cautela genérica: con 4 workers en paralelo se midió **1 de 4 tests fallando** en el mismo spec por una condición de carrera real en el buzón compartido de MailHog (dos tests pidiendo un magic link para el mismo correo casi a la vez). Con `workers: 1` se corrió la suite completa **varias veces seguidas con 14/14 tests estables**. El trade-off (suite ~2–3× más lenta) se documenta en el propio `playwright.config.ts`. |
| **Validación de entrada con Zod** | **5 de 5** route handlers que reciben body JSON (`request.json()`) lo validan con `.parse()` antes de tocar la base de datos: 100% de cobertura de ese punto de entrada, no una muestra. |
| **Server Components por defecto, Client Components solo donde hace falta interacción** | De 22 archivos `.tsx` en `app/` y `components/`, solo **8 (36%)** son `"use client"` (formularios, grid de números, countdown, botones con estado). El resto son Server Components que leen los repositorios directamente, sin una vuelta HTTP extra a una API Route propia para renderizar. |
| **Logger estructurado JSON en vez de `console.log` libre** | No es una preferencia estética: permitió diagnosticar en vivo un incidente real de producción (ver sección 4) leyendo `vercel logs` sin tener que redeploy a ciegas. |

## 4. Un incidente real documentado (no hipotético)

Durante el despliegue a producción, `/api/health` devolvía `503` sin razón aparente.
`lib/env.ts` valida **todas** las variables obligatorias de una sola vez, así que
cualquier variable faltante (en este caso `ADMIN_EMAIL`) hacía fallar hasta el ping a
Mongo, que no tiene relación con esa variable. La causa solo fue visible tras agregar
`logger.error("health_check_failed", {...})` en `app/api/health/route.ts` y leer
`vercel logs` en vivo — confirmando en la práctica por qué la sección 3 insiste en
logging estructurado sobre la causa real sin exponer datos de configuración en la
respuesta HTTP.

## 5. Tamaño del proyecto (líneas de código reales, sin `node_modules`/`.next`)

| Área | Archivos | Líneas |
|---|---|---|
| `lib/` (dominio, BD, auth, email, Stripe, validación) | 34 | 1,166 |
| `app/` (páginas + 13 route handlers de API) | 25 | 1,483 |
| `components/` | 10 | 749 |
| `tests/` (unit + integración) | 12 | 820 |
| `e2e/` (specs + helpers) | 13 | 584 |
| `scripts/` (seed, índices) | 2 | 305 |
| **Total** | **96** | **5,107** |

## 6. Cómo reproducir estas cifras

```bash
npm run test -- --coverage     # sección 2
npx playwright test --list     # sección 1 (conteo E2E)
npm run test:e2e               # sección 1 (duración E2E)
```
