/**
 * Error tipado que lanza la capa de servicios (docs/RULES.md Regla N.° 4).
 * `code` es un identificador estable que la capa delgada (Route Handler,
 * Server Action) traduce a la respuesta/mensaje que corresponda — nunca
 * el texto final para el usuario, que no debería vivir en el servicio.
 */
export class ServiceError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message ?? code);
    this.name = "ServiceError";
  }
}
