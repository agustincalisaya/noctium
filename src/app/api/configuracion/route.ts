import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { texto } from "@/lib/textos";
import { GuardarConfiguracionSchema } from "@/server/configuracion/configuracion.schema";
import { guardarConfiguracion, obtenerConfiguracion } from "@/server/configuracion/configuracion.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { withPermission } from "@/server/shared/with-permission";

const interno = () => NextResponse.json({ data: null, error: {
  code: "INTERNAL_ERROR", message: texto("errores.configuracion.interno"),
} }, { status: 500 });

export const GET = withPermission("configuracion:leer", async () => {
  try {
    return NextResponse.json({ data: await obtenerConfiguracion(), error: null });
  } catch (error) {
    console.error("[configuracion] falló la lectura", error);
    return interno();
  }
});

export const PUT = withPermission("configuracion:editar", async (req) => {
  const parsed = GuardarConfiguracionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: {
    code: "VALIDATION_ERROR", message: texto("errores.configuracion.datosInvalidos"),
    detalles: { ...flattenError(parsed.error), issues: parsed.error.issues.map(({ path, message }) => ({ path, message })) },
  } }, { status: 400 });
  try {
    const data = await guardarConfiguracion(parsed.data, { usuarioId: req.auth!.user.id });
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof ErrorDeDominio) return NextResponse.json({ data: null, error: {
      code: error.code, message: error.message,
    } }, { status: error.status });
    console.error("[configuracion] falló el guardado", error);
    return interno();
  }
});
