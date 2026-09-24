import { NextResponse, type NextRequest } from "next/server";
import { obtenerIp } from "@/auth";
import { ReenviarCodigoAutorregistroSchema } from "@/server/alumnos/alumno.schema";
import { reenviarCodigoAutorregistro } from "@/server/alumnos/autorregistro.service";
import { ServiceError } from "@/server/shared/service-error";

// Reenvío del código de autorregistro (HU-B-08 §4.4). Superficie pública,
// sin sesión — mismo criterio que POST /api/auth/autorregistro.
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

  const parsed = ReenviarCodigoAutorregistroSchema.safeParse(body);
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
    const resultado = await reenviarCodigoAutorregistro(parsed.data.solicitud_id, ip);
    return NextResponse.json({ data: resultado, error: null }, { status: 200 });
  } catch (error) {
    if (error instanceof ServiceError) {
      if (error.code === "SOLICITUD_NO_ENCONTRADA") {
        return NextResponse.json(
          { data: null, error: { code: error.code, message: error.message } },
          { status: 404 },
        );
      }
      if (error.code === "RATE_LIMIT_EXCEDIDO" || error.code === "REENVIO_MUY_PRONTO") {
        return NextResponse.json(
          { data: null, error: { code: error.code, message: error.message } },
          { status: 429 },
        );
      }
    }
    return NextResponse.json(
      { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } },
      { status: 500 },
    );
  }
}
