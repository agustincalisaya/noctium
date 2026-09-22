import { NextResponse } from "next/server";
import { withPermission } from "@/server/shared/with-permission";

// Sin lógica de negocio (spec_modulo_A.md §2.2, HU-A-02 §4.4): pasar por
// withPermission() ya dispara callbacks.jwt y renueva el exp. El botón
// "Continuar sesión" pega acá.
export const POST = withPermission("sesion:ping", async () => {
  return NextResponse.json({ data: { renovado: true }, error: null });
});
