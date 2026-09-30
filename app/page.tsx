import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";

const STEPS = [
  {
    n: "1",
    title: "Elige tu número",
    body: "Entra a una lotería abierta y elige un número disponible en la rejilla. Nadie más puede tenerlo hasta que tú lo compres.",
  },
  {
    n: "2",
    title: "Paga con Stripe",
    body: "El cobro se hace en Checkout de Stripe, en modo de prueba. Tu boleto no existe hasta que el pago se confirma.",
  },
  {
    n: "3",
    title: "Espera el sorteo",
    body: "Cuando cierra la venta, el administrador sortea entre los números vendidos con un generador aleatorio verificable.",
  },
  {
    n: "4",
    title: "Cobra por SPEI",
    body: "Si ganas, completa tu CLABE en tu perfil. El premio se transfiere manualmente, fuera de Stripe.",
  },
];

export default async function HomePage() {
  const session = await getCurrentSession();
  const primaryHref = session ? (session.role === "admin" ? "/admin" : "/lotteries") : "/login";
  const primaryLabel = session ? "Ver loterías" : "Entrar con enlace mágico";

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-gold">
            Sorteo #017 · Boletos numerados
          </p>
          <h1 className="font-display text-5xl italic leading-[1.05] text-ink sm:text-6xl">
            Un número.
            <br />
            Una oportunidad.
            <br />
            <span className="text-gold">Cero letras chiquitas.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
            Lottery vende boletos numerados para rifas con premio en pesos mexicanos. La venta
            cierra 10 minutos antes del sorteo, el pago se confirma con Stripe y el número
            ganador se elige con un sorteo verificable entre los boletos realmente vendidos.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={primaryHref}
              className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-gold-ink transition-transform hover:scale-[1.03]"
            >
              {primaryLabel}
            </Link>
            {!session && (
              <span className="text-xs text-muted-soft">
                Sin contraseñas: te enviamos un enlace de acceso a tu correo.
              </span>
            )}
          </div>
        </div>

        <div className="ticket-stub mx-auto flex w-full max-w-sm flex-col gap-6 px-8 py-10">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest text-muted">Boleto</span>
            <span className="font-mono text-xs text-muted-soft">MXN</span>
          </div>
          <div className="flex justify-center gap-3">
            {["0", "7", "1", "4"].map((digit, i) => (
              <span
                key={i}
                className="lottery-ball h-14 w-14 border border-border-strong bg-surface-2 text-2xl text-ink"
              >
                {digit}
              </span>
            ))}
          </div>
          <div className="ticket-perforation mx-auto" />
          <dl className="space-y-2 font-mono text-xs text-muted">
            <div className="flex justify-between">
              <dt>Cierre de venta</dt>
              <dd className="text-ink">−10 min antes del sorteo</dd>
            </div>
            <div className="flex justify-between">
              <dt>Número único</dt>
              <dd className="text-ink">Garantizado por índice en BD</dd>
            </div>
            <div className="flex justify-between">
              <dt>Pago abandonado</dt>
              <dd className="text-ink">No bloquea el número</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-24">
        <h2 className="font-display text-2xl italic text-ink">Cómo funciona</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div key={step.n} className="rounded-2xl border border-border bg-surface p-6">
              <span className="lottery-ball h-9 w-9 bg-surface-2 text-sm text-gold">{step.n}</span>
              <h3 className="mt-4 font-display text-lg text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
