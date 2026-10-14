import { z } from "zod";
import { CATALOGO } from "@/server/configuracion/parametros-configurables";

const enteroEnRango = (clave: keyof typeof CATALOGO) =>
  z.number().int().min(CATALOGO[clave].min).max(CATALOGO[clave].max);

const valoresSchema = z.object({
  plazoPagoHoras: enteroEnRango("plazo_pago_horas"),
  cancelacionAnticipacionHoras: enteroEnRango("cancelacion_anticipacion_horas"),
  umbralPresentismo: enteroEnRango("umbral_presentismo"),
}).strict();

export const GuardarConfiguracionSchema = z.object({
  valores: valoresSchema,
  esperados: valoresSchema,
}).strict();

export type GuardarConfiguracionInput = z.infer<typeof GuardarConfiguracionSchema>;

export const ListarHistorialQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
}).strict();
