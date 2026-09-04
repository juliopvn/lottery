# 🎰 Sistema de Lotería — Next.js + Stripe + MongoDB

## 🎯 Objetivo del proyecto

Construir un sistema de **loterías online**: el administrador define sorteos, los usuarios compran boletos pagando con Stripe y el ganador recibe el premio por transferencia a su IBAN.

Con este proyecto el alumno aprende:

- A modelar un dominio con **reglas temporales** (cierre de ventas 10 minutos antes del sorteo).
- **Stripe Checkout + webhooks** para confirmar compras de forma fiable.
- A gestionar **concurrencia**: dos usuarios no pueden comprar el mismo número.
- Magic link + JWT (`jose`) como autenticación sin contraseñas.

## 🏗️ Arquitectura

```
┌────────────┐        ┌───────────────────┐        ┌──────────┐
│  Next.js   │ ─────► │   API Routes      │ ─────► │ MongoDB  │
│ user/admin │        │  loterías,        │        │ lottery  │
└────────────┘        │  tickets, perfil  │        └──────────┘
                      │       │  ▲
            Checkout  ▼       │  │ webhook (pago confirmado)
                  ┌──────────────────┐     ┌──────────┐
                  │      Stripe      │     │ MailHog  │ ← magic links
                  └──────────────────┘     └──────────┘
```

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16 + TypeScript + Tailwind, `GlobalContext`, `proxy.ts` |
| Base de datos | MongoDB driver nativo, BD `lottery`, dinero en céntimos |
| Pagos | Stripe Checkout + webhook |
| Auth | Magic link (MailHog) + JWT con `jose` |

### Colecciones MongoDB

| Colección | Campos clave |
|---|---|
| `users` | `email`, `role` (`user`\|`admin`), `iban`, `name` |
| `magic_links` | `email`, `token`, `expiresAt`, `used` |
| `lotteries` | `name`, `closesAt`, `ticketPriceCents`, `prizeCents`, `totalNumbers`, `status` (`open`\|`closed`\|`drawn`), `winnerNumber`, `winnerId` |
| `tickets` | `lotteryId`, `userId`, `number`, `paidAt`, `stripeSessionId` |

## ⚙️ Funcionalidades

**Admin**: crear loterías (nombre, fecha de cierre, precio del boleto, premio, cantidad de números); puede haber varias activas a la vez; ejecutar el sorteo.

**Usuario**: login con magic link, perfil con **IBAN** para cobrar el premio, compra de boletos vía Stripe (hasta 10 minutos antes del cierre), consulta de sus boletos y de los resultados.

## 💡 Solución

1. **La regla de los 10 minutos** se valida en el servidor comparando `closesAt - 10min` con la hora actual en el momento de crear la sesión de pago — nunca confíes en validaciones solo del cliente.
2. **El boleto no existe hasta que Stripe confirma**: el flujo es elegir número → Checkout Session → webhook de pago confirmado → se inserta el ticket. Así un pago abandonado no bloquea números.
3. **Número único por lotería**: un índice único compuesto (`lotteryId` + `number`) en `tickets` hace que la base de datos rechace compras duplicadas aunque lleguen a la vez.
4. **El sorteo** elige un número ganador entre los vendidos, marca la lotería como `drawn` y registra `winnerId`; el premio se paga por transferencia al IBAN del perfil (proceso manual del admin).
5. **Dinero siempre en céntimos** (`ticketPriceCents`, `prizeCents`).

## 🚀 Cómo ejecutar

1. Arranca MongoDB y MailHog; ten cuenta de prueba de Stripe.
2. Crea `.env.local`:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=lottery
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
MAILHOG_HOST=localhost
MAILHOG_PORT=1025
```

3. Instala, siembra y arranca:

```bash
npm install
npx tsx scripts/seed.ts
npm run dev
```

4. Webhooks en local: `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Magic links en [http://localhost:8025](http://localhost:8025).

<!-- BEGIN cc:que-se-valora -->
¡Hola! Aquí te explico qué es lo que miramos con lupa cuando corregimos tu proyecto "Lottery".

## 📋 Qué se valora

En tu proyecto, lo que más pesa es que todo funcione como se espera y que hayas cumplido con cada punto del enunciado. También es importante que tu código esté bien organizado y sea fácil de entender, eso tiene un peso importante. Tu vídeo demo también tiene un peso importante, así que asegúrate de que muestre bien tu trabajo. Finalmente, aunque con un peso menor, nos fijamos en cómo has documentado tus decisiones y el porqué de algunas elecciones que hayas hecho.

Recuerda que el enunciado es la guía principal y la evaluación no te penalizará por cosas que no se pidan explícitamente en él.
<!-- END cc:que-se-valora -->
