import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { CambiarTarifaSchema } from "@/server/materias/materia.schema";
import { cambiarTarifaMateria } from "@/server/materias/materia.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { texto } from "@/lib/textos";

export const PUT = withPermission("materias:cambiar_tarifa", async (req, ctx) => {
  const { id } = await ctx.params as { id: string };
  const parsed = CambiarTarifaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: {
    code: "VALIDACION", message: texto("errores.materias.tarifaDatos"), detalles: parsed.error.flatten(),
  } }, { status: 400 });
  try {
    const data = await cambiarTarifaMateria(id, parsed.data, req.auth!.user.id);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof ErrorDeDominio) return NextResponse.json({ data: null, error: {
      code: error.code, message: error.message, detalles: error.datos,
    } }, { status: error.status });
    throw error;
  }
});
