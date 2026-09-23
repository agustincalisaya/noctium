import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MateriaForm } from "./materia-form";

export default async function NuevaMateriaPage() {
  // Gateo de UI (criterio 1: "solo el gerente"); la verificación real es
  // la de verificarPermiso("materias:crear") dentro del Server Action —
  // esto solo evita mostrar el formulario a quien no podría enviarlo.
  const session = await auth();
  if (session?.user?.rol !== "GERENTE") {
    redirect("/materias");
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Nueva materia</h1>
        <p className="text-sm text-muted-foreground">
          Registrá una materia para el catálogo del centro.
        </p>
      </div>
      <MateriaForm />
    </main>
  );
}
