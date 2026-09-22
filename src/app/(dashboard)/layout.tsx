import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getParametroNumerico } from "@/server/shared/parametros";
import { AvisoExpiracion } from "@/components/sesion/aviso-expiracion";
import { ProtegerCacheNavegador } from "@/components/sesion/proteger-cache-navegador";
import { DirtyStateProvider } from "@/components/sesion/dirty-state-context";
import { MenuUsuario } from "@/components/sesion/menu-usuario";

// Fuerza que ninguna página de este grupo se sirva desde caché estática
// (HU-A-02 criterio 6): toda respuesta dinámica que lee cookies() ya recibe
// `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`
// de Next.js por default — esto lo deja explícito para que no dependa de
// que cada página futura llame auth() por su cuenta.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defensa en profundidad: src/proxy.ts ya protege estas rutas por matcher,
  // pero el layout redirige igual si por lo que sea se renderiza sin sesión
  // (URL protegida reabierta desde historial, etc. — criterio 6 de HU-A-02).
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const avisoAnticipadoMin = await getParametroNumerico("sesion_aviso_anticipado_minutos", 5);

  // El JWT nunca lleva email (HU-A-01 criterio 3: "nunca datos personales"),
  // así que para mostrarlo en el menú de usuario (HU-A-03 criterio 1) se
  // resuelve acá con una lectura server-side normal, no vía claims/sesión.
  // Usuario no tiene un campo "nombre" en el schema de Sprint 1 (vive en
  // Alumno/Profesor, fuera del alcance del módulo de Sesión) — se usa el
  // email como identificador visible en su lugar.
  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: session.user.id },
    select: { emailUsuario: true },
  });

  return (
    <DirtyStateProvider>
      <ProtegerCacheNavegador />
      <AvisoExpiracion expiresISO={session.expires} avisoAnticipadoMin={avisoAnticipadoMin} />
      <MenuUsuario email={usuario?.emailUsuario ?? ""} rol={session.user.rol} />
      {children}
    </DirtyStateProvider>
  );
}
