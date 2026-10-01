"use client";

import { useEffect, useRef, useState } from "react";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { Button } from "@/components/ui/button";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { horaAMinutos, minutosAHora } from "@/lib/horario-atencion";
import { PasoMateriaTurno, type MateriaOpcionTurno } from "../paso-materia-turno";
import { PasoProfesorTurno, type ProfesorOpcionTurno } from "../paso-profesor-turno";
import { PasoFechaHorarioTurno, fechaLegible } from "../paso-fecha-horario-turno";
import { SeccionAulaTurno, type AulaOpcion } from "../seccion-aula-turno";
import { PasoAlumnosTurno, type AlumnoOpcionTurno, type AlumnoSeleccionadoTurno } from "../paso-alumnos-turno";
import { EstadoTurnoBadge } from "../estado-turno-badge";
import { ProgresoTurno, type PasoTurno } from "./progreso-turno";
import { ResumenTurno } from "./resumen-turno";
import { TurnoRecurrente } from "./turno-recurrente";

type SeleccionTurno = {
  materiaId: string;
  profesorId: string;
  duracionMin: number | null;
  fecha: string;
  horaInicio: string;
  alumnos: AlumnoSeleccionadoTurno[];
};
type ConfiguracionPersistida = Pick<SeleccionTurno, "materiaId" | "profesorId" | "duracionMin" | "fecha" | "horaInicio">;
type ConsultaConteos = { estado: "listas" | "error"; cantidades: Record<string, number>; mensaje: string };
type ConsultaProfesores = { materiaId: string; estado: "cargando" | "listas" | "error"; opciones: ProfesorOpcionTurno[]; mensaje: string };
type ConsultaAulas = { estado: "cargando" | "listas" | "sinAulas" | "error"; opciones: AulaOpcion[]; mensaje: string };
type ConsultaAlumnos = { estado: "cargando" | "listas" | "error"; opciones: AlumnoOpcionTurno[]; mensaje: string };
type Disponibilidad = { fechas: { fecha: string; franjas: { inicios: string[] }[] }[] };

const seleccionInicial: SeleccionTurno = { materiaId: "", profesorId: "", duracionMin: null, fecha: "", horaInicio: "", alumnos: [] };

/** Solo se conserva una elección anterior si todavía figura entre los inicios del servidor. */
function seleccionSigueDisponible(disponibilidad: Disponibilidad, fecha: string, hora: string) {
  const dia = disponibilidad.fechas.find((opcion) => opcion.fecha === fecha);
  return Boolean(dia && (!hora || dia.franjas.some((franja) => franja.inicios.includes(hora))));
}

async function obtenerConfiguracionTurno() {
  const respuesta = await fetchAutenticado("/api/turnos/configuracion", { cache: "no-store" });
  const valor = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !Array.isArray(valor?.data?.materias) || !Array.isArray(valor?.data?.parametros?.duraciones_permitidas_minutos)) {
    throw new Error(valor?.error?.message ?? "No se pudo cargar la configuración del turno");
  }
  return { materias: valor.data.materias as MateriaOpcionTurno[], duraciones: valor.data.parametros.duraciones_permitidas_minutos as number[],
    granularidad: Number.isSafeInteger(valor.data.parametros.granularidad_minutos) && valor.data.parametros.granularidad_minutos > 0
      ? valor.data.parametros.granularidad_minutos as number : null };
}

