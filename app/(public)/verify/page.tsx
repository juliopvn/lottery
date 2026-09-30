import Link from "next/link";

const MESSAGES: Record<string, { title: string; body: string }> = {
  missing_token: {
    title: "Enlace incompleto",
    body: "Este enlace no trae el token de acceso. Ábrelo directamente desde el correo que te enviamos.",
  },
  invalid_or_expired: {
    title: "Enlace inválido o vencido",
    body: "Este enlace ya no es válido. Pide uno nuevo, los enlaces de acceso expiran por seguridad.",
  },
  already_used: {
    title: "Enlace ya utilizado",
    body: "Este enlace de acceso ya se usó una vez. Pide uno nuevo para volver a entrar.",
  },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error
    ? (MESSAGES[error] ?? {
        title: "No pudimos verificarte",
        body: "Ocurrió un problema con este enlace de acceso.",
      })
    : {
        title: "Verificando…",
        body: "Si no fuiste redirigido automáticamente, pide un nuevo enlace de acceso.",
      };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="lottery-ball h-12 w-12 bg-coral/15 text-coral">!</span>
      <h1 className="mt-4 font-display text-2xl text-ink">{message.title}</h1>
      <p className="mt-2 text-sm text-muted">{message.body}</p>
      <Link
        href="/login"
        className="mt-6 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-gold-ink"
      >
        Pedir un nuevo enlace
      </Link>
    </div>
  );
}
