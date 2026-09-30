export function magicLinkTemplate(verifyUrl: string): { subject: string; html: string; text: string } {
  const subject = "Tu enlace de acceso a Lottery";

  const text = [
    "Entra a tu cuenta de Lottery con este enlace:",
    verifyUrl,
    "",
    "El enlace expira pronto y solo funciona una vez.",
    "Si tú no pediste este correo, puedes ignorarlo.",
  ].join("\n");

  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
    <h1 style="font-size: 20px; margin-bottom: 16px; color: #0E1024;">Tu enlace de acceso</h1>
    <p style="font-size: 15px; line-height: 1.5; color: #333;">
      Toca el botón para entrar a tu cuenta de <strong>Lottery</strong>.
    </p>
    <p style="margin: 28px 0;">
      <a href="${verifyUrl}" style="background:#F2B705;color:#0E1024;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">
        Entrar a Lottery
      </a>
    </p>
    <p style="font-size: 13px; color: #777;">
      El enlace expira pronto y solo funciona una vez. Si tú no lo pediste, ignora este correo.
    </p>
  </div>`;

  return { subject, html, text };
}
