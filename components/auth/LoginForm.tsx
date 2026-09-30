"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "loading" | "sent" | "error";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo enviar el enlace. Intenta de nuevo.");
      }

      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "No se pudo enviar el enlace.");
    }
  }

  if (status === "sent") {
    return (
      <div className="ticket-stub px-8 py-10 text-center">
        <span className="lottery-ball mx-auto h-12 w-12 bg-mint/15 text-mint">✓</span>
        <h2 className="mt-4 font-display text-xl text-ink">Revisa tu correo</h2>
        <p className="mt-2 text-sm text-muted">
          Si <strong className="text-ink">{email}</strong> tiene una cuenta, te enviamos un
          enlace de acceso. Ábrelo desde el mismo dispositivo para entrar.
        </p>
        <p className="mt-6 text-xs text-muted-soft">
          En local, revisa MailHog en{" "}
          <a href="http://localhost:8025" className="text-gold underline">
            localhost:8025
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="ticket-stub flex flex-col gap-4 px-8 py-10">
      <div>
        <h2 className="font-display text-xl text-ink">Entrar a Lottery</h2>
        <p className="mt-2 text-sm text-muted">
          Sin contraseñas. Escribe tu correo y te mandamos un enlace de acceso de un solo uso.
        </p>
      </div>

      <label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-muted">
        Correo electrónico
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="tu@correo.com"
        className="rounded-lg border border-border-strong bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-muted-soft focus:border-gold"
      />

      {error && <p className="text-sm text-coral">{error}</p>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-gold-ink transition-transform hover:scale-[1.02] disabled:opacity-60"
      >
        {status === "loading" ? "Enviando..." : "Enviarme el enlace"}
      </button>
    </form>
  );
}
