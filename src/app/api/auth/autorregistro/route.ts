import { NextResponse, type NextRequest } from "next/server";
import { obtenerIp } from "@/auth";
import { construirAutorregistroAlumnoSchema } from "@/server/alumnos/alumno.schema";
import { iniciarAutorregistro } from "@/server/alumnos/autorregistro.service";
import { ServiceError } from "@/server/shared/service-error";
import { getParametroNumerico } from "@/server/shared/parametros";

// Autorregistro del alumno (HU-B-08, spec_modulo_B.md §2.6). Superficie
// pública, sin sesión — no pasa por withPermission() (RBAC: "Ninguno" en la
// task), mismo criterio que src/app/api/auth/logout/route.ts. Capa delgada
// (Regla N.° 4 de docs/RULES.md): valida con Zod, invoca
// iniciarAutorregistro() de autorregistro.service.ts y traduce el resultado
// al contrato { data, error } (Regla N.° 5) — mismo patrón de parseo/mapeo
// que PATCH /api/alumnos/[id]/route.ts (HU-B-06), sin mapa central de
// código -> status (no existe ninguno en el repo, cada route arma el suyo).
export async function POST(req: NextRequest) {
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

  const [dniLongitudMin, dniLongitudMax, passwordLongitudMinima] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
    getParametroNumerico("password_longitud_minima", 8),
  ]);

  const parsed = construirAutorregistroAlumnoSchema(
    dniLongitudMin,
    dniLongitudMax,
    passwordLongitudMinima,
  ).safeParse(body);
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
    const ip = obtenerIp(req);
    const resultado = await iniciarAutorregistro(parsed.data, ip);
    return NextResponse.json({ data: resultado, error: null }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "CUENTA_YA_EXISTE" || error.code === "DNI_DUPLICADO") {
        return NextResponse.json(
          { data: null, error: { code: error.code, message: error.message } },
          { status: 409 },
        );
      }
      if (error.code === "RATE_LIMIT_EXCEDIDO") {
        return NextResponse.json(
          { data: null, error: { code: error.code, message: error.message } },
          { status: 429 },
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
}
