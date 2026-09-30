import { Resend } from "resend";
import type { EmailSender, SendEmailInput } from "@/lib/email/EmailSender";

export class ResendSender implements EmailSender {
  private readonly client: Resend;

  constructor(private readonly config: { apiKey: string; from: string }) {
    this.client = new Resend(config.apiKey);
  }

  async send(input: SendEmailInput): Promise<void> {
    const result = await this.client.emails.send({
      from: this.config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (result.error) {
      throw new Error(`Resend rechazó el envío: ${result.error.message}`);
    }
  }
}