export function TurnoWizard() {
  const { setDirty } = useDirtyState();
  const [modo, setModo] = useState<"individual" | "recurrente">("individual");
  const [recurrenteOcupado, setRecurrenteOcupado] = useState(false);
  const [paso, setPaso] = useState<PasoTurno>(1);
  const [pasoMaximoHabilitado, setPasoMaximoHabilitado] = useState<PasoTurno>(1);
  const [seleccion, setSeleccion] = useState<SeleccionTurno>(seleccionInicial);
  const [materias, setMaterias] = useState<MateriaOpcionTurno[]>([]);
  const [duracionesPermitidas, setDuracionesPermitidas] = useState<number[]>([]);
  const [granularidadMin, setGranularidadMin] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [reintentoMaterias, setReintentoMaterias] = useState(0);
  const [consultaConteos, setConsultaConteos] = useState<ConsultaConteos | null>(null);
  const [reintentoConteos, setReintentoConteos] = useState(0);
  const [consultaProfesores, setConsultaProfesores] = useState<ConsultaProfesores | null>(null);
  const [reintentoProfesores, setReintentoProfesores] = useState(0);
  const [turnoId, setTurnoId] = useState("");
  const [configuracionPersistida, setConfiguracionPersistida] = useState<ConfiguracionPersistida | null>(null);
  const [consultaAulas, setConsultaAulas] = useState<ConsultaAulas | null>(null);
  const [reintentoAulas, setReintentoAulas] = useState(0);
  const [consultaAlumnos, setConsultaAlumnos] = useState<ConsultaAlumnos | null>(null);
  const [reintentoAlumnos, setReintentoAlumnos] = useState(0);
  const [aulaIdElegida, setAulaIdElegida] = useState("");
  const [aulaGuardada, setAulaGuardada] = useState<AulaOpcion | null>(null);
  const [cupoMaximo, setCupoMaximo] = useState<number | null>(null);
  const [resultadoFinal, setResultadoFinal] = useState<"DISPONIBLE" | "COMPLETO" | null>(null);
  const [errorAlumno, setErrorAlumno] = useState<{ id: string; mensaje: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);
  const [errorGuardado, setErrorGuardado] = useState("");

  useEffect(() => {
    let vigente = true;
    void obtenerConfiguracionTurno()
      .then(({ materias, duraciones, granularidad }) => {
        if (!vigente) return;
        setMaterias(materias);
        setDuracionesPermitidas(duraciones);
        setGranularidadMin(granularidad);
      })
      .catch((error) => {
        if (vigente) setErrorCarga(error instanceof Error ? error.message : "No se pudo cargar la configuración del turno");
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [reintentoMaterias]);

  const reintentarMaterias = () => {
    setCargando(true); setErrorCarga(""); setConsultaConteos(null);
    setReintentoMaterias((valor) => valor + 1);
  };

  useEffect(() => {
    if (materias.length === 0) return;
    const controlador = new AbortController();
    const cargarConteos = async () => {
      try {
        const pares = await Promise.all(materias.map(async ({ id }) => {
          const respuesta = await fetchAutenticado(`/api/turnos/profesores/por-materia?materia_id=${encodeURIComponent(id)}`, { cache: "no-store", signal: controlador.signal });
          const valor = await respuesta.json().catch(() => null);
          if (valor?.error?.code === "SIN_PROFESORES_PARA_MATERIA") return [id, 0] as const;
          if (!respuesta.ok || !Array.isArray(valor?.data)) throw new Error(valor?.error?.message ?? "No se pudo cargar la cantidad de profesores");
          return [id, valor.data.length] as const;
        }));
        if (!controlador.signal.aborted) setConsultaConteos({ estado: "listas", cantidades: Object.fromEntries(pares), mensaje: "" });
      } catch (error) {
        if (!controlador.signal.aborted) setConsultaConteos({ estado: "error", cantidades: {}, mensaje: error instanceof Error ? error.message : "No se pudo cargar la cantidad de profesores" });
      }
    };
    void cargarConteos();
    return () => controlador.abort();
  }, [materias, reintentoConteos]);

  const materiaId = seleccion.materiaId;
  useEffect(() => {
    if (!materiaId) return;
    const controlador = new AbortController();
    const anterior = seleccion;
    const cargarProfesores = async () => {
      setConsultaProfesores({ materiaId, estado: "cargando", opciones: [], mensaje: "" });
      try {
        const respuesta = await fetchAutenticado(`/api/turnos/profesores/opciones-wizard?materia_id=${encodeURIComponent(materiaId)}`, { cache: "no-store", signal: controlador.signal });
        const valor = await respuesta.json().catch(() => null);
        if (!respuesta.ok || !Array.isArray(valor?.data)) throw new Error(valor?.error?.message ?? "No se pudieron cargar los profesores");
        if (controlador.signal.aborted) return;
        const opciones = valor.data as ProfesorOpcionTurno[];
        const sigueDictando = opciones.some((opcion) => opcion.id === anterior.profesorId);
        let horarioVigente = true;
        if (sigueDictando && anterior.duracionMin && anterior.fecha) {
          try {
            const query = new URLSearchParams({ materia_id: materiaId, duracion_min: String(anterior.duracionMin) });
            const disponibilidadRespuesta = await fetchAutenticado(`/api/turnos/profesores/${encodeURIComponent(anterior.profesorId)}/disponibilidad?${query}`, { cache: "no-store", signal: controlador.signal });
            const disponibilidadValor = await disponibilidadRespuesta.json().catch(() => null);
            horarioVigente = disponibilidadRespuesta.ok && Array.isArray(disponibilidadValor?.data?.fechas)
              && seleccionSigueDisponible(disponibilidadValor.data, anterior.fecha, anterior.horaInicio);
          } catch { horarioVigente = false; }
        }
        if (controlador.signal.aborted) return;
        setSeleccion((actual) => {
          if (actual.materiaId !== materiaId || actual.profesorId !== anterior.profesorId) return actual;
          if (actual.profesorId && !sigueDictando) return { ...actual, profesorId: "", fecha: "", horaInicio: "" };
          if (!horarioVigente && actual.fecha === anterior.fecha && actual.horaInicio === anterior.horaInicio) return { ...actual, fecha: "", horaInicio: "" };
          return actual;
        });
        setConsultaProfesores({ materiaId, estado: "listas", opciones, mensaje: "No hay profesores con horario de atención registrado para esta materia" });
      } catch (error) {
        if (!controlador.signal.aborted) setConsultaProfesores({ materiaId, estado: "error", opciones: [], mensaje: error instanceof Error ? error.message : "No se pudieron cargar los profesores" });
      }
    };
    void cargarProfesores();
    return () => controlador.abort();
    // La lista cambia solo con la materia o con un reintento explícito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materiaId, reintentoProfesores]);

  useEffect(() => {
    if (modo !== "individual" || paso !== 4 || !turnoId) return;
    const controlador = new AbortController();
    const cargarAulas = async () => {
      setConsultaAulas({ estado: "cargando", opciones: [], mensaje: "" });
      setAulaIdElegida("");
      try {
        const respuesta = await fetchAutenticado(`/api/turnos/aula/opciones?turno_id=${encodeURIComponent(turnoId)}`, { cache: "no-store", signal: controlador.signal });
        const valor = await respuesta.json().catch(() => null);
        if (controlador.signal.aborted) return;
        if (valor?.error?.code === "SIN_AULAS_ACTIVAS") {
          setAulaGuardada(null);
          setCupoMaximo(null);
          setConsultaAulas({ estado: "sinAulas", opciones: [], mensaje: "" });
          return;
        }
        if (!respuesta.ok || !Array.isArray(valor?.data)) throw new Error(valor?.error?.message ?? "No se pudieron cargar las aulas");
        const opciones = valor.data as AulaOpcion[];
        const guardada = opciones.find((aula) => aula.id === aulaGuardada?.id);
        if (aulaGuardada && !guardada) { setAulaGuardada(null); setCupoMaximo(null); }
        setAulaIdElegida(guardada?.id ?? "");
        setConsultaAulas({ estado: "listas", opciones, mensaje: "" });
      } catch (error) {
        if (!controlador.signal.aborted) setConsultaAulas({ estado: "error", opciones: [], mensaje: error instanceof Error ? error.message : "No se pudieron cargar las aulas" });
      }
    };
    void cargarAulas();
    return () => controlador.abort();
    // Se vuelve a consultar al entrar al paso o al pedir un reintento; el aula guardada se reconcilia con esa respuesta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, paso, turnoId, reintentoAulas]);

  useEffect(() => {
    if (modo !== "individual" || paso !== 5 || !turnoId || !aulaGuardada) return;
    const controlador = new AbortController();
    const cargarAlumnos = async () => {
      setConsultaAlumnos({ estado: "cargando", opciones: [], mensaje: "" });
      try {
        const respuesta = await fetchAutenticado(`/api/turnos/participantes/alumnos/opciones?turno_id=${encodeURIComponent(turnoId)}`, { cache: "no-store", signal: controlador.signal });
        const valor = await respuesta.json().catch(() => null);
        if (!respuesta.ok || valor?.data?.turno_id !== turnoId || !Array.isArray(valor?.data?.alumnos)) throw new Error(valor?.error?.message ?? "No se pudieron cargar los alumnos elegibles");
        if (controlador.signal.aborted) return;
        const opciones = valor.data.alumnos as AlumnoOpcionTurno[];
        const elegibles = new Set(opciones.map(({ id }) => id));
        setSeleccion((anterior) => ({ ...anterior, alumnos: anterior.alumnos.filter(({ id }) => elegibles.has(id)) }));
        setConsultaAlumnos({ estado: "listas", opciones, mensaje: "" });
      } catch (error) {
        if (!controlador.signal.aborted) setConsultaAlumnos({ estado: "error", opciones: [], mensaje: error instanceof Error ? error.message : "No se pudieron cargar los alumnos elegibles" });
      }
    };
    void cargarAlumnos();
    return () => controlador.abort();
  }, [modo, paso, turnoId, aulaGuardada, reintentoAlumnos]);

  useEffect(() => {
    const cambiosConfiguracion = configuracionPersistida
      ? seleccion.materiaId !== configuracionPersistida.materiaId || seleccion.profesorId !== configuracionPersistida.profesorId
        || seleccion.duracionMin !== configuracionPersistida.duracionMin || seleccion.fecha !== configuracionPersistida.fecha
        || seleccion.horaInicio !== configuracionPersistida.horaInicio
      : Boolean(seleccion.materiaId || seleccion.profesorId || seleccion.duracionMin || seleccion.fecha || seleccion.horaInicio);
    if (modo === "individual") setDirty(!resultadoFinal && (cambiosConfiguracion || Boolean((aulaIdElegida && aulaIdElegida !== aulaGuardada?.id) || seleccion.alumnos.length)));
  }, [modo, seleccion, configuracionPersistida, aulaIdElegida, aulaGuardada, resultadoFinal, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  const materia = materias.find(({ id }) => id === seleccion.materiaId);
  const consultaVigente = consultaProfesores?.materiaId === materiaId ? consultaProfesores : null;
  const profesores = consultaVigente?.estado === "listas" ? consultaVigente.opciones : [];
  const profesor = profesores.find(({ id }) => id === seleccion.profesorId);
  const fechaHorario = seleccion.fecha && seleccion.horaInicio && seleccion.duracionMin
    ? `${seleccion.fecha.split("-").reverse().join("/")} · ${seleccion.horaInicio}–${minutosAHora(horaAMinutos(seleccion.horaInicio) + seleccion.duracionMin)}` : null;
  const aulaElegida = consultaAulas?.estado === "listas" ? consultaAulas.opciones.find((aula) => aula.id === aulaIdElegida) : undefined;
  const cantidadAlumnos = seleccion.alumnos.length;
  const estadoPredictivo = cupoMaximo !== null && cantidadAlumnos === cupoMaximo ? "Completo" : "Disponible";
  const estadoInicial = `${estadoPredictivo}, ${cantidadAlumnos} ${cantidadAlumnos === 1 ? "alumno" : "alumnos"}`;
  const puedeContinuar = paso === 1 ? Boolean(materia) : paso === 2 ? Boolean(profesor) : paso === 4 ? Boolean(turnoId && aulaElegida)
    : paso === 5 ? Boolean(turnoId && aulaGuardada && cupoMaximo && consultaAlumnos?.estado === "listas" && seleccion.alumnos.length > 0 && seleccion.alumnos.length <= cupoMaximo) : false;

  const cambiarMateria = (nuevaMateriaId: string) => {
    if (nuevaMateriaId === seleccion.materiaId) return;
    setSeleccion((anterior) => ({ ...anterior, materiaId: nuevaMateriaId }));
    setPasoMaximoHabilitado(1);
    setErrorGuardado("");
  };
  const cambiarProfesor = (nuevoProfesorId: string) => {
    if (nuevoProfesorId === seleccion.profesorId) return;
    setSeleccion((anterior) => ({ ...anterior, profesorId: nuevoProfesorId, fecha: "", horaInicio: "" }));
    setPasoMaximoHabilitado(2);
    setErrorGuardado("");
  };
  const seleccionarPaso = (destino: PasoTurno) => {
    if (destino === paso || destino > pasoMaximoHabilitado || guardando || guardandoRef.current || resultadoFinal) return;
    setPaso(destino);
  };
  const cambiarMateriaRecurrente = (nuevaMateriaId: string) => {
    if (nuevaMateriaId === seleccion.materiaId) return;
    setSeleccion((anterior) => ({ ...anterior, materiaId: nuevaMateriaId, profesorId: "", fecha: "", horaInicio: "" }));
    setPaso(1); setPasoMaximoHabilitado(1); setErrorGuardado("");
  };
  const cambiarProfesorRecurrente = (nuevoProfesorId: string) => {
    if (nuevoProfesorId === seleccion.profesorId) return;
    setSeleccion((anterior) => ({ ...anterior, profesorId: nuevoProfesorId, fecha: "", horaInicio: "" }));
    setPaso(2); setPasoMaximoHabilitado(2); setErrorGuardado("");
  };
  const retroceder = () => { if (paso > 1) seleccionarPaso((paso - 1) as PasoTurno); };

  const confirmarFechaHorario = async () => {
    if (guardandoRef.current || !profesor || !seleccion.duracionMin || !seleccion.fecha || !seleccion.horaInicio) return;
    guardandoRef.current = true;
    setGuardando(true); setErrorGuardado("");
    const actual = seleccion;
    const payload = { materia_id: actual.materiaId, profesor_id: actual.profesorId, fecha: actual.fecha,
      hora_inicio: actual.horaInicio, duracion_min: actual.duracionMin };
    try {
      const respuesta = await fetchAutenticado(turnoId ? `/api/turnos/${encodeURIComponent(turnoId)}/configuracion` : "/api/turnos", {
        method: turnoId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store",
      });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !valor?.data?.id) throw new Error(valor?.error?.message ?? "No se pudo guardar la configuración del turno");
      if (turnoId && (valor.data.aula_desasignada === true || (valor.data.aula_desasignada === false && valor.data.cupo_maximo === null))) {
        setAulaGuardada(null);
        setCupoMaximo(null);
        setAulaIdElegida("");
      }
      setConsultaAulas(null);
      setTurnoId(valor.data.id);
      setConfiguracionPersistida({ materiaId: actual.materiaId, profesorId: actual.profesorId, duracionMin: actual.duracionMin, fecha: actual.fecha, horaInicio: actual.horaInicio });
      setPasoMaximoHabilitado(4);
      setPaso(4);
    } catch (error) { setErrorGuardado(error instanceof Error ? error.message : "No se pudo guardar la configuración del turno"); }
    finally { guardandoRef.current = false; setGuardando(false); }
  };

  const confirmarAula = async () => {
    if (guardandoRef.current || !turnoId || !aulaElegida) return;
    if (aulaGuardada?.id === aulaElegida.id) { setPasoMaximoHabilitado(5); setPaso(5); return; }
    guardandoRef.current = true;
    setGuardando(true); setErrorGuardado("");
    try {
      const respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(turnoId)}/aula`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aula_id: aulaElegida.id }), cache: "no-store",
      });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok || valor?.data?.aula_id !== aulaElegida.id) throw new Error(valor?.error?.message ?? "No se pudo asignar el aula");
      setAulaGuardada(aulaElegida);
      setCupoMaximo(valor.data.cupo_maximo);
      setPaso(5);
      setPasoMaximoHabilitado(5);
    } catch (error) { setErrorGuardado(error instanceof Error ? error.message : "No se pudo asignar el aula"); }
    finally { guardandoRef.current = false; setGuardando(false); }
  };

  const confirmarParticipantes = async () => {
    if (guardandoRef.current || resultadoFinal || !puedeContinuar || !turnoId) return;
    guardandoRef.current = true;
    setGuardando(true); setErrorGuardado(""); setErrorAlumno(null);
    try {
      const respuesta = await fetchAutenticado(`/api/turnos/${encodeURIComponent(turnoId)}/participantes`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumno_ids: seleccion.alumnos.map(({ id }) => id) }), cache: "no-store",
      });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !["DISPONIBLE", "COMPLETO"].includes(valor?.data?.estado)) {
        const mensaje = valor?.error?.message ?? "No se pudo confirmar el turno";
        const alumnoId = valor?.error?.detalles?.alumno_id;
        if (typeof alumnoId === "string" && seleccion.alumnos.some(({ id }) => id === alumnoId)) setErrorAlumno({ id: alumnoId, mensaje });
        else setErrorGuardado(mensaje);
        return;
      }
      setResultadoFinal(valor.data.estado);
    } catch { setErrorGuardado("No se pudo confirmar el turno. Intentá nuevamente."); }
    finally { guardandoRef.current = false; setGuardando(false); }
  };

  return <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
    <header className="space-y-3">
      <Breadcrumb tramos={[{ etiqueta: "Turnos", href: "/turnos" }, { etiqueta: "Nuevo turno" }]} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1"><h1 className="text-3xl font-semibold tracking-tight">Nuevo turno</h1><p className="text-sm text-muted-foreground">{modo === "individual" ? "Materia → Profesor → Fecha y horario → Aula → Alumnos." : "Materia → Profesor → Franja y horario → Aula y rango → Vista previa."}</p></div>
        <div role="group" aria-label="Tipo de creación de turnos" className="inline-flex max-w-full gap-1 rounded-lg border border-border bg-muted p-1">
          <button type="button" aria-pressed={modo === "individual"} disabled={guardando || recurrenteOcupado} onClick={() => setModo("individual")} className={`rounded-md px-4 py-2 text-sm font-medium ${modo === "individual" ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground"}`}>Generar un turno</button>
          <button type="button" aria-pressed={modo === "recurrente"} disabled={guardando || recurrenteOcupado} onClick={() => setModo("recurrente")} className={`rounded-md px-4 py-2 text-sm font-medium ${modo === "recurrente" ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground"}`}>Generar varios turnos</button>
        </div>
      </div>
    </header>

    {modo === "recurrente" ? <TurnoRecurrente materias={materias} materiaId={seleccion.materiaId} profesorId={seleccion.profesorId}
      profesores={profesores} profesoresPorMateria={consultaConteos?.cantidades ?? {}}
      cargandoMaterias={cargando} errorMaterias={errorCarga} onReintentarMaterias={reintentarMaterias}
      cargandoConteos={!consultaConteos} errorConteos={consultaConteos?.estado === "error" ? consultaConteos.mensaje : ""}
      onReintentarConteos={() => { setConsultaConteos(null); setReintentoConteos((valor) => valor + 1); }}
      cargandoProfesores={!consultaVigente || consultaVigente.estado === "cargando"} errorProfesores={consultaVigente?.estado === "error" ? consultaVigente.mensaje : ""}
      mensajeProfesores={consultaVigente?.mensaje ?? "No hay profesores asociados a esta materia"} onReintentarProfesores={() => setReintentoProfesores((valor) => valor + 1)}
      onSeleccionarMateria={cambiarMateriaRecurrente} onSeleccionarProfesor={cambiarProfesorRecurrente}
      duracionesPermitidas={duracionesPermitidas} granularidadMin={granularidadMin} onBusyChange={setRecurrenteOcupado} /> : <>
    <ProgresoTurno paso={paso} pasoMaximoHabilitado={pasoMaximoHabilitado} onPasoSeleccionado={seleccionarPaso} />
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 rounded-xl border border-border bg-card p-5 text-card-foreground sm:p-7">
        {resultadoFinal ? <div role="status" className="space-y-3 rounded-md bg-success p-5 text-success-foreground"><h2 className="text-xl font-semibold">Turno confirmado</h2><p className="flex items-center gap-2">Estado: <EstadoTurnoBadge estado={resultadoFinal} /></p><p>Profesor, aula y {seleccion.alumnos.length} {seleccion.alumnos.length === 1 ? "alumno" : "alumnos"} confirmados.</p></div> :
          cargando ? <p role="status">Cargando materias</p> : errorCarga ? <div role="alert" className="space-y-3"><p>{errorCarga}</p><Button type="button" variant="outline" onClick={reintentarMaterias}>Reintentar</Button></div> :
          paso === 1 ? <PasoMateriaTurno materias={materias} materiaId={seleccion.materiaId} onSeleccionar={cambiarMateria}
            profesoresPorMateria={consultaConteos?.cantidades ?? {}} cargandoConteos={!consultaConteos}
            errorConteos={consultaConteos?.estado === "error" ? consultaConteos.mensaje : ""} onReintentarConteos={() => { setConsultaConteos(null); setReintentoConteos((valor) => valor + 1); }} /> :
            paso === 2 ? <PasoProfesorTurno profesores={profesores} profesorId={seleccion.profesorId} materiaNombre={materia?.nombre ?? ""} onSeleccionar={cambiarProfesor}
              cargando={!consultaVigente || consultaVigente.estado === "cargando"} error={consultaVigente?.estado === "error" ? consultaVigente.mensaje : ""}
              mensajeVacio={consultaVigente?.mensaje ?? "No hay profesores asociados a esta materia"} onReintentar={() => setReintentoProfesores((valor) => valor + 1)} /> :
              paso === 3 ? <div className="space-y-4"><PasoFechaHorarioTurno materiaId={seleccion.materiaId} profesorId={seleccion.profesorId} profesorNombre={profesor ? `${profesor.nombre} ${profesor.apellido}` : ""}
                duracionesPermitidas={duracionesPermitidas} duracionMin={seleccion.duracionMin} fecha={seleccion.fecha} horaInicio={seleccion.horaInicio}
                onDuracionChange={(duracionMin) => { if (duracionMin !== seleccion.duracionMin) { setSeleccion((anterior) => ({ ...anterior, duracionMin })); setPasoMaximoHabilitado(3); } }}
                onFechaChange={(fecha) => { if (fecha !== seleccion.fecha) { setSeleccion((anterior) => ({ ...anterior, fecha })); setPasoMaximoHabilitado(3); } }}
                onHoraChange={(horaInicio) => { if (horaInicio !== seleccion.horaInicio) { setSeleccion((anterior) => ({ ...anterior, horaInicio })); setPasoMaximoHabilitado(3); } }}
                onVolverProfesor={retroceder} onContinuar={() => void confirmarFechaHorario()} />
                {guardando && <p role="status">Guardando turno</p>}{errorGuardado && <p role="alert" className="text-sm text-destructive">{errorGuardado}</p>}
              </div> :
                paso === 4 ? <section aria-labelledby="titulo-paso-aula" className="space-y-5">
                  <div className="space-y-1"><h2 id="titulo-paso-aula" className="text-xl font-semibold">Elegí el aula</h2><p className="text-sm text-muted-foreground">Aulas libres el {seleccion.fecha ? fechaLegible(seleccion.fecha).toLocaleLowerCase("es") : "—"}, {seleccion.horaInicio}–{seleccion.horaInicio && seleccion.duracionMin ? minutosAHora(horaAMinutos(seleccion.horaInicio) + seleccion.duracionMin) : "—"}</p></div>
                  {!turnoId ? <p role="alert">Guardá primero la fecha y el horario del turno.</p> :
                    !consultaAulas || consultaAulas.estado === "cargando" ? <p role="status">Cargando aulas disponibles</p> :
                      consultaAulas.estado === "error" ? <div role="alert" className="space-y-2"><p>{consultaAulas.mensaje}</p><Button type="button" variant="outline" onClick={() => setReintentoAulas((valor) => valor + 1)}>Reintentar</Button></div> :
                        <SeccionAulaTurno aulas={consultaAulas.opciones} aulaId={aulaIdElegida} aulaIdGuardada={aulaGuardada?.id ?? ""}
                          aulaGuardadaNoDisponible={false} habilitada={!guardando} sinAulas={consultaAulas.estado === "sinAulas"}
                          error="" onCambiar={(id) => { setAulaIdElegida(id); setPasoMaximoHabilitado(4); setErrorGuardado(""); }}
                          onReintentar={() => setReintentoAulas((valor) => valor + 1)} onVolverHorario={retroceder} modoWizard />}
                  {guardando && <p role="status">Guardando aula</p>}{errorGuardado && <p role="alert" className="text-sm text-destructive">{errorGuardado}</p>}
                </section> :
                  <div className="space-y-4">{!aulaGuardada || !cupoMaximo ? <p role="alert">Asigná un aula antes de confirmar el turno.</p> :
                    !consultaAlumnos || consultaAlumnos.estado === "cargando" ? <p role="status">Cargando alumnos elegibles</p> :
                    consultaAlumnos.estado === "error" ? <div role="alert" className="space-y-2"><p>{consultaAlumnos.mensaje}</p><Button type="button" variant="outline" onClick={() => setReintentoAlumnos((valor) => valor + 1)}>Reintentar</Button></div> :
                    <PasoAlumnosTurno opciones={consultaAlumnos.opciones} alumnos={seleccion.alumnos} cupo={cupoMaximo} bloqueado={guardando} errorAlumno={errorAlumno} estadoPredictivo={estadoPredictivo}
                      onAgregar={(alumno) => { setSeleccion((anterior) => ({ ...anterior, alumnos: [...anterior.alumnos, alumno] })); setErrorAlumno(null); setErrorGuardado(""); }}
                      onQuitar={(id) => { setSeleccion((anterior) => ({ ...anterior, alumnos: anterior.alumnos.filter((alumno) => alumno.id !== id) })); setErrorAlumno(null); setErrorGuardado(""); }} />}
                    {guardando && <p role="status">Confirmando turno</p>}{errorGuardado && <p role="alert" className="text-sm text-destructive">{errorGuardado}</p>}
                  </div>}
        {!resultadoFinal && paso !== 3 && <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <Button type="button" variant="outline" onClick={retroceder} disabled={paso === 1 || guardando}>Atrás</Button>
          <Button type="button" onClick={() => { if (!puedeContinuar) return; if (paso === 5) void confirmarParticipantes(); else if (paso === 4) void confirmarAula(); else {
            if (paso === 2) setSeleccion((actual) => ({ ...actual, duracionMin: actual.duracionMin ?? duracionesPermitidas[0] ?? null }));
            setPasoMaximoHabilitado((actual) => Math.max(actual, paso + 1) as PasoTurno);
            setPaso((paso + 1) as PasoTurno);
          } }} disabled={cargando || Boolean(errorCarga) || guardando || !puedeContinuar}>{paso === 5 ? "Crear turno" : paso === 4 ? "Continuar a alumnos" : paso === 2 ? "Continuar a fecha y horario" : "Continuar a profesor"}</Button>
        </div>}
      </div>
      <ResumenTurno valores={{ materia: materia?.nombre ?? null, profesor: profesor ? `${profesor.nombre} ${profesor.apellido}` : null, fechaHorario,
        aula: (paso === 4 ? aulaElegida?.nombre : null) ?? aulaGuardada?.nombre ?? null, alumnos: cantidadAlumnos ? seleccion.alumnos.map(({ nombre }) => nombre.replace(/^([^,]+),\s*(.+)$/, "$2 $1")).join(", ") : null, estadoInicial }} />
    </div></>}
  </main>;
}
