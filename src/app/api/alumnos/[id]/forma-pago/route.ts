import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { FormaPagoPreferidaSchema } from "@/server/alumnos/alumno.schema";
import { actualizarFormaPagoPreferida } from "@/server/alumnos/alumno.service";
import { ServiceError } from "@/server/shared/service-error";

// Asociar/quitar la forma de pago preferida del alumno (HU-B-03,
// spec_modulo_B.md §2.3). Capa delgada (Regla N.° 4 de docs/RULES.md):
// valida el body con Zod, invoca actualizarFormaPagoPreferida() de
// alumno.service.ts y traduce el resultado al contrato { data, error }
// (Regla N.° 5) — mismo patrón que contacto/route.ts.
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

  const parsed = FormaPagoPreferidaSchema.safeParse(body);
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
    const resultado = await actualizarFormaPagoPreferida(alumnoId, parsed.data);
    return NextResponse.json({ data: resultado, error: null }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "ALUMNO_NO_ENCONTRADO") {
        return NextResponse.json(
          { data: null, error: { code: error.code, message: error.message } },
          { status: 404 },
        );
      }
      if (error.code === "FORMA_PAGO_NO_DISPONIBLE") {
        return NextResponse.json(
          { data: null, error: { code: error.code, message: error.message } },
          { status: 409 },
        );
      }
    }
    // Cualquier otro error: nunca un detalle técnico en el body, mismo
    // criterio que src/app/api/alumnos/[id]/contacto/route.ts.
    return NextResponse.json(
      { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } },
      { status: 500 },
    );
  }
});
