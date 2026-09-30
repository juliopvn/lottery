import nodemailer from "nodemailer";
import type { EmailSender, SendEmailInput } from "@/lib/email/EmailSender";

export class MailHogSender implements EmailSender {
  constructor(
    private readonly config: { host: string; port: number; from: string }
  ) {}

  async send(input: SendEmailInput): Promise<void> {
    const transport = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: false,
      ignoreTLS: true,
    });

    await transport.sendMail({
      from: this.config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      // Base64 evita que las líneas largas (el magic link) se partan con
      // saltos "=\r\n" de quoted-printable, lo que complicaría extraer la
      // URL completa al leer el correo desde la API de MailHog en E2E.
      encoding: "base64",
    });
  }
}
