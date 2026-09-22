import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { NextAuthRequest } from "next-auth";
import { auth, decodificarToken } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { RolUsuario } from "@prisma/client";

// Nombre de la cookie de sesión: next-auth decide el prefijo `__Secure-`
// mirando el protocolo de la request actual (`url.protocol === "https:"`,
// @auth/core/lib/init.js), no la config estática de `cookies.sessionToken`
// — así que en local (http) NUNCA lleva el prefijo aunque `secure: true`
// esté seteado, y en cualquier entorno servido por https sí lo lleva. Hay
// que aceptar los dos nombres en vez de asumir uno (esto rompió en la
// primera prueba real: `getToken({ secureCookie: true })` fuerza el nombre
// con prefijo y no encuentra nada en dev).
const NOMBRE_COOKIE_SESION = "authjs.session-token";
const NOMBRE_COOKIE_SESION_SECURE = "__Secure-authjs.session-token";

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

/**
 * Lee y decodifica el JWT crudo de la cookie de sesión vigente (claims
 * como `jti`/`exp` que `callbacks.session` nunca expone al cliente, ver
 * HU-A-02): toma la cookie directamente vía `cookies()` de `next/headers`
 * (funciona igual en Route Handlers, Server Actions y Server Components) y
 * la decodifica con el mismo `decode` HS256 custom de `@/auth` — sin pasar
 * por `getToken()`, que fuerza a adivinar el nombre exacto de la cookie.
 * Reutilizada por `app/api/auth/logout/route.ts` (necesita `exp` además
 * de `jti`, para poder revocar hasta el vencimiento original — HU-A-03).
 */
export async function leerTokenSesion() {
  const jar = await cookies();
  const raw =
    jar.get(NOMBRE_COOKIE_SESION_SECURE)?.value ?? jar.get(NOMBRE_COOKIE_SESION)?.value;
  if (!raw) return null;
  return decodificarToken({ token: raw });
}

async function leerJti(): Promise<string | undefined> {
  const token = await leerTokenSesion();
  return token?.jti;
}

/**
 * Paso 2 de `withPermission()` (spec_modulo_A.md §2.2, HU-A-03 §4.4): un
 * `jti` en `TokenRevocado` significa sesión cerrada explícitamente (logout)
 * aunque el JWT en sí todavía no haya vencido por tiempo. Se devuelve el
 * mismo código `SESION_INVALIDA` que un token vencido — el cliente no debe
 * poder distinguir "vencido" de "revocado".
 */
async function verificarNoRevocado(jti: string | undefined): Promise<void> {
  if (!jti) return;
  const revocado = await prisma.tokenRevocado.findUnique({ where: { jti } });
  if (revocado) {
    throw new PermisoError(401, "SESION_INVALIDA", MENSAJES.SESION_INVALIDA);
  }
}

async function verificarRolPermiso(rol: RolUsuario, accion: string): Promise<void> {
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

  const jti = await leerJti();
  // Orden no negociable (spec_modulo_A.md §2.2 / HU-A-03 §4.4): revocación
  // antes que permiso, para que un token cerrado nunca llegue a evaluarse
  // por RBAC.
  await verificarNoRevocado(jti);
  await verificarRolPermiso(session.user.rol, accion);
  return { id: session.user.id, rol: session.user.rol };
}

/**
 * Envuelve un Route Handler con la verificación de sesión + revocación +
 * permiso (spec_modulo_A.md §2.2, RULES.md Regla N.° 10): 401
 * SESION_INVALIDA si no hay sesión válida o el token fue revocado
 * (logout, HU-A-03), 403 SIN_PERMISO si el rol no tiene `accion` en
 * RolPermiso, y agrega `Cache-Control: no-store` a toda respuesta
 * (criterio de aceptación 6 de HU-A-02).
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
      const jti = await leerJti();
      await verificarNoRevocado(jti);
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
