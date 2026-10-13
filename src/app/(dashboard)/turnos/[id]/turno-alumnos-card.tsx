import { texto as textoC19 } from "@/lib/textos";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ConfirmarAccionDialog } from "@/components/shared/confirmar-accion-dialog";
import { fechaCorta, fechaHoraDeInstante } from "@/lib/turno-detalle";
import { fetchOLanzar, fetchAutenticado } from "@/lib/fetch-autenticado";
import { iniciales } from "@/lib/turno-detalle";
import type { TurnoDetalle } from "@/types/turno.types";
import { texto } from "@/lib/textos";
import { TurnoClaseCard } from "./turno-clase-card";
import type { EstadoAsistencia, RegistroClaseDictada } from "@/types/historial.types";
import { BuscadorAlumnos, type AlumnoBuscado } from "../buscador-alumnos";
import { RegistrarIndicacionDialog } from "../../alumnos/[id]/registrar-indicacion-dialog";

/**
 * Tarjeta «Alumnos inscriptos · N de M» (mockup pág. 5): el listado completo,
 * no solo la ocupación. Con `gestionable` (HU-C-04 §2.5: permiso y turno
 * DISPONIBLE o COMPLETO) conserva el alta y la baja individual: «Agregar
 * alumno» en el encabezado y «Quitar» por fila. Cada acción se aplica en el
 * momento; el estado Disponible ⇄ Completo lo resuelve el servidor. «Agregar
 * alumno» pide antes la confirmación de HU-C-25 (C §2.18.3).
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
  const [aviso, setAviso] = useState("");
  const [porInscribir, setPorInscribir] = useState<AlumnoBuscado | null>(null);
  // El alumno ya tuvo una reserva sin pagar en esta clase: se inscribe al confirmar el pago (C §2.18.3).
  const [requierePago, setRequierePago] = useState(false);
  const [porQuitar, setPorQuitar] = useState<{ id: string; nombre: string } | null>(null);
  const estadoAlta = useRef("");
  // Solo se gestiona en turnos DISPONIBLE/COMPLETO, que siempre tienen aula y cupo.
  const cupoAlcanzado = turno.cupo_maximo !== null && turno.alumnos.length >= turno.cupo_maximo;
  const ocupacion = turno.cupo_maximo === null ? textoC19("ui.clases.interfaz.sinAsignar") : textoC19("ui.clases.interfaz.deNumeroDos", { valor1: turno.alumnos.length, valor2: turno.cupo_maximo });

  const confirmarInscripcion = async () => {
    if (!porInscribir) return;
    setRequierePago(false);
    const respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(turno.id)}/alumnos`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alumno_id: porInscribir.id }),
    });
    const valor = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      setRequierePago(valor?.error?.code === "INSCRIPCION_REQUIERE_PAGO");
      throw new Error(valor?.error?.message ?? "");
    }
    estadoAlta.current = valor?.data?.estado ?? "";
  };
  const cerrarInscripcion = () => { setPorInscribir(null); setRequierePago(false); };
  const inscripcionConfirmada = () => {
    setAviso(estadoAlta.current === "COMPLETO" ? textoC19("ui.clases.interfaz.alumnoAgregadoLaClaseAlcanzoSuCupoMaximoYPasoACompleta") : textoC19("ui.clases.interfaz.alumnoAgregadoALaClase"));
    void onCambio();
  };
  // «Quitar» pide antes la confirmación de HU-C-25 (C §2.5, §2.20): un rechazo del servidor se muestra en el mismo diálogo.
  const confirmarQuitar = async () => {
    if (!porQuitar) return;
    const respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(turno.id)}/alumnos/${encodeURIComponent(porQuitar.id)}`, { method: "DELETE", cache: "no-store" });
    const valor = await respuesta.json().catch(() => null);
    if (!respuesta.ok) throw new Error(valor?.error?.message ?? "");
    estadoAlta.current = valor?.data?.estado ?? "";
  };
  const quitadoConfirmado = () => {
    setAviso(turno.estado === "COMPLETO" && estadoAlta.current === "DISPONIBLE" ? textoC19("ui.clases.interfaz.alumnoQuitadoLaClaseVolvioADisponible") : textoC19("ui.clases.interfaz.alumnoQuitadoDeLaClase"));
    void onCambio();
  };

  return <section aria-labelledby="inscripciones-titulo" className="space-y-3 rounded-md border border-border bg-card p-4 text-card-foreground sm:p-[22px]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h2 id="inscripciones-titulo" className="text-sm font-semibold">{(textoC19("ui.clases.interfaz.alumnosInscriptosNumeroTres") + " ")}<span className="font-normal text-muted-foreground">· {ocupacion}</span></h2>
      {gestionable && <div className="w-full max-w-xs space-y-1"><label htmlFor="agregar-alumno" className="text-xs">{textoC19("ui.clases.interfaz.agregarAlumno")}</label>
        <BuscadorAlumnos id="agregar-alumno" excluir={turno.alumnos.map(({ id }) => id)} deshabilitado={cupoAlcanzado} avisoDeshabilitado={cupoAlcanzado ? textoC19("errores.turno.cupoInsuficiente") : undefined} onSeleccionar={setPorInscribir} />
      </div>}
    </div>
    <div className="flex justify-between text-xs uppercase tracking-wide text-muted-foreground"><span>{texto("ui.historial.correccionClase.alumno")}</span><span>{texto("ui.historial.correccionClase.asistencia")}</span></div>
    {alumnosLista.length === 0 ? <p className="text-sm text-muted-foreground">{textoC19("ui.clases.interfaz.laClaseNoTieneAlumnosInscriptos")}</p> : <ul className="divide-y divide-border border-t border-border" aria-label={textoC19("ui.clases.interfaz.alumnosInscriptos")}>{alumnosLista.map((alumno) => {
      const reserva = turno.alumnos.find(({ id }) => id === alumno.id);
      const inscripcion = reserva?.inscripcion;
      return <li key={alumno.id} className="space-y-1 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">{iniciales(alumno.nombre)}</span>
            <span className="min-w-0 break-words text-sm">{alumno.nombre}</span>
          </span>
          {editable && <div role="group" aria-label={textoC19("ui.clases.interfaz.asistenciaDe", { valor1: alumno.nombre })} className="flex shrink-0 gap-1">
            {(["PRESENTE", "AUSENTE"] as const).map((estado) => <button key={estado} type="button" disabled={guardandoAsistencia}
              aria-pressed={(seleccion[alumno.id] ?? "PRESENTE") === estado}
              onClick={() => setSeleccion((actual) => ({ ...actual, [alumno.id]: estado }))}
              className={`disabled:cursor-wait disabled:opacity-60 min-h-9 rounded-md border px-2 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${(seleccion[alumno.id] ?? "PRESENTE") === estado ? estado === "PRESENTE" ? "border-attendance-selected bg-attendance-selected text-card" : "border-destructive bg-destructive text-card" : "border-border text-muted-foreground hover:bg-muted"}`}>
              {texto(estado === "PRESENTE" ? "ui.historial.asistencia.presente" : "ui.historial.asistencia.ausente")}
            </button>)}
          </div>}
          {!corrigiendo && registroId && registro?.id === registroId && <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${asistenciaGuardada.get(alumno.id) === "PRESENTE" ? "bg-success text-success-foreground" : asistenciaGuardada.get(alumno.id) === "AUSENTE" ? "bg-destructive-soft text-destructive-soft-foreground" : "bg-muted text-muted-foreground"}`}>
            {asistenciaGuardada.get(alumno.id) === "PRESENTE" ? texto("ui.historial.asistencia.presente") : asistenciaGuardada.get(alumno.id) === "AUSENTE" ? texto("ui.historial.asistencia.ausente") : textoC19("ui.clases.interfaz.sinControlDeAsistencia")}
          </span>}
          {gestionable && !editable && !registroId && <Button type="button" variant="outline" size="sm" onClick={() => setPorQuitar({ id: alumno.id, nombre: alumno.nombre })} aria-label={textoC19("ui.clases.interfaz.quitarA", { valor1: alumno.nombre })}>{textoC19("ui.clases.interfaz.quitar")}</Button>}
        </div>
        {inscripcion && <div className="ml-10 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{inscripcion.estado_pago === "RESERVADA" && inscripcion.vence_el && turno.estado !== "CANCELADO"
            ? texto("ui.turnos.reserva.venceEl", { vencimiento: fechaHoraDeInstante(inscripcion.vence_el) })
            : texto(inscripcion.estado_pago === "PAGADA" ? "ui.turnos.reserva.pagada" : "ui.turnos.reserva.sinRegistrar")}</span>
          {reserva?.puede_registrar_pago && <Link className="inline-flex rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={`/pagos/registrar?alumno=${encodeURIComponent(alumno.id)}&clase=${encodeURIComponent(turno.id)}`} prefetch={false}
            aria-label={texto("ui.turnos.reserva.registrarPagoDe", { alumno: alumno.nombre })}>{texto("ui.turnos.reserva.registrarPago")}</Link>}
        </div>}
        {alumno.puede_ver_historial && <Link className="ml-10 inline-flex text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={esProfesor
          ? `/turnos/${encodeURIComponent(turno.id)}/alumnos/${encodeURIComponent(alumno.id)}/historial`
          : `/alumnos/${encodeURIComponent(alumno.id)}?tab=historial&materia_id=${encodeURIComponent(turno.materia_id)}&volver=${encodeURIComponent(`/turnos/${turno.id}`)}`} prefetch={false}>{textoC19("ui.clases.interfaz.verHistorial")}</Link>}
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
      <ConfirmarAccionDialog abierto={confirmarCorreccion} onCerrar={() => setConfirmarCorreccion(false)} titulo={texto("ui.historial.correccionClase.tituloCorregir", { materia: turno.materia, fecha: fechaCorta(turno.fecha), hora: turno.hora_inicio })} detalle={<div className="space-y-2"><p>{motivo.trim()}</p><ul>{asistencias.map(a => <li key={a.alumno_id}>{alumnosLista.find(x => x.id === a.alumno_id)?.nombre ?? registroVisible?.alumnos.find(x => x.id === a.alumno_id)?.nombre_completo}: {texto(a.estado === "PRESENTE" ? "ui.historial.asistencia.presente" : "ui.historial.asistencia.ausente")}</li>)}</ul></div>} textoConfirmar={texto("ui.historial.correccionClase.guardar")} onConfirmar={async () => {
        setGuardandoAsistencia(true);
        try { await fetchOLanzar(`/api/turnos/${encodeURIComponent(turno.id)}/clase-dictada/correccion-asistencia`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asistencias, motivo: motivo.trim() }) }); }
        finally { setGuardandoAsistencia(false); }
      }} onExito={() => { setCorrigiendo(false); toast.success(texto("ui.historial.correccionClase.guardada")); void cargarAsistencia(); void onCambio(); }} />
    </div>}
    {cargandoAsistencia && <p role="status" className="text-sm text-muted-foreground">{texto("ui.historial.asistencia.cargando")}</p>}
    {errorAsistencia && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{errorAsistencia}</p><Button variant="outline" onClick={() => void cargarAsistencia()}>{textoC19("ui.formasPago.reintentar")}</Button></div>}
    {!corrigiendo && registroId && registro?.id === registroId && <p role="status" className="text-sm font-medium">{registro.totales ? texto("ui.historial.asistencia.totales", {
      presentes: texto(registro.totales.presentes === 1 ? "ui.historial.asistencia.cantidadPresente" : "ui.historial.asistencia.cantidadPresentes", { cantidad: registro.totales.presentes }),
      ausentes: texto(registro.totales.ausentes === 1 ? "ui.historial.asistencia.cantidadAusente" : "ui.historial.asistencia.cantidadAusentes", { cantidad: registro.totales.ausentes }),
    }) : textoC19("ui.clases.interfaz.claseSinControlDeAsistencia")}</p>}
    {!corrigiendo && puedeRegistrarIndicacion && registroVisible && <div className="space-y-3 rounded-md border border-border bg-background p-3">
      <h3 className="text-sm font-semibold">{textoC19("ui.clases.interfaz.indicacionesAcademicasDeEstaClase")}</h3>
      <ul className="divide-y divide-border" aria-label={textoC19("ui.clases.interfaz.alumnosDeLaClaseDictadaParaRegistrarIndicaciones")}>
        {registroVisible.alumnos.map((alumnoRegistro) => <li key={alumnoRegistro.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
          <span className="text-sm">{alumnoRegistro.nombre_completo}</span>
          <div className="flex flex-wrap items-center gap-3">
            {!turno.alumnos.some(({ id }) => id === alumnoRegistro.id) && <Link className="text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={esProfesor
              ? `/turnos/${encodeURIComponent(turno.id)}/alumnos/${encodeURIComponent(alumnoRegistro.id)}/historial`
              : `/alumnos/${encodeURIComponent(alumnoRegistro.id)}?tab=historial&materia_id=${encodeURIComponent(turno.materia_id)}&volver=${encodeURIComponent(`/turnos/${turno.id}`)}`} prefetch={false}>{textoC19("ui.clases.interfaz.verHistorial")}</Link>}
            {!esProfesor && <RegistrarIndicacionDialog
              alumnoId={alumnoRegistro.id}
              nombreAlumno={alumnoRegistro.nombre_completo}
              materias={[{ id: turno.materia_id, nombre: turno.materia }]}
              clases={[{ id: registroVisible.id, materia_id: turno.materia_id, fecha: turno.fecha }]}
              materiaInicial={turno.materia_id}
              materiaFija={esProfesor}
              claseInicial={registroVisible.id}
              onRegistrado={onCambio}
            />}
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
    <ConfirmarAccionDialog abierto={porInscribir !== null} onCerrar={cerrarInscripcion}
      contenido={requierePago && porInscribir ? <Link className="mt-3 inline-flex rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={`/pagos/registrar?alumno=${encodeURIComponent(porInscribir.id)}&clase=${encodeURIComponent(turno.id)}`} prefetch={false}
        aria-label={texto("ui.turnos.reserva.registrarPagoDe", { alumno: `${porInscribir.nombre} ${porInscribir.apellido}` })}>{texto("ui.turnos.reserva.registrarPago")}</Link> : undefined}
      titulo={porInscribir ? texto("confirmaciones.inscripcion.centro", {
        alumno: `${porInscribir.nombre} ${porInscribir.apellido}`, materia: turno.materia, fecha: fechaCorta(turno.fecha), hora: turno.hora_inicio,
      }) : ""}
      textoConfirmar={texto("ui.turnos.reserva.inscribir")} onConfirmar={confirmarInscripcion} onExito={inscripcionConfirmada} />
    <ConfirmarAccionDialog abierto={porQuitar !== null} onCerrar={() => setPorQuitar(null)} irreversible
      titulo={porQuitar ? texto("confirmaciones.inscripcion.quitar", {
        // "Apellido, Nombre" → "Nombre Apellido", como en la confirmación de inscribir.
        alumno: porQuitar.nombre.replace(/^([^,]+),\s*(.+)$/, "$2 $1"), materia: turno.materia, fecha: fechaCorta(turno.fecha), hora: turno.hora_inicio,
      }) : ""}
      textoConfirmar={textoC19("ui.clases.interfaz.quitar")} onConfirmar={confirmarQuitar} onExito={quitadoConfirmado} />
    {aviso && <p role="status" className="rounded-md bg-success p-3 text-sm text-success-foreground">{aviso}</p>}
  </section>;
}
