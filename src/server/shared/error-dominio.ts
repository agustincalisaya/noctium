import { texto } from "@/lib/textos";
import { CODIGOS_SPRINTS_1_Y_2, ERRORES_DE_DOMINIO, type CodigoErrorDominio } from "@/server/shared/errores-dominio";
import { ServiceError } from "@/server/shared/service-error";

/**
 * Error de los servicios de dominio del Sprint 3 (PR-0.md §2.13).
 *
 * Extiende `ServiceError`, así los Route Handlers existentes lo siguen mapeando
 * por `error.code` sin cambios:
 *  - `codigo`: clave del archivo central de textos (`src/lib/textos.ts`);
 *  - `code`: el código estable que ve la API (el de hoy si la condición ya existía);
 *  - `status`: el HTTP del catálogo (`errores-dominio.ts`);
 *  - `message`: el texto de la clave, con los huecos completados con `datos`;
 *  - `datos`: datos estructurados del error, expuestos también como `detalles`
 *    (por ejemplo `{ alumno_id }` de ALUMNO_NO_DISPONIBLE).
 */
export class ErrorDeDominio extends ServiceError {
  readonly codigo: CodigoErrorDominio;
  readonly status: number;
  readonly datos?: Record<string, unknown>;

  constructor(codigo: CodigoErrorDominio, datos?: Record<string, unknown>) {
    const { code, status } = ERRORES_DE_DOMINIO[codigo];
    super(code, texto(codigo, datos), datos);
    this.name = "ErrorDeDominio";
    this.codigo = codigo;
    this.status = status;
    this.datos = datos;
  }
}

export function esErrorDeDominio(error: unknown, codigo?: CodigoErrorDominio): error is ErrorDeDominio {
  return error instanceof ErrorDeDominio && (codigo === undefined || error.codigo === codigo);
}

/**
 * HTTP con el que un Route Handler existente responde un error: el del
 * catálogo si es un `ErrorDeDominio` con un `code` nuevo del PR 0 (por
 * ejemplo MATERIA_SIN_TARIFA 422 o TRANSACCION_OCUPADA 409); `null` para
 * los `code` que ya existían en los Sprints 1 y 2 (conservan su respuesta
 * de hoy, 1.1) y para cualquier otro error.
 */
export function statusDeErrorNuevo(error: unknown): number | null {
  return error instanceof ErrorDeDominio && !CODIGOS_SPRINTS_1_Y_2.has(error.code) ? error.status : null;
}
