import { z } from "zod";

export const CredencialesLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});
export type CredencialesLoginInput = z.infer<typeof CredencialesLoginSchema>;
