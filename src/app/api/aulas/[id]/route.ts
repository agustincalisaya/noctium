import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";
import { obtenerAulaPorId } from "@/server/aulas/aula.service";
import { ServiceError } from "@/server/shared/service-error";

export const GET = withPermission("aulas:leer", async (_req, ctx) => {
  const { id } = (await ctx.params) as { id: string };

  try {
    const data = await obtenerAulaPorId(id);
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
