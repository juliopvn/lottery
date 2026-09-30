import { z } from "zod";

export const createCheckoutSchema = z.object({
  lotteryId: z.string().regex(/^[a-f0-9]{24}$/i, "lotteryId inválido"),
  number: z.number().int().positive(),
});
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
