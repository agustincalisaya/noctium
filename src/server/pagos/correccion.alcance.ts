import type { RolUsuario } from "@prisma/client";
import { ahora } from "@/server/shared/reloj";

/**
 * Alcance de corrección y anulación de pagos (HU-I-06, spec_modulo_I.md
 * §2.14.1). Vive separado de `correccion.service.ts` porque no depende de
 * ningún otro módulo: así lo puede usar `pago.publico.ts` sin importar la
 * fachada de Turnos (Regla N.° 3). `correccion.service.ts` lo reexporta.
 */

export type UsuarioOperador = { id: string; rol: RolUsuario };

const DIAS_CORRECCION_MESA = 30;

/**
 * El Gerente corrige o anula cualquier pago no anulado; Mesa de Entrada, solo
 * uno registrado hace 30 días o menos y cuya caja siga abierta. El resto,
 * nunca. Las pantallas lo usan para mostrar los botones; el servidor lo vuelve
 * a evaluar con todo bloqueado.
 */
export function puedeCorregirPago(
  usuario: UsuarioOperador,
  pago: { anulado: boolean; registradoEn: Date; cajaAbierta: boolean },
  momento: Date = ahora(),
): boolean {
  if (pago.anulado) return false;
  if (usuario.rol === "GERENTE") return true;
  if (usuario.rol !== "MESA_ENTRADA") return false;
  const limite = momento.getTime() - DIAS_CORRECCION_MESA * 24 * 60 * 60 * 1000;
  return pago.registradoEn.getTime() >= limite && pago.cajaAbierta;
}
