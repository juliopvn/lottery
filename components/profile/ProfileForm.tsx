"use client";

import { useState, type FormEvent } from "react";

interface Profile {
  email: string;
  name: string;
  hasClabe: boolean;
  clabeMasked: string | null;
  bankHint: string | null;
}

export function ProfileForm({ initialProfile }: { initialProfile: Profile }) {
  const [name, setName] = useState(initialProfile.name);
  const [clabe, setClabe] = useState("");
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const payload: { name?: string; clabe?: string } = { name };
    if (clabe.trim().length > 0) payload.clabe = clabe.trim();

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudo guardar tu perfil.");
      }

      setProfile(body.profile);
      setClabe("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar tu perfil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ticket-stub px-8 py-10">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted">Correo</p>
        <p className="mt-1 text-sm text-ink">{profile.email}</p>
      </div>

      <div className="mb-6 rounded-lg border border-border-strong bg-surface-2 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted">CLABE registrada</p>
        {profile.hasClabe ? (
          <p className="mt-1 font-mono text-sm text-ink">
            {profile.clabeMasked}
            {profile.bankHint && <span className="ml-2 text-xs text-muted">({profile.bankHint})</span>}
          </p>
        ) : (
          <p className="mt-1 text-sm text-coral">
            No has registrado una CLABE. Si ganas, la necesitarás para recibir tu premio por SPEI.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="name" className="text-xs font-medium uppercase tracking-wide text-muted">
            Nombre
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border-strong bg-surface-2 px-4 py-3 text-sm text-ink focus:border-gold"
            placeholder="Tu nombre completo"
          />
        </div>

        <div>
          <label htmlFor="clabe" className="text-xs font-medium uppercase tracking-wide text-muted">
            {profile.hasClabe ? "Actualizar CLABE (18 dígitos)" : "CLABE interbancaria (18 dígitos)"}
          </label>
          <input
            id="clabe"
            inputMode="numeric"
            value={clabe}
            onChange={(e) => setClabe(e.target.value.replace(/\D/g, "").slice(0, 18))}
            className="mt-1 w-full rounded-lg border border-border-strong bg-surface-2 px-4 py-3 font-mono text-sm text-ink focus:border-gold"
            placeholder="032180000118359719"
          />
        </div>

        {error && <p className="text-sm text-coral">{error}</p>}
        {success && <p className="text-sm text-mint">Perfil actualizado.</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-2 self-start rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-gold-ink transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
