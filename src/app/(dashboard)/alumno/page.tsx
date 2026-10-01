import Link from "next/link";
import { CalendarPlus2, ArrowRight } from "lucide-react";
import { exigirPermiso } from "@/server/shared/with-permission";
import { buttonVariants } from "@/components/ui/button";

export default async function AlumnoPage({
  searchParams,
}: {
  searchParams: Promise<{ inscripcion?: string }>;
}) {
  await exigirPermiso("turnos:leer_propios");
  const { inscripcion } = await searchParams;

  return (
    <section className="mx-auto max-w-5xl space-y-6 py-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mis turnos</h1>
        <p className="text-muted-foreground">Reservá un lugar en una clase disponible desde el portal.</p>
      </div>

      {inscripcion === "exitosa" && (
        <div role="status" className="flex items-start gap-3 rounded-lg bg-success p-4 text-success-foreground">
          <CalendarPlus2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Te inscribiste correctamente</p>
            <p className="mt-1 text-sm">El pago se abona en el centro</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CalendarPlus2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h2 className="font-semibold">Solicitar turno</h2>
            <p className="mt-1 text-sm text-muted-foreground">Elegí materia, profesor y horario entre los turnos disponibles.</p>
          </div>
        </div>
        <Link href="/alumno/turnos/solicitar" className={buttonVariants({ className: "self-start sm:self-auto" })}>
          Elegir turno <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
