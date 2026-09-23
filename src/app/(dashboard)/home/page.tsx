import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { obtenerNombreVisible } from "@/server/usuarios/usuario.service";
import { ROL_LEGIBLE } from "@/components/layout/Navbar";

/**
 * Pantalla principal única post-login (HU-A-01 criterio 3): todos los
 * roles caen acá después de iniciar sesión, en vez de una ruta distinta
 * por rol.
 */
export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const nombre = await obtenerNombreVisible(session.user.id, session.user.rol);
  const rol = ROL_LEGIBLE[session.user.rol] || "Usuario";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. Encabezado / Hero Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-card border border-border p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Hola, <span className="text-brand-accent">{nombre}</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Bienvenido/a de vuelta a Noctium. Estás operando como <span className="font-medium text-foreground">{rol}</span>.
          </p>
        </div>
        
        {/* Acción Principal de la vista (Call to Action) */}
        <div>
          <button className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            Comenzar mi turno
          </button>
        </div>
      </header>

      {/* 2. Área de Widgets / Tarjetas de Dashboard (Placeholder escalable) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Widget: Actividad */}
        <section className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-semibold text-lg text-card-foreground mb-2">
            Actividad Reciente
          </h2>
          <p className="text-sm text-muted-foreground flex-1">
            Aquí podrás ver un resumen de las últimas acciones realizadas en tu área.
          </p>
        </section>

        {/* Widget: Accesos Rápidos (Acciones Secundarias) */}
        <section className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-semibold text-lg text-card-foreground mb-4">
            Accesos Rápidos
          </h2>
          <div className="flex flex-col gap-2">
            <button className="w-full text-left bg-secondary text-secondary-foreground px-4 py-2 rounded-md text-sm font-medium transition-colors hover:opacity-90">
              Ver reportes de hoy
            </button>
            <button className="w-full text-left bg-secondary text-secondary-foreground px-4 py-2 rounded-md text-sm font-medium transition-colors hover:opacity-90">
              Gestionar configuraciones
            </button>
          </div>
        </section>

        {/* Widget: Avisos o Panel de Información */}
        <section className="flex flex-col rounded-xl bg-muted p-6 border border-transparent">
          <h2 className="font-semibold text-lg text-foreground mb-2">
            Avisos del Sistema
          </h2>
          <p className="text-sm text-muted-foreground">
            Todo está funcionando correctamente. No hay nuevas alertas de sistema para tu rol.
          </p>
        </section>

      </div>
    </div>
  );
}