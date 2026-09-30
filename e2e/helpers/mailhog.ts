const MAILHOG_API_URL =
  process.env.MAILHOG_API_URL ??
  `http://${process.env.MAILHOG_HOST ?? "localhost"}:8025`;

interface MailHogHeaders {
  [name: string]: string[];
}

interface MailHogPart {
  Headers: MailHogHeaders;
  Body: string;
}

interface MailHogItem {
  Created: string;
  Content: { Headers: MailHogHeaders; Body: string };
  MIME?: { Parts: MailHogPart[] } | null;
}

function decodeBody(headers: MailHogHeaders, body: string): string {
  const encoding = headers["Content-Transfer-Encoding"]?.[0]?.toLowerCase();

  if (encoding === "base64") {
    return Buffer.from(body.replace(/\r?\n/g, ""), "base64").toString("utf-8");
  }

  if (encoding === "quoted-printable") {
    return body
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  }

  return body;
}

const VERIFY_URL_PATTERN = /https?:\/\/[^\s"'<>]*\/api\/auth\/verify\?token=[a-f0-9]+/;

/**
 * Busca en MailHog el correo más reciente enviado a `email` y extrae la URL
 * de verificación del magic link. Reintenta hasta `timeoutMs` porque el envío
 * es asíncrono respecto al request que lo dispara.
 */
export async function waitForMagicLinkUrl(email: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await fetch(`${MAILHOG_API_URL}/api/v2/messages?limit=100`);
    if (response.ok) {
      const data = (await response.json()) as { items: MailHogItem[] };
      const matches = (data.items ?? []).filter((item) =>
        (item.Content.Headers.To?.[0] ?? "").toLowerCase().includes(email.toLowerCase())
      );
      matches.sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime());

      const latest = matches[0];
      if (latest) {
        const parts = latest.MIME?.Parts ?? [{ Headers: latest.Content.Headers, Body: latest.Content.Body }];
        for (const part of parts) {
          const decoded = decodeBody(part.Headers, part.Body);
          const match = decoded.match(VERIFY_URL_PATTERN);
          if (match) return match[0];
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(`No se encontró un magic link para "${email}" en MailHog tras ${timeoutMs}ms`);
}

/** Vacía la bandeja de MailHog; útil para aislar specs que revisan "el correo más reciente". */
export async function clearMailHog(): Promise<void> {
  await fetch(`${MAILHOG_API_URL}/api/v1/messages`, { method: "DELETE" });
}
