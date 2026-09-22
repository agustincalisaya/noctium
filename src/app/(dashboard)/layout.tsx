import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getParametroNumerico } from "@/server/shared/parametros";
import { AvisoExpiracion } from "@/components/sesion/aviso-expiracion";
import { ProtegerCacheNavegador } from "@/components/sesion/proteger-cache-navegador";

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
  // (URL protegida reabierta desde historial, etc. — criterio 6).
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const avisoAnticipadoMin = await getParametroNumerico("sesion_aviso_anticipado_minutos", 5);

  return (
    <>
      <ProtegerCacheNavegador />
      <AvisoExpiracion expiresISO={session.expires} avisoAnticipadoMin={avisoAnticipadoMin} />
      {children}
    </>
  );
}
