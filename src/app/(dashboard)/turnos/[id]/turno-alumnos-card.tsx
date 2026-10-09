import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { fechaCorta } from "@/lib/turno-detalle";
import { fetchOLanzar, fetchAutenticado } from "@/lib/fetch-autenticado";
import { iniciales } from "@/lib/turno-detalle";
import type { TurnoDetalle } from "@/types/turno.types";
import { texto } from "@/lib/textos";
import { TurnoClaseCard } from "./turno-clase-card";
import type { EstadoAsistencia, RegistroClaseDictada } from "@/types/historial.types";
import { BuscadorAlumnos } from "../buscador-alumnos";
import { RegistrarIndicacionDialog } from "../../alumnos/[id]/registrar-indicacion-dialog";

/**
 * Tarjeta «Alumnos inscriptos · N de M» (mockup pág. 5): el listado completo,
 * no solo la ocupación. Con `gestionable` (HU-C-04 §2.5: permiso y turno
 * DISPONIBLE o COMPLETO) conserva el alta y la baja individual: «Agregar
 * alumno» en el encabezado y «Quitar» por fila. Cada acción se aplica en el
 * momento; el estado Disponible ⇄ Completo lo resuelve el servidor.
 */
export function TurnoAlumnosCard({ turno, gestionable, puedeRegistrarClase = false, puedeRegistrarIndicacion = false, esProfesor = false, onCambio }: { turno: TurnoDetalle; gestionable: boolean; puedeRegistrarClase?: boolean; puedeRegistrarIndicacion?: boolean; esProfesor?: boolean; onCambio: () => Promise<void> }) {
  const [momento, setMomento] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setMomento(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const [guardandoAsistencia, setGuardandoAsistencia] = useState(false);
  const [seleccion, setSeleccion] = useState<Record<string, EstadoAsistencia>>({});
  const [registro, setRegistro] = useState<RegistroClaseDictada | null>(null);
  const [errorAsistencia, setErrorAsistencia] = useState("");
  const [cargandoAsistencia, setCargandoAsistencia] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [confirmarCorreccion, setConfirmarCorreccion] = useState(false);
  const registroId = turno.clase_dictada?.id;
  const cargarAsistencia = useCallback(async () => {
    if (!registroId) return;
    setCargandoAsistencia(true); setErrorAsistencia("");
    try {
      const respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(turno.id)}/clase-dictada`, { cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !valor?.data) throw new Error(valor?.error?.message ?? texto("ui.historial.asistencia.errorLectura"));
      setRegistro(valor.data);
    } catch (error) { setErrorAsistencia(error instanceof Error ? error.message : texto("ui.historial.asistencia.errorLectura")); }
    finally { setCargandoAsistencia(false); }
  }, [turno.id, registroId]);
  useEffect(() => { const timer = window.setTimeout(() => void cargarAsistencia(), 0); return () => window.clearTimeout(timer); }, [cargarAsistencia]);
  // Se prepara la selección desde el inicio; el servidor y el botón exigen el fin.
  const iniciada = new Date(`${turno.fecha}T${turno.hora_inicio}:00-03:00`).getTime() <= momento;
  const editable = corrigiendo || puedeRegistrarClase && !registroId && iniciada && (turno.estado === "DISPONIBLE" || turno.estado === "COMPLETO");
  const alumnosLista = corrigiendo && registro && registro.id === registroId ? registro.alumnos.map(a => ({ id: a.id, nombre: a.nombre_completo, puede_ver_historial: false })) : turno.alumnos;
  const asistencias = alumnosLista.map(({ id }) => ({ alumno_id: id, estado: seleccion[id] ?? "PRESENTE" as EstadoAsistencia }));
  const todosAusentes = asistencias.length > 0 && asistencias.every(({ estado }) => estado === "AUSENTE");
  const asistenciaGuardada = new Map(registro?.alumnos.map(({ id, asistencia }) => [id, asistencia]));
  const registroVisible = registro && registro.id === registroId ? registro : null;
  const [procesando, setProcesando] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [errorAlumno, setErrorAlumno] = useState<{ id: string; mensaje: string } | null>(null);
  // Solo se gestiona en turnos DISPONIBLE/COMPLETO, que siempre tienen aula y cupo.
  const cupoAlcanzado = turno.cupo_maximo !== null && turno.alumnos.length >= turno.cupo_maximo;
  const ocupacion = turno.cupo_maximo === null ? "Sin asignar" : `${turno.alumnos.length} de ${turno.cupo_maximo}`;

  const ejecutar = async (clave: string, url: string, init: RequestInit, exito: (estado: string) => string) => {
    setProcesando(clave); setAviso(""); setError(""); setErrorAlumno(null);
    try {
      const respuesta = await fetchAutenticado(url, { ...init, cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        const mensaje = valor?.error?.message ?? "No se pudo actualizar la inscripción";
        const alumnoId = valor?.error?.detalles?.alumno_id;
        if (typeof alumnoId === "string" && turno.alumnos.some(({ id }) => id === alumnoId)) setErrorAlumno({ id: alumnoId, mensaje });
        else setError(mensaje);
        return;
      }
      setAviso(exito(valor.data.estado));
      await onCambio();
    } catch { setError("No se pudo actualizar la inscripción. Intentá nuevamente."); }
    finally { setProcesando(null); }
  };

  const agregar = (alumnoId: string) => ejecutar("agregar", `/api/turnos/${encodeURIComponent(turno.id)}/alumnos`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alumno_id: alumnoId }),
  }, (estado) => estado === "COMPLETO" ? "Alumno agregado. El turno alcanzó su cupo máximo y pasó a Completo." : "Alumno agregado al turno");
  const quitar = (alumnoId: string) => ejecutar(alumnoId, `/api/turnos/${encodeURIComponent(turno.id)}/alumnos/${encodeURIComponent(alumnoId)}`, { method: "DELETE" },
    (estado) => turno.estado === "COMPLETO" && estado === "DISPONIBLE" ? "Alumno quitado. El turno volvió a Disponible." : "Alumno quitado del turno");

  return <section aria-labelledby="inscripciones-titulo" className="space-y-3 rounded-md border border-border bg-card p-4 text-card-foreground sm:p-[22px]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h2 id="inscripciones-titulo" className="text-sm font-semibold">Alumnos inscriptos <span className="font-normal text-muted-foreground">· {ocupacion}</span></h2>
      {gestionable && <div className="w-full max-w-xs space-y-1"><label htmlFor="agregar-alumno" className="text-xs">Agregar alumno</label>
        <BuscadorAlumnos id="agregar-alumno" excluir={turno.alumnos.map(({ id }) => id)} deshabilitado={cupoAlcanzado || procesando !== null} avisoDeshabilitado={cupoAlcanzado ? "El turno alcanzó su cupo máximo" : undefined} onSeleccionar={(alumno) => void agregar(alumno.id)} />
      </div>}
    </div>
    <div className="flex justify-between text-xs uppercase tracking-wide text-muted-foreground"><span>{texto("ui.historial.correccionClase.alumno")}</span><span>{texto("ui.historial.correccionClase.asistencia")}</span></div>
    {alumnosLista.length === 0 ? <p className="text-sm text-muted-foreground">El turno no tiene alumnos inscriptos.</p> : <ul className="divide-y divide-border border-t border-border" aria-label="Alumnos inscriptos">{alumnosLista.map((alumno) => {
      const conflicto = errorAlumno?.id === alumno.id ? errorAlumno.mensaje : "";
      return <li key={alumno.id} className={`space-y-1 py-2.5 ${conflicto ? "bg-destructive-soft" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">{iniciales(alumno.nombre)}</span>
            <span className="min-w-0 break-words text-sm">{alumno.nombre}</span>
          </span>
          {editable && <div role="group" aria-label={`Asistencia de ${alumno.nombre}`} className="flex shrink-0 gap-1">
            {(["PRESENTE", "AUSENTE"] as const).map((estado) => <button key={estado} type="button" disabled={guardandoAsistencia}
              aria-pressed={(seleccion[alumno.id] ?? "PRESENTE") === estado}
              onClick={() => setSeleccion((actual) => ({ ...actual, [alumno.id]: estado }))}
              className={`disabled:cursor-wait disabled:opacity-60 min-h-9 rounded-md border px-2 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${(seleccion[alumno.id] ?? "PRESENTE") === estado ? estado === "PRESENTE" ? "border-attendance-selected bg-attendance-selected text-card" : "border-destructive bg-destructive text-card" : "border-border text-muted-foreground hover:bg-muted"}`}>
              {texto(estado === "PRESENTE" ? "ui.historial.asistencia.presente" : "ui.historial.asistencia.ausente")}
            </button>)}
          </div>}
          {!corrigiendo && registroId && registro?.id === registroId && <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${asistenciaGuardada.get(alumno.id) === "PRESENTE" ? "bg-success text-success-foreground" : asistenciaGuardada.get(alumno.id) === "AUSENTE" ? "bg-destructive-soft text-destructive-soft-foreground" : "bg-muted text-muted-foreground"}`}>
            {asistenciaGuardada.get(alumno.id) === "PRESENTE" ? texto("ui.historial.asistencia.presente") : asistenciaGuardada.get(alumno.id) === "AUSENTE" ? texto("ui.historial.asistencia.ausente") : "Sin control de asistencia"}
          </span>}
          {gestionable && !editable && !registroId && <Button type="button" variant="outline" size="sm" disabled={procesando !== null} onClick={() => void quitar(alumno.id)} aria-label={`Quitar a ${alumno.nombre}`}>{procesando === alumno.id ? "Quitando…" : "Quitar"}</Button>}
        </div>
        {alumno.puede_ver_historial && <Link className="ml-10 inline-flex text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={esProfesor
          ? `/turnos/${encodeURIComponent(turno.id)}/alumnos/${encodeURIComponent(alumno.id)}/historial`
          : `/alumnos/${encodeURIComponent(alumno.id)}?tab=historial&materia_id=${encodeURIComponent(turno.materia_id)}&volver=${encodeURIComponent(`/turnos/${turno.id}`)}`} prefetch={false}>Ver historial</Link>}
        {conflicto && <p role="alert" className="text-sm text-destructive">{conflicto}</p>}
      </li>;
    })}</ul>}
    {!corrigiendo && registroVisible?.acciones?.corregir_asistencia && <Button variant="outline" onClick={() => {
      setSeleccion(Object.fromEntries(registroVisible.alumnos.map(a => [a.id, a.asistencia ?? "PRESENTE"])));
      setMotivo(""); setCorrigiendo(true);
    }}>{texto("ui.historial.correccionClase.corregir")}</Button>}
    {editable && asistencias.length > 0 && <Button type="button" variant="outline" size="sm" disabled={guardandoAsistencia} onClick={() => setSeleccion(Object.fromEntries(alumnosLista.map(({ id }) => [id, todosAusentes ? "PRESENTE" : "AUSENTE"])))}>{texto(todosAusentes ? "ui.historial.asistencia.marcarPresentes" : "ui.historial.asistencia.marcarAusentes")}</Button>}
    {corrigiendo && <div className="space-y-2 border-t border-border pt-3">
      <label htmlFor="motivo-correccion-clase" className="block text-sm">{texto("ui.historial.correccionClase.motivoCorreccion")}</label>
      <textarea id="motivo-correccion-clase" maxLength={300} disabled={guardandoAsistencia} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder={texto("ui.historial.correccionClase.placeholderCorreccion")} className="min-h-20 w-full rounded-md border border-input bg-card p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <p className="text-right text-xs tabular-nums text-muted-foreground">{motivo.length} / 300</p>
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={guardandoAsistencia} onClick={() => setCorrigiendo(false)}>{texto("ui.historial.correccionClase.cancelar")}</Button><Button disabled={guardandoAsistencia || !motivo.trim()} onClick={() => setConfirmarCorreccion(true)}>{texto("ui.historial.correccionClase.guardar")}</Button></div>
      <ConfirmarAccionDialog abierto={confirmarCorreccion} onCerrar={() => setConfirmarCorreccion(false)} titulo={texto("ui.historial.correccionClase.tituloCorregir", { materia: turno.materia, fecha: fechaCorta(turno.fecha) })} textoConfirmar={texto("ui.historial.correccionClase.guardar")} onConfirmar={async () => {
        setGuardandoAsistencia(true);
        try { await fetchOLanzar(`/api/turnos/${encodeURIComponent(turno.id)}/clase-dictada/correccion-asistencia`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asistencias, motivo: motivo.trim() }) }); }
        finally { setGuardandoAsistencia(false); }
      }} onExito={() => { setCorrigiendo(false); toast.success(texto("ui.historial.correccionClase.guardada")); void cargarAsistencia(); void onCambio(); }} />
    </div>}
    {cargandoAsistencia && <p role="status" className="text-sm text-muted-foreground">{texto("ui.historial.asistencia.cargando")}</p>}
    {errorAsistencia && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{errorAsistencia}</p><Button variant="outline" onClick={() => void cargarAsistencia()}>Reintentar</Button></div>}
    {!corrigiendo && registroId && registro?.id === registroId && <p role="status" className="text-sm font-medium">{registro.totales ? texto("ui.historial.asistencia.totales", registro.totales) : "Clase sin control de asistencia"}</p>}
    {!corrigiendo && puedeRegistrarIndicacion && registroVisible && <div className="space-y-3 rounded-md border border-border bg-background p-3">
      <h3 className="text-sm font-semibold">Indicaciones académicas de esta clase</h3>
      <ul className="divide-y divide-border" aria-label="Alumnos de la clase dictada para registrar indicaciones">
        {registroVisible.alumnos.map((alumnoRegistro) => <li key={alumnoRegistro.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
          <span className="text-sm">{alumnoRegistro.nombre_completo}</span>
          <div className="flex flex-wrap items-center gap-3">
            {!turno.alumnos.some(({ id }) => id === alumnoRegistro.id) && <Link className="text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={esProfesor
              ? `/turnos/${encodeURIComponent(turno.id)}/alumnos/${encodeURIComponent(alumnoRegistro.id)}/historial`
              : `/alumnos/${encodeURIComponent(alumnoRegistro.id)}?tab=historial&materia_id=${encodeURIComponent(turno.materia_id)}&volver=${encodeURIComponent(`/turnos/${turno.id}`)}`} prefetch={false}>Ver historial</Link>}
            <RegistrarIndicacionDialog
              alumnoId={alumnoRegistro.id}
              nombreAlumno={alumnoRegistro.nombre_completo}
              materias={[{ id: turno.materia_id, nombre: turno.materia }]}
              clases={[{ id: registroVisible.id, materia_id: turno.materia_id, fecha: turno.fecha }]}
              materiaInicial={turno.materia_id}
              materiaFija={esProfesor}
              claseInicial={registroVisible.id}
              onRegistrado={onCambio}
            />
          </div>
        </li>)}
      </ul>
    </div>}
    {!corrigiendo && (puedeRegistrarClase || registroId) && <TurnoClaseCard
      turno={turno}
      puedeRegistrarClase={puedeRegistrarClase}
      asistencias={asistencias}
      registro={registroVisible}
      onProcesandoChange={setGuardandoAsistencia}
      onRegistrada={onCambio}
      onObservacionRegistrada={() => { void cargarAsistencia(); }}
    />}
    {procesando === "agregar" && <p role="status" className="text-sm text-muted-foreground">Agregando alumno…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {aviso && <p role="status" className="rounded-md bg-success p-3 text-sm text-success-foreground">{aviso}</p>}
  </section>;
}
