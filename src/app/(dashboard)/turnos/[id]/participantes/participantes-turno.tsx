"use client";

import { texto as textoC19 } from "@/lib/textos";

import Link from "next/link";
import { LinkProtegido } from "@/components/sesion/link-protegido";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { fechaCorta } from "@/lib/turno-detalle";
import { texto } from "@/lib/textos";
import { BuscadorAlumnos, etiquetaAlumno } from "../../buscador-alumnos";
import { EstadoTurnoBadge } from "../../estado-turno-badge";
import type { InscripcionConfirmadaCentro, Turno } from "@/types/turno.types";

type Profesor = { id: string; nombre: string; apellido: string };
/** Mismo formato que `Turno.alumnos`: `nombre` ya es "Apellido, Nombre". */
type AlumnoAgregado = Turno["alumnos"][number];

const mismosIds = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

export function ParticipantesTurno({ id, retorno }: { id: string; retorno: string }) {
  const { setDirty } = useDirtyState();
  const [turno, setTurno] = useState<Turno | null>(null);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [alumnos, setAlumnos] = useState<AlumnoAgregado[]>([]);
  const [profesorId, setProfesorId] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [errorAlumno, setErrorAlumno] = useState<{ id: string; mensaje: string } | null>(null);
  const [sinProfesoresMateria, setSinProfesoresMateria] = useState(false);
  const [confirmado, setConfirmado] = useState<Turno["estado"] | null>(null);
  const [inscripcionesConfirmadas, setInscripcionesConfirmadas] = useState<InscripcionConfirmadaCentro[]>([]);
  const [confirmando, setConfirmando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(id)}`, { cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !valor?.data) throw new Error(valor?.error?.message ?? textoC19("ui.clases.interfaz.noSePudoCargarLaClase"));
      const actual = valor.data as Turno;
      let opciones: Profesor[] = [];
      let sinProfesores = false;
      // Solo un turno pendiente con aula puede confirmarse (§2.2): recién ahí hay profesores para ofrecer (§2.6).
      if (actual.estado === "PENDIENTE" && actual.aula_id && !actual.profesor_id) {
        const opcionesRespuesta = await fetchAutenticado(`/api/turnos/profesores/opciones?turno_id=${encodeURIComponent(id)}`, { cache: "no-store" });
        const valorOpciones = await opcionesRespuesta.json().catch(() => null);
        sinProfesores = valorOpciones?.error?.code === "SIN_PROFESORES_PARA_MATERIA";
        if (!sinProfesores && (!opcionesRespuesta.ok || !Array.isArray(valorOpciones?.data))) throw new Error(valorOpciones?.error?.message ?? textoC19("ui.turnos.solicitar.errorProfesores"));
        opciones = sinProfesores ? [] : valorOpciones.data;
      }
      setTurno(actual); setProfesores(opciones); setSinProfesoresMateria(sinProfesores); setAlumnos(actual.alumnos);
      setProfesorId(actual.profesor_id ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : textoC19("ui.clases.interfaz.noSePudoCargarLaClase")); }
    finally { setCargando(false); }
  }, [id]);

  useEffect(() => { const timer = window.setTimeout(() => void cargar(), 0); return () => window.clearTimeout(timer); }, [cargar]);

  // Cambios sin guardar (HU-A-03 c2): se descartan al confirmar o al salir (Cancelar, c10).
  const sinGuardar = Boolean(turno && !confirmado && (profesorId !== (turno.profesor_id ?? "") || !mismosIds(alumnos.map(({ id: alumnoId }) => alumnoId), turno.alumnos.map(({ id: alumnoId }) => alumnoId))));
  useEffect(() => { setDirty(sinGuardar); }, [sinGuardar, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  const cupo = turno?.cupo_maximo ?? 0;
  const cupoAlcanzado = alumnos.length >= cupo;
  const limpiarErrores = () => { setError(""); setErrorAlumno(null); };
  const agregar = (alumno: AlumnoAgregado) => { if (!cupoAlcanzado) { setAlumnos((anteriores) => [...anteriores, alumno]); limpiarErrores(); } };
  const quitar = (alumnoId: string) => { setAlumnos((anteriores) => anteriores.filter(({ id: otro }) => otro !== alumnoId)); limpiarErrores(); };

  const pedirConfirmacion = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!turno || alumnos.length === 0 || !profesorId || confirmando) return;
    limpiarErrores();
    setConfirmando(true);
  };

  /**
   * Confirmación de HU-C-25 (C §2.18.3): asignar alumnos desde el centro es
   * una operación modificada en este sprint. `ConfirmarAccionDialog` llama a
   * esta función al confirmar; un rechazo del servidor se muestra dentro del
   * mismo diálogo (criterio 6) sin perder la selección.
   */
  const guardar = async () => {
    if (!turno) return;
    setErrorAlumno(null);
    let respuesta: Response;
    try {
      respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(id)}/participantes`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumno_ids: alumnos.map(({ id: alumnoId }) => alumnoId), ...(!turno.profesor_id ? { profesor_id: profesorId } : {}) }), cache: "no-store",
      });
    } catch { throw new Error(textoC19("ui.clases.interfaz.noSePudieronAsignarLosParticipantesIntentaNuevamente")); }
    const valor = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      const mensaje = valor?.error?.message ?? textoC19("ui.clases.interfaz.noSePudieronAsignarLosParticipantes");
      const alumnoId = valor?.error?.detalles?.alumno_id;
      if (typeof alumnoId === "string" && alumnos.some(({ id: otro }) => otro === alumnoId)) setErrorAlumno({ id: alumnoId, mensaje });
      throw new Error(mensaje);
    }
    setConfirmado(valor.data.estado);
    setInscripcionesConfirmadas(Array.isArray(valor.data.inscripciones) ? valor.data.inscripciones : []);
  };

  return <main className="mx-auto w-full min-w-0 max-w-2xl space-y-5 p-6">
    <LinkProtegido className="rounded-sm text-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={retorno} prefetch={false}>{textoC19("ui.clases.interfaz.volverAlListado")}</LinkProtegido>
    <h1 className="text-2xl font-semibold">{textoC19("ui.clases.interfaz.asignarProfesorYAlumnos")}</h1>
    {cargando ? <p role="status">{textoC19("ui.clases.interfaz.cargandoClase")}</p> : confirmado ? <div role="status" className="space-y-3 rounded-md bg-success p-5 text-success-foreground"><p className="font-semibold">{textoC19("ui.clases.interfaz.profesorYAlumnosAsignadosCorrectamente")}</p><p className="flex flex-wrap items-center gap-2">{(textoC19("ui.clases.interfaz.claseConfirmadaNumeroDos") + " ")}<EstadoTurnoBadge estado={confirmado} /></p>
      {inscripcionesConfirmadas.length > 0 && <ul aria-label={textoC19("ui.clases.interfaz.alumnosACobrar")} className="space-y-2">{inscripcionesConfirmadas.map((inscripcion) => {
        const alumno = alumnos.find(({ id: alumnoId }) => alumnoId === inscripcion.alumno_id);
        return <li key={inscripcion.alumno_id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-card/40 px-3 py-2 text-sm text-foreground">
          <span>{alumno?.nombre ?? inscripcion.alumno_id}</span>
          <Link className="inline-flex rounded-md border border-border px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={`/pagos/registrar?alumno=${encodeURIComponent(inscripcion.alumno_id)}&clase=${encodeURIComponent(id)}`} prefetch={false}
            aria-label={texto("ui.turnos.reserva.registrarPagoDe", { alumno: alumno?.nombre ?? "" })}>{texto("ui.turnos.reserva.registrarPago")}</Link>
        </li>;
      })}</ul>}
      <div className="flex flex-wrap gap-4"><Link className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(id)}?volver=${encodeURIComponent(retorno)}`} prefetch={false}>{textoC19("ui.clases.interfaz.verDetalle")}</Link><Link className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={retorno} prefetch={false}>{textoC19("ui.clases.interfaz.volverAlListado")}</Link></div></div> : !turno ? <div role="alert" className="space-y-3 rounded-md border border-border bg-card p-4"><p>{error}</p><Button variant="outline" onClick={() => void cargar()}>{textoC19("ui.formasPago.reintentar")}</Button></div> : turno.estado !== "PENDIENTE" ? <p role="alert">{textoC19("ui.clases.interfaz.unaClaseDisponibleOCompletaNoAdmiteCambiosDeParticipantesLosAlumnos")}</p> : !turno.aula_id ? <div role="status" className="space-y-3 rounded-md border border-border bg-card p-5"><p>{textoC19("ui.clases.interfaz.asignaUnAulaAntesDeConfirmarLaClase")}</p><Link className="text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/turnos/${encodeURIComponent(id)}/configuracion?volver=${encodeURIComponent(retorno)}`} prefetch={false}>{textoC19("ui.clases.interfaz.asignarAula")}</Link></div> : <form onSubmit={pedirConfirmacion} className="space-y-5 rounded-md border border-border bg-card p-5 text-card-foreground">
      <div className="space-y-1"><p className="font-medium">{turno.fecha} · {turno.hora_inicio}–{turno.hora_fin} · {turno.materia}</p><p className="text-sm text-muted-foreground">{(textoC19("ui.clases.interfaz.aulaNumeroDos") + " ")}{turno.aula}{(" " + textoC19("ui.clases.interfaz.cupoMaximoNumeroDos") + " ")}{turno.cupo_maximo}</p><EstadoTurnoBadge estado={turno.estado} /></div>
      {turno.profesor_id ? <p className="text-sm">{textoC19("ui.clases.interfaz.profesorYaAsignadoALaClase")}</p> : <div className="space-y-2"><label htmlFor="profesor" className="text-sm font-medium">{textoC19("ui.clases.interfaz.profesorNumeroCuatro")}</label>
        {sinProfesoresMateria ? <p role="status">{textoC19("ui.clases.interfaz.noHayProfesoresActivosAsociadosAEstaMateria")}</p> : profesores.length === 0 ? <p role="status">{textoC19("ui.clases.interfaz.noHayProfesoresDisponiblesParaEsteHorario")}</p> : <select id="profesor" value={profesorId} onChange={(event) => { setProfesorId(event.target.value); limpiarErrores(); }} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">{textoC19("ui.clases.calendario.seleccionaUnProfesor")}</option>{profesores.map((profesor) => <option key={profesor.id} value={profesor.id}>{profesor.apellido}, {profesor.nombre}</option>)}</select>}
      </div>}
      <fieldset className="space-y-2"><legend className="text-sm font-medium">{(textoC19("ui.clases.interfaz.alumnos") + " ")}<span className="font-normal text-muted-foreground">({alumnos.length}/{cupo})</span></legend>
        {alumnos.length === 0 ? <p className="text-sm text-muted-foreground">{textoC19("ui.clases.interfaz.todaviaNoAgregasteAlumnos")}</p> : <ul className="space-y-2" aria-label={textoC19("ui.clases.interfaz.alumnosAgregados")}>{alumnos.map((alumno) => {
          const conflicto = errorAlumno?.id === alumno.id ? errorAlumno.mensaje : "";
          return <li key={alumno.id} className={`space-y-1 rounded-md border p-2 ${conflicto ? "border-destructive" : "border-border"}`}>
            <div className="flex items-center justify-between gap-3"><span className="min-w-0 break-words text-sm">{alumno.nombre}{(" " + textoC19("ui.clases.interfaz.dni") + " ")}{alumno.dni}</span><Button type="button" variant="outline" size="sm" onClick={() => quitar(alumno.id)} aria-label={textoC19("ui.clases.interfaz.quitarA", { valor1: alumno.nombre })}>{textoC19("ui.clases.interfaz.quitar")}</Button></div>
            {conflicto && <p role="alert" className="text-sm text-destructive">{conflicto}</p>}
          </li>;
        })}</ul>}
        <label htmlFor="alumno-busqueda" className="sr-only">{textoC19("ui.clases.interfaz.buscarAlumno")}</label>
        <BuscadorAlumnos id="alumno-busqueda" excluir={alumnos.map(({ id: alumnoId }) => alumnoId)} deshabilitado={cupoAlcanzado} avisoDeshabilitado={textoC19("errores.turno.cupoInsuficiente")} onSeleccionar={(alumno) => agregar({ id: alumno.id, nombre: etiquetaAlumno(alumno), dni: alumno.dni })} />
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={alumnos.length === 0 || !profesorId}>{textoC19("ui.clases.interfaz.confirmarClase")}</Button><Link className={buttonVariants({ variant: "outline" })} href={`/turnos/${encodeURIComponent(id)}?volver=${encodeURIComponent(retorno)}`} prefetch={false}>{textoC19("ui.formasPago.cancelar")}</Link></div>
      <ConfirmarAccionDialog abierto={confirmando} onCerrar={() => setConfirmando(false)}
        titulo={texto("confirmaciones.inscripcion.centro", {
          // "Apellido, Nombre" → "Nombre Apellido": con varios alumnos, unidos por coma, el formato original sería ambiguo.
          alumno: alumnos.map(({ nombre }) => nombre.replace(/^([^,]+),\s*(.+)$/, "$2 $1")).join(", "), materia: turno.materia, fecha: fechaCorta(turno.fecha), hora: turno.hora_inicio,
        })}
        textoConfirmar={texto("ui.turnos.reserva.inscribir")} onConfirmar={guardar} onExito={() => setConfirmando(false)} />
    </form>}
  </main>;
}
