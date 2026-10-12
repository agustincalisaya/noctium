import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { CambiarTarifasMasivoSchema } from "@/server/materias/materia.schema";
import { cambiarTarifasMasivo, listarMateriasConTarifa } from "@/server/materias/materia.service";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { texto } from "@/lib/textos";

export const GET = withPermission("materias:cambiar_tarifa", async () => {
  return NextResponse.json({ data: { items: await listarMateriasConTarifa() }, error: null });
});

export const POST = withPermission("materias:cambiar_tarifa", async (req) => {
  const parsed = CambiarTarifasMasivoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: {
    code: "VALIDACION", message: texto("errores.materias.tarifaDatos"), detalles: parsed.error.flatten(),
  } }, { status: 400 });
  try {
    const data = await cambiarTarifasMasivo(parsed.data, req.auth!.user.id);
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof ErrorDeDominio) return NextResponse.json({ data: null, error: {
      code: error.code, message: error.message, detalles: error.datos,
    } }, { status: error.status });
    throw error;
  }
});
