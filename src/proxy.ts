import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rolPuedeAccederRuta } from "@/server/shared/rutas-por-rol";

/**
 * Envuelve `auth()` en su forma de middleware (`auth((request) => {...})`,
 * mismo patrón que `withPermission()` en with-permission.ts) en vez de
 * `export { auth as proxy }` directo — es la forma que expone `request.auth`
 * ya resuelto, sin otro `await auth()` suelto adentro (que además no
 * propagaría el Set-Cookie de la renovación de sesión, mismo motivo
 * documentado en with-permission.ts).
 *
 * IMPORTANTE (verificado contra next-auth/lib/index.js `handleAuth()`, no
 * asumido): en cuanto se pasa acá una función (`userMiddlewareOrRoute`), el
 * resultado *booleano* de `callbacks.authorized` en auth.ts deja de decidir
 * nada — la rama que redirige a `/login` (`else if (!authorized)`) solo
 * corre cuando NO hay wrapper, que es el caso de hoy (`export { auth as
 * proxy }` sin argumentos). Por eso el caso "sin sesión" NO se delega a ese
 * callback (un `return undefined` acá lo dejaría pasar sin loguear un
 * `NextResponse.next()` fallback) — se resuelve directamente acá, replicando
 * el mismo redirect con `callbackUrl` que hacía esa rama.
 */
export const proxy = auth((request) => {
  const session = request.auth;

  if (!session?.user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.href);
    return NextResponse.redirect(loginUrl);
  }

  if (!rolPuedeAccederRuta(session.user.rol, request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/sin-permiso", request.nextUrl.origin));
  }

  return undefined;
});

// Protege las rutas del route group (dashboard); /login y /registro quedan libres.
// Las 4 rutas de pantalla principal por rol (mesa-entrada/profesor/gerente/
// alumno) las creó HU-A-01 y habían quedado fuera de este matcher (HU-A-02).
export const config = {
  matcher: [
    "/alumnos/:path*",
    "/profesores/:path*",
    "/materias/:path*",
    "/aulas/:path*",
    "/turnos/:path*",
    "/calendario/:path*",
    "/mesa-entrada/:path*",
    "/profesor/:path*",
    "/gerente/:path*",
    "/alumno/:path*",
  ],
};
