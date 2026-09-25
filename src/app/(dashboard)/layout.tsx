import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getParametroNumerico } from "@/server/shared/parametros";
import { AvisoExpiracion } from "@/components/sesion/aviso-expiracion";
import { ProtegerCacheNavegador } from "@/components/sesion/proteger-cache-navegador";
import { DirtyStateProvider } from "@/components/sesion/dirty-state-context";
import { ToastProvider } from "@/components/ui/toast";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

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

  return (
    <DirtyStateProvider>
      <ToastProvider>
        <ProtegerCacheNavegador />
        <AvisoExpiracion expiresISO={session.expires} avisoAnticipadoMin={avisoAnticipadoMin} />
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Navbar />
            <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
            <Footer />
          </div>
        </div>
      </ToastProvider>
    </DirtyStateProvider>
  );
}
