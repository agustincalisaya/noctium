import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

const RUTA_POR_ROL: Record<string, string> = {
  MESA_ENTRADA: "/mesa-entrada",
  PROFESOR: "/profesor",
  GERENTE: "/gerente",
  ALUMNO: "/alumno",
};

export default async function LoginPage() {
  // Criterio 7: sesión ya válida -> redirect directo, sin mostrar el formulario.
  const session = await auth();
  if (session?.user) {
    redirect(RUTA_POR_ROL[session.user.rol] ?? "/login");
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Iniciar sesión</h1>
          <p className="text-sm text-muted-foreground">Accedé a tu cuenta de Noctium</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
