import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

const RUTA_POR_ROL: Record<string, string> = {
  MESA_ENTRADA: "/mesa-entrada",
  PROFESOR: "/profesor",
  GERENTE: "/gerente",
  ALUMNO: "/alumno",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  // Criterio 7: sesión ya válida -> redirect directo, sin mostrar el formulario.
  const session = await auth();
  if (session?.user) {
    redirect(RUTA_POR_ROL[session.user.rol] ?? "/login");
  }

  // HU-A-02 criterio 5: fetchAutenticado() redirige acá con este motivo
  // cuando una llamada autenticada vuelve con 401 SESION_INVALIDA.
  const { motivo } = await searchParams;
  const mensajeSesionExpirada =
    motivo === "expirada" ? "Tu sesión expiró. Iniciá sesión nuevamente" : null;

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Iniciar sesión</h1>
          <p className="text-sm text-muted-foreground">Accedé a tu cuenta de Noctium</p>
        </div>
        {mensajeSesionExpirada && (
          <p className="rounded-md bg-amber-100 px-3 py-2 text-center text-sm text-amber-900 dark:bg-amber-900 dark:text-amber-100">
            {mensajeSesionExpirada}
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
