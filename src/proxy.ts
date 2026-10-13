import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { RUTA_PRIMER_INGRESO, rolPuedeAccederRuta, rutaAdmiteMarca } from "@/server/shared/rutas-por-rol";

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

  // Marca «Debe cambiar la contraseña» (HU-A-06, spec_modulo_A.md §2.6.2):
  // antes de cualquier otra pantalla. El proxy decide con la sesión (no
  // consulta la base); el servidor vuelve a decidir con la base en
  // withPermission/exigirPermiso.
  if (session.user.debeCambiarPassword && !rutaAdmiteMarca(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL(RUTA_PRIMER_INGRESO, request.nextUrl.origin));
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
    "/mi-historial/:path*",
    // HU-A-06: /home (destino del login, para que la marca no la saltee) y
    // las dos pantallas de contraseña. /formas-pago sigue fuera.
    "/home/:path*",
    "/primer-ingreso/:path*",
    "/mi-cuenta/:path*",
    // HU-F-01: personal de mesa de entrada (solo Gerente).
    "/personal/:path*",
    // HU-G-01: gerentes (solo Gerente).
    "/gerentes/:path*",
    // HU-I-11: comprobante de pago (mesa de entrada y gerente; el alumno, el suyo).
    "/comprobantes/:path*",
    "/mis-pagos/:path*",
    // HU-I-10: registrar pago (solo mesa de entrada)
    "/pagos/:path*",
    // HU-I-12: «Mi caja» (mesa de entrada) y «Cierres de caja» (gerente).
    "/caja/:path*",
    "/cajas/:path*",
  ],
};
