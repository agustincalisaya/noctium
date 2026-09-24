import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { construirModificarAlumnoSchema } from "@/server/alumnos/alumno.schema";
import { modificarAlumno, obtenerDetalleAlumno } from "@/server/alumnos/alumno.service";
import { ServiceError } from "@/server/shared/service-error";
import { getParametroNumerico } from "@/server/shared/parametros";

// Detalle de alumno (HU-B-04, spec_modulo_B.md §2.4).
export const GET = withPermission("alumnos:leer", async (_req, ctx) => {
  const { id } = (await ctx.params) as { id: string };

  try {
    const data = await obtenerDetalleAlumno(id);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { data: null, error: { code: error.code, message: error.message } },
        { status: 404 },
      );
    }
    throw error;
  }
});

// Modificación de datos del alumno (HU-B-06, spec_modulo_B.md §2.5). Capa
// delgada (Regla N.° 4 de docs/RULES.md): valida el body con Zod, invoca
// modificarAlumno() de alumno.service.ts y traduce el resultado al contrato
// { data, error } (Regla N.° 5) — mismo servicio que la Server Action
// equivalente en src/server/alumnos/actions.ts.
export const PATCH = withPermission("alumnos:editar", async (req, ctx) => {
  const { id: alumnoId } = (await ctx.params) as { id: string };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: { code: "BODY_INVALIDO", message: "El cuerpo de la solicitud debe ser JSON válido" },
      },
      { status: 400 },
    );
  }

  const [dniLongitudMin, dniLongitudMax] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);

  const parsed = construirModificarAlumnoSchema(dniLongitudMin, dniLongitudMax).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDACION", message: "Datos inválidos", detalles: parsed.error.flatten() },
      },
      { status: 400 },
    );
  }

  // "Provisto" se mira sobre el body crudo, antes de Zod: distingue "la
  // clave no vino en el JSON" de "vino vacía/null" — mismo criterio que
  // PATCH /api/alumnos/[id]/contacto/route.ts. Un body que no es un objeto
  // nunca llega acá: ya lo habría rechazado el safeParse de arriba.
  const camposProvistos = {
    nombre: typeof body === "object" && body !== null && "nombre" in body,
    apellido: typeof body === "object" && body !== null && "apellido" in body,
    dni: typeof body === "object" && body !== null && "dni" in body,
    fecha_nacimiento: typeof body === "object" && body !== null && "fecha_nacimiento" in body,
    genero: typeof body === "object" && body !== null && "genero" in body,
    telefono: typeof body === "object" && body !== null && "telefono" in body,
    email: typeof body === "object" && body !== null && "email" in body,
    forma_pago_id: typeof body === "object" && body !== null && "forma_pago_id" in body,
  };

  try {
    // withPermission() ya garantizó que req.auth.user existe.
    const resultado = await modificarAlumno(alumnoId, parsed.data, camposProvistos, req.auth!.user.id);
    return NextResponse.json({ data: resultado, error: null }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "ALUMNO_NO_ENCONTRADO") {
        return NextResponse.json(
          { data: null, error: { code: error.code, message: error.message } },
          { status: 404 },
        );
      }
      if (
        error.code === "CONFLICTO_EDICION_CONCURRENTE" ||
        error.code === "DNI_DUPLICADO" ||
        error.code === "EMAIL_YA_ASOCIADO" ||
        error.code === "FORMA_PAGO_NO_DISPONIBLE" ||
        error.code === "EMAIL_CUENTA_VINCULADA_NO_MODIFICABLE"
      ) {
        return NextResponse.json(
          { data: null, error: { code: error.code, message: error.message } },
          { status: 409 },
        );
      }
    }
    // Cualquier otro error: nunca un detalle técnico en el body, mismo
    // criterio que el resto de las rutas del módulo.
    return NextResponse.json(
      { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } },
      { status: 500 },
    );
  }
});
