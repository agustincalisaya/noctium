/**
 * Fachada de la caja del módulo I (spec_modulo_I.md §2.17): `cajaAbiertaDe`
 * para los otros módulos (HU-F-05 la consulta antes de desactivar a un
 * integrante). Solo reexporta el servicio del propio módulo.
 */
export { cajaAbiertaDe, type CajaAbierta } from "@/server/pagos/caja.service";
