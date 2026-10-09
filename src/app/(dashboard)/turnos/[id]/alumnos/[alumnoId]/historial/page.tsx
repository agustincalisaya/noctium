import { redirect } from "next/navigation";
import { exigirPermiso } from "@/server/shared/with-permission";
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

  redirect(`/alumnos/${encodeURIComponent(alumnoId)}?tab=historial&materia_id=${encodeURIComponent(detalle.turno.materia_id)}&volver=${encodeURIComponent(`/turnos/${turnoId}`)}`);
}
