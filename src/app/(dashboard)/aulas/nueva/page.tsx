import { texto as textoC19 } from "@/lib/textos";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AulaForm } from "./aula-form";

export default async function NuevaAulaPage() {
  // Gateo de UI (criterio 1: "solo el gerente"); la verificación real es
  // la de verificarPermiso("aulas:crear") dentro del Server Action — esto
  // solo evita mostrar el formulario a quien no podría enviarlo.
  const session = await auth();
  if (session?.user?.rol !== "GERENTE") {
    redirect("/aulas");
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{textoC19("ui.clases.interfaz.nuevaAula")}</h1>
        <p className="text-sm text-muted-foreground">
          {textoC19("ui.clases.interfaz.registraUnAulaParaQuePuedaAsignarseAClases")}</p>
      </div>
      <AulaForm />
    </main>
  );
}
