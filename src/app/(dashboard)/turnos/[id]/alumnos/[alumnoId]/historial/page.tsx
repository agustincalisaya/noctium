import Link from "next/link";
import { HistorialAcademico } from "@/app/(dashboard)/alumnos/[id]/historial-academico";
import { texto } from "@/lib/textos";
import { redirect } from "next/navigation";
import { exigirPermiso, verificarPermiso, PermisoError } from "@/server/shared/with-permission";
import { obtenerDetalleTurno } from "@/server/turnos/turno.detalle";
import { profesorPuedeRegistrarIndicacion } from "@/server/historial/historial.publico";
import { ahora } from "@/server/shared/reloj";

export default async function HistorialDesdeClasePage({ params }: { params: Promise<{ id: string; alumnoId: string }> }) {
  const [{ id: turnoId, alumnoId }, usuario] = await Promise.all([params, exigirPermiso("historial:leer")]);
  if (usuario.rol !== "PROFESOR") redirect("/sin-permiso");

  const detalle = await obtenerDetalleTurno(turnoId, usuario, {
    capacidades: {
      verPagos: false,
      verHistorial: true,
      cancelar: false,
      reprogramar: false,
      priorizar: false,
      registrarPago: false,
      registrarClase: false,
    },
    ahora: ahora(),
  });
  if (detalle.resultado !== "ok" || !detalle.turno.materia_id || !detalle.turno.profesor_id) redirect("/sin-permiso");

  const estaEnInscripcionVigente = detalle.turno.alumnos.some((alumno) => alumno.id === alumnoId && alumno.puede_ver_historial);
  const puedeVerPorClasePropia = await profesorPuedeRegistrarIndicacion(detalle.turno.profesor_id, alumnoId, detalle.turno.materia_id);
  if (!estaEnInscripcionVigente && !puedeVerPorClasePropia) redirect("/sin-permiso");

  async function puede(accion: string) {
    try { await verificarPermiso(accion); return true; }
    catch (error) { if (error instanceof PermisoError && error.status === 403) return false; throw error; }
  }
  const [puedeExamen, puedeIndicacion] = await Promise.all([puede("examenes:registrar"), puede("indicaciones:registrar")]);
  return <section className="mx-auto w-full max-w-6xl space-y-5">
    <Link href={`/turnos/${encodeURIComponent(turnoId)}`} className="text-sm text-primary underline underline-offset-4">{texto("ui.historial.clasesAlumno.volverClase")}</Link>
    <HistorialAcademico alumnoId={alumnoId} materiaInicial={detalle.turno.materia_id} mostrarNombre puedeRegistrarExamen={puedeExamen} puedeRegistrarIndicacion={puedeIndicacion} />
  </section>;
}
