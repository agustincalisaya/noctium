import { z } from "zod";
import { texto } from "@/lib/textos";
import { CATALOGO } from "@/server/configuracion/parametros-configurables";

// Mismos mensajes que la validación de la pantalla: el 400 se muestra junto al campo.
const enteroEnRango = (clave: keyof typeof CATALOGO) => {
  const { min, max } = CATALOGO[clave];
  const enteroRequerido = texto("ui.configuracion.enteroRequerido");
  const fueraDeRango = texto("ui.configuracion.fueraDeRango", { min, max });
  return z.number({ error: enteroRequerido }).int({ error: enteroRequerido })
    .min(min, { error: fueraDeRango }).max(max, { error: fueraDeRango });
};

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
