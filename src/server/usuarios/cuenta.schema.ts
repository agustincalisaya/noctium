import { z } from "zod";

/** Validación defensiva de `crearCuentaParaFicha` (spec_modulo_A.md §2.6.1): la ficha ya validó con sus reglas. */
export const CrearCuentaParaFichaSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido").max(254),
  dni: z.string().regex(/^\d+$/, "El DNI solo puede tener números"),
  rol: z.enum(["GERENTE", "MESA_ENTRADA", "PROFESOR", "ALUMNO"]),
});

export const EmailCuentaSchema = z.string().trim().toLowerCase().email("Ingresá un email válido").max(254);
