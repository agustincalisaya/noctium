"use client";

import { useCallback, useEffect, useState } from "react";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { Button } from "@/components/ui/button";
import { useDirtyState } from "@/components/sesion/dirty-state-context";
import { fetchAutenticado } from "@/lib/fetch-autenticado";
import { PasoMateriaTurno, type MateriaOpcionTurno } from "../paso-materia-turno";
import { PasoProfesorTurno, type ProfesorOpcionTurno } from "../paso-profesor-turno";
import { ProgresoTurno, type PasoTurno } from "./progreso-turno";
import { ResumenTurno } from "./resumen-turno";

type SeleccionTurno = {
  materiaId: string;
  profesorId: string;
  duracionMin: number | null;
  fecha: string;
  horaInicio: string;
  aulaId: string;
  alumnoIds: string[];
};

const seleccionInicial: SeleccionTurno = { materiaId: "", profesorId: "", duracionMin: null, fecha: "", horaInicio: "", aulaId: "", alumnoIds: [] };

/** Las opciones de Profesor llegarán por C-07; el alta real no las simula. */
export function TurnoWizard({ profesores }: { profesores?: ProfesorOpcionTurno[] }) {
  const { setDirty } = useDirtyState();
  const [paso, setPaso] = useState<PasoTurno>(1);
  const [seleccion, setSeleccion] = useState<SeleccionTurno>(seleccionInicial);
  const [materias, setMaterias] = useState<MateriaOpcionTurno[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  const cargarMaterias = useCallback(async () => {
    setCargando(true); setErrorCarga("");
    try {
      const respuesta = await fetchAutenticado("/api/turnos/configuracion", { cache: "no-store" });
      const valor = await respuesta.json().catch(() => null);
      if (!respuesta.ok || !Array.isArray(valor?.data?.materias)) throw new Error(valor?.error?.message ?? "No se pudieron cargar las materias");
      setMaterias(valor.data.materias);
    } catch (error) { setErrorCarga(error instanceof Error ? error.message : "No se pudieron cargar las materias"); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { void cargarMaterias(); }, [cargarMaterias]);
  useEffect(() => { setDirty(Boolean(seleccion.materiaId || seleccion.profesorId || seleccion.fecha || seleccion.aulaId || seleccion.alumnoIds.length)); }, [seleccion, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  const materia = materias.find(({ id }) => id === seleccion.materiaId);
  const profesor = profesores?.find(({ id }) => id === seleccion.profesorId);
  const fechaHorario = seleccion.fecha && seleccion.horaInicio && seleccion.duracionMin
    ? `${seleccion.fecha} · ${seleccion.horaInicio} · ${seleccion.duracionMin / 60} h` : null;
  const puedeContinuar = paso === 1 ? Boolean(materia) : paso === 2 ? Boolean(profesor) :
    paso === 3 ? Boolean(seleccion.duracionMin && seleccion.fecha && seleccion.horaInicio) :
      paso === 4 ? Boolean(seleccion.aulaId) : seleccion.alumnoIds.length > 0;

  const avanzar = () => { if (puedeContinuar && paso < 5) setPaso((paso + 1) as PasoTurno); };
  const retroceder = () => { if (paso > 1) setPaso((paso - 1) as PasoTurno); };

  return <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
    <header className="space-y-3">
      <Breadcrumb tramos={[{ etiqueta: "Turnos", href: "/turnos" }, { etiqueta: "Nuevo turno" }]} />
      <div className="space-y-1"><h1 className="text-3xl font-semibold tracking-tight">Nuevo turno</h1><p className="text-sm text-muted-foreground">Materia · Profesor · Fecha y horario · Aula · Alumnos.</p></div>
      <div role="group" aria-label="Tipo de creación de turnos" className="inline-flex max-w-full gap-1 rounded-lg border border-border bg-muted p-1">
        <button type="button" aria-pressed="true" className="rounded-md bg-card px-4 py-2 text-sm font-medium shadow-xs">Turno individual</button>
        <button type="button" disabled aria-label="Generar varios turnos (próximamente)" className="rounded-md px-4 py-2 text-sm text-muted-foreground disabled:cursor-not-allowed">Generar varios turnos</button>
      </div>
    </header>

    <ProgresoTurno paso={paso} />
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 rounded-xl border border-border bg-card p-5 text-card-foreground sm:p-7">
        {cargando ? <p role="status">Cargando materias</p> : errorCarga ? <div role="alert" className="space-y-3"><p>{errorCarga}</p><Button type="button" variant="outline" onClick={() => void cargarMaterias()}>Reintentar</Button></div> :
          paso === 1 ? <PasoMateriaTurno materias={materias} materiaId={seleccion.materiaId} onSeleccionar={(materiaId) => setSeleccion((anterior) => ({ ...anterior, materiaId }))} /> :
            paso === 2 ? <PasoProfesorTurno profesores={profesores ?? []} profesorId={seleccion.profesorId} onSeleccionar={(profesorId) => setSeleccion((anterior) => ({ ...anterior, profesorId }))} consultaDisponible={profesores !== undefined} /> :
              <section aria-labelledby="titulo-paso-pendiente" className="space-y-2"><p className="text-sm font-medium text-muted-foreground">Paso {paso} de 5</p><h2 id="titulo-paso-pendiente" className="text-xl font-semibold">{paso === 3 ? "Elegí fecha y horario" : paso === 4 ? "Elegí un aula" : "Agregá alumnos"}</h2><p role="status" className="text-sm text-muted-foreground">Este paso todavía no está disponible.</p></section>}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <Button type="button" variant="outline" onClick={retroceder} disabled={paso === 1}>Atrás</Button>
          <Button type="button" onClick={avanzar} disabled={cargando || Boolean(errorCarga) || !puedeContinuar || paso === 5}>{paso === 3 ? "Continuar a aula" : paso === 5 ? "Confirmar turno" : "Continuar"}</Button>
        </div>
      </div>
      <ResumenTurno valores={{ materia: materia?.nombre ?? null, profesor: profesor ? `${profesor.apellido}, ${profesor.nombre}` : null, fechaHorario, aula: null, alumnos: seleccion.alumnoIds.length ? `${seleccion.alumnoIds.length} alumnos` : null }} />
    </div>
  </main>;
}
