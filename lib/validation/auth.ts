import { z } from "zod";

export const requestLinkSchema = z.object({
  email: z.email(),
});
export type RequestLinkInput = z.infer<typeof requestLinkSchema>;
