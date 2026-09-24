/**
 * Bandera de módulo para las navegaciones duras que el sistema dispara por
 * su cuenta (sesión expirada, recarga por bfcache): no son una salida del
 * usuario, así que el `beforeunload` de `DirtyStateProvider` no debe
 * frenarlas con el diálogo nativo del navegador aunque haya cambios sin
 * guardar. Vive fuera del contexto de React porque `fetchAutenticado` no es
 * un componente.
 */
let salidaPermitida = false;

export function permitirSalidaSinConfirmar(): void {
  salidaPermitida = true;
}

export function esSalidaPermitida(): boolean {
  return salidaPermitida;
}
