import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ParticipantesPage({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  const session = await auth();
  if (session?.user?.rol !== "MESA_ENTRADA") redirect("/turnos");
  const { volver } = await searchParams;
  const retorno = volver?.startsWith("/turnos?") ? volver : "/turnos";
  return <main className="mx-auto w-full max-w-2xl space-y-4 p-6"><Link className="rounded-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={retorno} prefetch={false}>Volver al listado</Link><h1 className="text-2xl font-semibold">Asignar alumno y profesor</h1><p className="rounded-md bg-warning p-4 text-warning-foreground">Este paso corresponde a HU-C-04 y todavía no está implementado.</p></main>;
}
