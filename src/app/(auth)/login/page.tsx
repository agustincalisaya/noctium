import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string; email?: string }>;
}) {
  // Criterio 7: sesión ya válida -> redirect directo, sin mostrar el formulario.
  const session = await auth();
  if (session?.user) {
    redirect("/home");
  }

  // HU-A-02 criterio 5: fetchAutenticado() redirige con ?motivo=expirada
  // HU-A-03 criterio 4: el logout redirige con ?motivo=cerrada tras cerrar sesión con éxito.
  // HU-B-08 criterio 5/6: el autorregistro redirige acá con ?email= para
  // precargar el campo tras crear la cuenta — acotado a leer el query param
  // y pasarlo como valor inicial, sin ningún otro cambio en este archivo.
  const { motivo, email } = await searchParams;
  const mensaje =
    motivo === "expirada"
      ? { texto: "Tu sesión expiró. Iniciá sesión nuevamente", variante: "aviso" as const }
      : motivo === "cerrada"
        ? { texto: "Sesión cerrada correctamente", variante: "exito" as const }
        : null;

  return (
    <main className="grid min-h-screen w-full lg:grid-cols-2">
      {/* Columna Izquierda: Formulario de inicio de sesión */}
      <div className="flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-white dark:bg-slate-950">
        {/* Brand / Logo superior */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-800 to-cyan-500 text-sm font-bold text-white shadow-md shadow-cyan-500/25">
            N
          </div>
          <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            Noctium
          </span>
        </div>

        {/* Contenedor central del login */}
        <div className="mx-auto w-full max-w-sm py-10">
          <div className="mb-8 space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Iniciar sesión
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ingresá tus credenciales para acceder a la plataforma.
            </p>
          </div>

          {/* Mensajes de sesión expirada / cerrada */}
          {mensaje && (
            <div
              className={`mb-6 rounded-xl border px-3.5 py-2.5 text-center text-xs font-medium transition-all ${
                mensaje.variante === "exito"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}
            >
              {mensaje.texto}
            </div>
          )}

          {/* Tu componente LoginForm */}
          <LoginForm emailInicial={email} />
        </div>

        {/* Footer legal */}
        <div className="text-xs text-slate-400 dark:text-slate-600">
          © {new Date().getFullYear()} Noctium. Todos los derechos reservados.
        </div>
      </div>

      {/* Columna Derecha: Video de fondo full-screen + Overlay */}
      <div className="relative hidden h-full w-full overflow-hidden bg-slate-950 lg:block">
        {/* Video de fondo */}
        <video
          autoPlay
          loop
          muted
          playsInline
          /* Standard background video classes: full cover, zero padding */
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="/videos/login-bg.mp4" type="video/mp4" />
          Tu navegador no soporta reproducción de videos.
        </video>

        {/* Subtle dark gradient overlay for text visibility */}
        {/* Un degradado radial sutil ayuda a centrar la vista y mejorar el contraste si hay elementos sobre el video. */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-950/40 via-cyan-950/80 to-cyan-950" />
      </div>
    </main>
  );
}