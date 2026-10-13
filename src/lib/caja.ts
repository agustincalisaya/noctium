import { texto } from "@/lib/textos";
import { fechaHoraDeInstante, monto } from "@/lib/turno-detalle";
import type { TipoDiferenciaCaja } from "@/types/caja.types";

/**
 * Formatos de la caja (HU-I-12): funciones puras, sin React, compartidas por
 * «Mi caja», «Cierres de caja», el cierre en dos pasos y el detalle impreso.
 * Los montos llegan de la API como texto decimal con signo ("-1500.00").
 */

/** Mismo formato que el servidor (`AbrirCajaSchema`/`DeclararEfectivoSchema`): ≥ 0 y hasta 2 decimales. */
export const MONTO_NO_NEGATIVO = /^\d{1,9}(\.\d{1,2})?$/;

/** Normaliza lo que escribió el usuario: coma decimal → punto, sin espacios. */
export function normalizarMonto(valor: string): string {
  return valor.trim().replace(",", ".");
}

export function montoNoNegativoValido(valor: string): boolean {
  return MONTO_NO_NEGATIVO.test(normalizarMonto(valor));
}

/** "-1500.00" → "− $ 1.500"; "12000.00" → "$ 12.000". */
export function montoConSigno(valor: string): string {
  const negativo = valor.trim().startsWith("-");
  const absoluto = monto(valor.trim().replace(/^[-+]/, ""));
  return negativo && Number(valor) !== 0 ? `− ${absoluto}` : absoluto;
}

/** Valor absoluto formateado: "-1500.00" → "$ 1.500". */
export function montoAbsoluto(valor: string): string {
  return monto(valor.trim().replace(/^[-+]/, ""));
}

/** Criterio 7: «Sobrante de $ 1.500», «Faltante de $ 1.500» o «La caja cuadra». */
export function textoDiferencia(tipo: TipoDiferenciaCaja, diferencia: string): string {
  if (tipo === "CUADRA") return texto("ui.caja.diferencia.cuadra");
  return texto(tipo === "SOBRANTE" ? "ui.caja.diferencia.sobrante" : "ui.caja.diferencia.faltante", { monto: montoAbsoluto(diferencia) });
}

/** Texto de la diferencia en minúscula inicial, para el toast «Caja cerrada · la caja cuadra». */
export function textoDiferenciaEnFrase(tipo: TipoDiferenciaCaja, diferencia: string): string {
  const completo = textoDiferencia(tipo, diferencia);
  return completo.charAt(0).toLocaleLowerCase("es-AR") + completo.slice(1);
}

/** Confirmación de HU-C-25 (criterio 8): la leyenda irreversible la agrega `ConfirmarAccionDialog`. */
export function confirmacionCierre(tipo: TipoDiferenciaCaja, diferencia: string, integrante?: string): string {
  if (tipo === "CUADRA") {
    return integrante
      ? texto("confirmaciones.caja.cerrarAusenciaSinDiferencia", { integrante })
      : texto("confirmaciones.caja.cerrarSinDiferencia");
  }
  const frase = texto(tipo === "SOBRANTE" ? "confirmaciones.caja.sobrante" : "confirmaciones.caja.faltante", { monto: montoAbsoluto(diferencia) });
  return integrante
    ? texto("confirmaciones.caja.cerrarAusencia", { integrante, diferencia: frase })
    : texto("confirmaciones.caja.cerrar", { diferencia: frase });
}

/** Instante ISO → «dd/mm/aaaa hh:mm» en la zona del centro. */
export function fechaHoraCaja(instante: string): string {
  return fechaHoraDeInstante(instante).replace(", ", " ");
}

/** Antigüedad de una caja abierta: «45 minutos», «3 horas», «2 días». */
export function antiguedad(minutos: number): string {
  if (minutos < 60) return minutos === 1 ? texto("ui.cajas.antiguedad.minuto") : texto("ui.cajas.antiguedad.minutos", { n: minutos });
  const horas = Math.floor(minutos / 60);
  if (horas < 48) return horas === 1 ? texto("ui.cajas.antiguedad.hora") : texto("ui.cajas.antiguedad.horas", { n: horas });
  const dias = Math.floor(horas / 24);
  return dias === 1 ? texto("ui.cajas.antiguedad.dia") : texto("ui.cajas.antiguedad.dias", { n: dias });
}
