import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { ContactoAlumnoSchema } from "@/server/alumnos/alumno.schema";
import { actualizarContactoAlumno } from "@/server/alumnos/alumno.service";
import { ServiceError } from "@/server/shared/service-error";

// Registro/actualización del contacto del alumno (HU-B-02,
// spec_modulo_B.md §2.2). Capa delgada (Regla N.° 4 de docs/RULES.md):
// valida el body con Zod, invoca actualizarContactoAlumno() de
// alumno.service.ts y traduce el resultado al contrato { data, error }
// (Regla N.° 5) — ninguna lógica de negocio vive acá, mismo servicio que ya
// usa la Server Action equivalente en src/server/alumnos/actions.ts.
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

  const parsed = ContactoAlumnoSchema.safeParse(body);
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
  // clave no vino en el JSON" de "vino vacía" — ver docstring de
  // actualizarContactoAlumno() en alumno.service.ts. Un body que no es un
  // objeto (ej. array, string) nunca llega acá: ya lo habría rechazado el
  // safeParse de arriba.
  const camposProvistos = {
    telefono: typeof body === "object" && body !== null && "telefono" in body,
    email: typeof body === "object" && body !== null && "email" in body,
  };

  try {
    // withPermission() ya garantizó que req.auth.user existe.
    const contacto = await actualizarContactoAlumno(
      alumnoId,
      parsed.data,
      camposProvistos,
      req.auth!.user.id,
    );
    return NextResponse.json({ data: contacto, error: null }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "ALUMNO_NO_ENCONTRADO") {
        return NextResponse.json(
          { data: null, error: { code: error.code, message: error.message } },
          { status: 404 },
        );
      }
      if (error.code === "EMAIL_YA_ASOCIADO") {
        return NextResponse.json(
          { data: null, error: { code: error.code, message: error.message } },
          { status: 409 },
        );
      }
    }
    // Cualquier otro error (ServiceError no traducido, falla de conexión a
    // la base, excepción inesperada): nunca un detalle técnico en el body
    // ("Definiciones generales" de Sprint 1, mismo criterio que
    // src/app/api/profesores/route.ts).
    return NextResponse.json(
      { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } },
      { status: 500 },
    );
  }
});
