import { z } from "zod";
import { MIN_TICKET_PRICE_CENTS } from "@/lib/domain/money";
import { MAX_TOTAL_NUMBERS, MIN_TOTAL_NUMBERS } from "@/lib/domain/ticket";

/**
 * La UI captura pesos (con decimales) y centavos enteros aquí; se convierte
 * a centavos antes de llegar a este schema (ver /lib/domain/money.ts).
 */
export const createLotterySchema = z.object({
  name: z.string().trim().min(3).max(120),
  closesAt: z.coerce.date().refine((date) => date.getTime() > Date.now(), {
    message: "closesAt debe estar en el futuro",
  }),
  ticketPriceCents: z.number().int().min(MIN_TICKET_PRICE_CENTS),
  prizeCents: z.number().int().min(0),
  totalNumbers: z.number().int().min(MIN_TOTAL_NUMBERS).max(MAX_TOTAL_NUMBERS),
});

export type CreateLotteryInput = z.infer<typeof createLotterySchema>;
