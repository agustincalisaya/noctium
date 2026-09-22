import { NextResponse, type NextRequest } from "next/server";
import { auth, signOut, obtenerIp } from "@/auth";
import { leerTokenSesion } from "@/server/shared/with-permission";
import { cerrarSesion } from "@/server/sesion/autenticacion.service";

// No pasa por withPermission() (spec_modulo_A.md §2.3, HU-A-03 §4.3): cerrar
// sesión no es "acceso a una sección" que requiera una acción RBAC granular,
// cualquier sesión válida puede cerrarse a sí misma. Tolera además llamarse
// sin sesión vigente (confirmado): no hay nada que revocar y el objetivo del
// cliente (no seguir logueado) ya está cumplido, así que igual responde 200
// en vez de un 401 que no aportaría nada accionable.
export async function POST(request: NextRequest) {
  const session = await auth();

  if (session?.user) {
    const token = await leerTokenSesion();

    if (token?.jti && typeof token.exp === "number") {
      const ip = obtenerIp(request);
      await cerrarSesion(token.jti, session.user.id, ip, token.exp);
    }
  }

  // Elimina la cookie de sesión (Max-Age=0): signOut() la arma con la misma
  // config (httpOnly/secure/sameSite/path) ya definida en auth.ts, en vez de
  // reconstruir el Set-Cookie a mano acá.
  await signOut({ redirect: false });

  return NextResponse.json(
    { data: { revocado: true }, error: null },
    { headers: { "Cache-Control": "no-store, must-revalidate" } },
  );
}
