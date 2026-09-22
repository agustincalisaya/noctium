import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { RolUsuario } from "@prisma/client";

// next-auth no exporta `AppRouteHandlerFnContext` desde un subpath público
// (`next-auth/lib/types` no está en su `package.json#exports`) — se replica
// la forma mínima acá en vez de importar de una ruta interna no soportada.
type ContextoRuta = { params: Promise<unknown> };

const MENSAJES = {
  SESION_INVALIDA: "Tu sesión expiró. Iniciá sesión nuevamente",
  SIN_PERMISO: "No tenés permisos para acceder a esta sección",
} as const;

export class PermisoError extends Error {
  constructor(
    public readonly status: 401 | 403,
    public readonly code: "SESION_INVALIDA" | "SIN_PERMISO",
    message: string,
  ) {
    super(message);
    this.name = "PermisoError";
  }
}

async function verificarRolPermiso(rol: RolUsuario, accion: string): Promise<void> {
  // TODO(HU-A-03): acá también hay que rechazar si el jti del token está en
  // TokenRevocado antes de confiar en la sesión — la tabla existe, pero
  // HU-A-02 no la llena ni la consulta (decisión (a) del punto abierto,
  // docs/tasks/Sprint 1/HU-A-02.md sección 1).
  const permiso = await prisma.rolPermiso.findUnique({
    where: { rolPermiso_accionPermiso: { rolPermiso: rol, accionPermiso: accion } },
  });
  if (!permiso) {
    throw new PermisoError(403, "SIN_PERMISO", MENSAJES.SIN_PERMISO);
  }
}

function respuestaError(error: PermisoError): NextResponse {
  return NextResponse.json(
    { data: null, error: { code: error.code, message: error.message } },
    { status: error.status, headers: { "Cache-Control": "no-store, must-revalidate" } },
  );
}

/**
 * Valida sesión + permiso para uso dentro de un Server Action. A diferencia
 * de `withPermission()`, esto llama a `await auth()` sin envolver nada, así
 * que NO renueva la cookie de sesión (next-auth solo propaga el Set-Cookie
 * renovado vía middleware o vía el wrapper `auth(handler)` de Route
 * Handlers — ver next-auth/lib/index.js). Para esta HU no hay ningún Server
 * Action propio que necesite esto; queda disponible para módulos futuros.
 */
export async function verificarPermiso(
  accion: string,
): Promise<{ id: string; rol: RolUsuario }> {
  const session = await auth();
  if (!session?.user) {
    throw new PermisoError(401, "SESION_INVALIDA", MENSAJES.SESION_INVALIDA);
  }
  await verificarRolPermiso(session.user.rol, accion);
  return { id: session.user.id, rol: session.user.rol };
}

/**
 * Envuelve un Route Handler con la verificación de sesión + permiso
 * (spec_modulo_A.md §2.2, RULES.md Regla N.° 10): 401 SESION_INVALIDA si no
 * hay sesión válida, 403 SIN_PERMISO si el rol no tiene `accion` en
 * RolPermiso, y agrega `Cache-Control: no-store` a toda respuesta (criterio
 * de aceptación 6 de HU-A-02).
 *
 * Usa el wrapper `auth(handler)` — no `await auth()` suelto adentro del
 * handler — porque es la única forma en que next-auth reenvía al browser el
 * Set-Cookie con la sesión renovada (confirmado en next-auth/lib/index.js:
 * la forma sin argumentos de `auth()` calcula la renovación pero descarta
 * el Set-Cookie; el wrapper y el middleware sí lo propagan).
 */
export function withPermission(
  accion: string,
  handler: (req: NextAuthRequest, ctx: ContextoRuta) => Promise<Response>,
) {
  return auth(async (req, ctx) => {
    const session = req.auth;
    if (!session?.user) {
      return respuestaError(new PermisoError(401, "SESION_INVALIDA", MENSAJES.SESION_INVALIDA));
    }

    try {
      await verificarRolPermiso(session.user.rol, accion);
    } catch (error) {
      if (error instanceof PermisoError) return respuestaError(error);
      throw error;
    }

    const response = await handler(req, ctx);
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    return response;
  });
}
