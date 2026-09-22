export { auth as proxy } from "@/auth";

// Protege las rutas del route group (dashboard); /login y /registro quedan libres.
// Las 4 rutas de pantalla principal por rol (mesa-entrada/profesor/gerente/
// alumno) las creó HU-A-01 y habían quedado fuera de este matcher (HU-A-02).
// TODO: autorización por rol, HU por HU.
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
