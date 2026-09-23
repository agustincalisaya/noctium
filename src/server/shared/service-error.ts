/**
 * Error tipado que lanza la capa de servicios (docs/RULES.md Regla N.° 4).
 * `code` es un identificador estable que la capa delgada (Route Handler,
 * Server Action) traduce a la respuesta/mensaje que corresponda — nunca
 * el texto final para el usuario, que no debería vivir en el servicio.
 * `detalles` (opcional, HU-D-03) transporta datos estructurados del error
 * — ej. qué materias fallaron — para que la capa delgada los exponga sin
 * tener que parsear `message`.
 */
export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
    public readonly detalles?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "ServiceError";
  }
}
