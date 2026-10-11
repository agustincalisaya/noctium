import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextAuthRequest } from "next-auth";
import { auth, decodificarToken } from "@/auth";
import { prisma } from "@/lib/prisma";
import { texto } from "@/lib/textos";
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

/**
 * Únicas acciones que admite una cuenta con la marca «Debe cambiar la
 * contraseña» (spec_modulo_A.md §3.6 paso 4, P-A6). Cerrar sesión no pasa
 * por acá: `POST /api/auth/logout` no usa `withPermission`.
 */
const ACCIONES_ADMITIDAS_CON_MARCA: ReadonlySet<string> = new Set(["sesion:ping", "cuenta:cambiar_password"]);

export class PermisoError extends Error {
  constructor(
    public readonly status: 401 | 403,
    public readonly code: "SESION_INVALIDA" | "SIN_PERMISO" | "DEBE_CAMBIAR_PASSWORD",
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

/**
 * Claims de control del token vigente que usan los pasos 2 y 3: `jti`
 * (revocación por logout) e `iat_sesion` (revocación por cuenta). Se lee la
 * cookie una sola vez por solicitud.
 */
async function leerClaimsDeControl(): Promise<{ jti?: string; iatSesion?: number }> {
  const token = await leerTokenSesion();
  return {
    jti: token?.jti,
    iatSesion: typeof token?.iat_sesion === "number" ? token.iat_sesion : undefined,
  };
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

/**
 * Pasos 3 y 4 de `withPermission()` (spec_modulo_A.md §3.6 y §3.7), entre la
 * revocación por `jti` y el permiso del rol. Una sola lectura de la cuenta por
 * clave primaria:
 * - inexistente, inactiva, o sesión iniciada antes de `sesionesValidasDesde`
 *   → 401 SESION_INVALIDA, el mismo código y texto que un token vencido. Con
 *   `sesionesValidasDesde` fijado, un token sin `iat_sesion` también se
 *   rechaza: no hay forma de saber si es anterior. La comparación es estricta
 *   y en segundos (`revocarSesiones` guarda el instante truncado), así la
 *   sesión reemitida en el mismo segundo del cambio sigue viva;
 * - con la marca «Debe cambiar la contraseña» (valor de la base, nunca del
 *   token) y una acción distinta de las admitidas → 403 DEBE_CAMBIAR_PASSWORD.
 * Para una cuenta activa, sin revocación por cuenta y sin la marca, no cambia
 * nada respecto de Sprint 2.
 */
async function verificarEstadoCuenta(
  usuarioId: string,
  iatSesion: number | undefined,
  accion: string,
): Promise<void> {
  const cuenta = await prisma.usuario.findUnique({
    where: { idUsuario: usuarioId },
    select: { activoUsuario: true, sesionesValidasDesdeUsuario: true, debeCambiarPasswordUsuario: true },
  });
  if (!cuenta || !cuenta.activoUsuario) {
    throw new PermisoError(401, "SESION_INVALIDA", MENSAJES.SESION_INVALIDA);
  }

  if (cuenta.sesionesValidasDesdeUsuario) {
    const validasDesde = cuenta.sesionesValidasDesdeUsuario.getTime() / 1000;
    if (iatSesion === undefined || iatSesion < validasDesde) {
      throw new PermisoError(401, "SESION_INVALIDA", MENSAJES.SESION_INVALIDA);
    }
  }

  if (cuenta.debeCambiarPasswordUsuario && !ACCIONES_ADMITIDAS_CON_MARCA.has(accion)) {
    throw new PermisoError(403, "DEBE_CAMBIAR_PASSWORD", texto("errores.sesion.debeCambiarPassword"));
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

  const { jti, iatSesion } = await leerClaimsDeControl();
  // Orden no negociable (spec_modulo_A.md §2.2 / HU-A-03 §4.4 / §3.6):
  // revocación por jti, estado de la cuenta y recién después permiso, para
  // que un token cerrado o revocado nunca llegue a evaluarse por RBAC.
  await verificarNoRevocado(jti);
  await verificarEstadoCuenta(session.user.id, iatSesion, accion);
  await verificarRolPermiso(session.user.rol, accion);
  return { id: session.user.id, rol: session.user.rol };
}

/**
 * Variante de `verificarPermiso()` para Server Components (páginas): en vez
 * de lanzar `PermisoError`, redirige — sin sesión válida a `/login`, con la
 * marca «Debe cambiar la contraseña» a `/primer-ingreso` (spec_modulo_A.md
 * §3.6 paso 4), sin permiso a `/sin-permiso` (403, "No tenés permisos...").
 * Cualquier otro error se propaga al `error.tsx` del segmento.
 */
export async function exigirPermiso(accion: string): Promise<{ id: string; rol: RolUsuario }> {
  try {
    return await verificarPermiso(accion);
  } catch (error) {
    if (error instanceof PermisoError) {
      redirect(DESTINO_POR_CODIGO[error.code]);
    }
    throw error;
  }
}

const DESTINO_POR_CODIGO: Record<PermisoError["code"], string> = {
  SESION_INVALIDA: "/login",
  DEBE_CAMBIAR_PASSWORD: "/primer-ingreso",
  SIN_PERMISO: "/sin-permiso",
};

/**
 * `true` si la sesión actual tiene `accion`. Para decidir qué accesos mostrar
 * en una página ya autorizada; la acción real vuelve a verificar su permiso.
 */
export async function tienePermiso(accion: string): Promise<boolean> {
  try {
    await verificarPermiso(accion);
    return true;
  } catch (error) {
    if (error instanceof PermisoError) return false;
    throw error;
  }
}

/**
 * Envuelve un Route Handler con la verificación de sesión + revocación +
 * permiso (spec_modulo_A.md §2.2, RULES.md Regla N.° 10): 401
 * SESION_INVALIDA si no hay sesión válida, el token fue revocado
 * (logout, HU-A-03) o la cuenta está inactiva o con sus sesiones revocadas
 * (§3.6/§3.7), 403 DEBE_CAMBIAR_PASSWORD si la cuenta tiene la marca y la
 * acción no es una de las admitidas, 403 SIN_PERMISO si el rol no tiene
 * `accion` en RolPermiso, y agrega `Cache-Control: no-store` a toda respuesta
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
      const { jti, iatSesion } = await leerClaimsDeControl();
      await verificarNoRevocado(jti);
      await verificarEstadoCuenta(session.user.id, iatSesion, accion);
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
