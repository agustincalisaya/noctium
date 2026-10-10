import { z } from "zod";
import { texto } from "@/lib/textos";
import { politicaPasswordSchema } from "@/server/shared/password.schema";

export const CredencialesLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});
export type CredencialesLoginInput = z.infer<typeof CredencialesLoginSchema>;

/**
 * Cambio de la propia contraseña (HU-A-06, spec_modulo_A.md §2.6.3): primer
 * ingreso y «Mi cuenta». Fábrica, igual que el autorregistro: la longitud
 * mínima sale de `password_longitud_minima` (ParametroSistema) y la resuelve
 * quien llama. La política es la de HU-B-08 tal cual (P-A10).
 * `password_actual` es opcional acá: la exige el servicio cuando la cuenta no
 * tiene la marca «Debe cambiar la contraseña» (P-A9). Un campo vacío del
 * formulario cuenta como ausente.
 */
export function construirCambiarPasswordSchema(passwordLongitudMinima: number) {
  return z
    .object({
      password_actual: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().min(1).optional()),
      password_nueva: politicaPasswordSchema(passwordLongitudMinima),
      confirmacion: z.string(),
    })
    .refine((v) => v.password_nueva === v.confirmacion, {
      message: texto("ui.sesion.formPassword.noCoinciden"),
      path: ["confirmacion"],
    });
}
export type CambiarPasswordInput = z.infer<ReturnType<typeof construirCambiarPasswordSchema>>;
