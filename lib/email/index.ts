import { getEnv } from "@/lib/env";
import type { EmailSender } from "@/lib/email/EmailSender";
import { MailHogSender } from "@/lib/email/MailHogSender";
import { ResendSender } from "@/lib/email/ResendSender";

export type { EmailSender, SendEmailInput } from "@/lib/email/EmailSender";

let cachedSender: EmailSender | undefined;

/** Selecciona la implementación de EmailSender según EMAIL_PROVIDER. */
export function getEmailSender(): EmailSender {
  if (cachedSender) return cachedSender;

  const env = getEnv();

  if (env.EMAIL_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY es obligatorio cuando EMAIL_PROVIDER=resend");
    }
    cachedSender = new ResendSender({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
  } else {
    cachedSender = new MailHogSender({
      host: env.MAILHOG_HOST,
      port: env.MAILHOG_PORT,
      from: env.EMAIL_FROM,
    });
  }

  return cachedSender;
}
