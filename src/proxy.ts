export { auth as proxy } from "@/auth";

// Protege las rutas del route group (dashboard); /login y /registro quedan libres.
// TODO: autorización por rol, HU por HU.
export const config = {
  matcher: [
    "/alumnos/:path*",
    "/profesores/:path*",
    "/materias/:path*",
    "/aulas/:path*",
    "/turnos/:path*",
    "/calendario/:path*",
  ],
};
