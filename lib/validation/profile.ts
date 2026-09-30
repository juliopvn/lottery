import { z } from "zod";
import { validateClabe } from "@/lib/domain/clabe";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  clabe: z
    .string()
    .trim()
    .refine((value) => validateClabe(value).valid, {
      message: "CLABE inválida: deben ser 18 dígitos con dígito de control correcto",
    })
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
