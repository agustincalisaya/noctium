import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { crearIdentidadAlumnoSchema, ListarAlumnosQuerySchema } from "@/server/alumnos/alumno.schema";
import { crearAlumno, listarAlumnos } from "@/server/alumnos/alumno.service";
import { ServiceError } from "@/server/shared/service-error";
import { getParametroNumerico } from "@/server/shared/parametros";

// Listado de alumnos (HU-B-04, spec_modulo_B.md §2.4).
export const GET = withPermission("alumnos:leer", async (req) => {
  const parsed = ListarAlumnosQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDACION", message: "Parámetros inválidos", detalles: parsed.error.flatten() },
      },
      { status: 400 },
    );
  }

  const data = await listarAlumnos(parsed.data);
  return NextResponse.json({ data, error: null });
});

export const POST = withPermission("alumnos:crear", async (req) => {
  const body = await req.json().catch(() => null);

  const [dniLongitudMin, dniLongitudMax] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);

  const parsed = crearIdentidadAlumnoSchema(dniLongitudMin, dniLongitudMax).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() },
      },
      { status: 400 },
    );
  }

  try {
    // withPermission() ya garantizó que req.auth.user existe.
    const alumno = await crearAlumno(parsed.data, req.auth!.user.id);
    return NextResponse.json(
      {
        data: {
          id: alumno.idAlumno,
          nombre: alumno.nombreAlumno,
          apellido: alumno.apellidoAlumno,
          dni: alumno.dniAlumno,
          activo: alumno.activoAlumno,
        },
        error: null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    }
    throw error;
  }
});
