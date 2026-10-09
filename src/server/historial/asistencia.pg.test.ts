import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import {
  corregirAsistenciaDePrueba,
  crearAlumnoDePrueba,
  crearClaseDictadaDePrueba,
  crearInscripcionDePrueba,
  crearMateriaDePrueba,
  crearProfesorDePrueba,
  crearTurnoDePrueba,
} from "@/server/testing/fabricas";
import {
  asistenciaDeAlumno,
  contarAsistenciasPorMes,
  contarClasesDictadasSinControl,
  listarAlumnosConPresentismoBajo,
} from "@/server/historial/asistencia.publico";
import { profesorPuedeRegistrarIndicacion, profesorPuedeVerHistorial } from "@/server/historial/alcance-profesor";

// PostgreSQL real (`npm run test:pg -- <ruta>`): lecturas de asistencia del
// módulo E con el valor vigente (spec_modulo_E.md §2.13 y §3.6) y el alcance
// del profesor (PR-0.md §2.9). Las clases dictadas van a un mes de 2001 para
// no mezclarse con otras pruebas.
describe.skipIf(!basePgHabilitada)("asistencia y alcance del profesor con PostgreSQL real", () => {
  let db: PrismaClient;
  const MES = "2001-03";
  const dia = (d: number) => new Date(Date.UTC(2001, 2, d));
  let profesorId: string;
  let materia1: string;
  let materia2: string;
  let alumnoA: string;
  let alumnoB: string;
  let horas = 8;

  /** Clase (turno) del profesor en la materia y su registro de clase dictada en un día de marzo de 2001. */
  async function claseDictada(materiaId: string, d: number, alumnos: { alumnoId: string; estado: "PRESENTE" | "AUSENTE" | null }[], extra: { anulada?: boolean } = {}) {
    const turno = await crearTurnoDePrueba(db, { enDias: 30, hora: `${String(horas++).padStart(2, "0")}:00`, materiaId, profesorId });
    return crearClaseDictadaDePrueba(db, { turnoId: turno.idTurno, fecha: dia(d), alumnos, ...extra });
  }

  beforeAll(async () => {
    db = clientePg();
    profesorId = (await crearProfesorDePrueba(db)).idProfesor;
    materia1 = (await crearMateriaDePrueba(db)).idMateria;
    materia2 = (await crearMateriaDePrueba(db)).idMateria;
    alumnoA = (await crearAlumnoDePrueba(db)).idAlumno;
    alumnoB = (await crearAlumnoDePrueba(db)).idAlumno;
    await claseDictada(materia1, 1, [{ alumnoId: alumnoA, estado: "PRESENTE" }, { alumnoId: alumnoB, estado: "AUSENTE" }]);
    const corregida = await claseDictada(materia1, 2, [{ alumnoId: alumnoA, estado: "AUSENTE" }, { alumnoId: alumnoB, estado: "AUSENTE" }]);
    await corregirAsistenciaDePrueba(db, { claseDictadaId: corregida.idClaseDictada, cambios: [{ alumnoId: alumnoA, anterior: "AUSENTE", nuevo: "PRESENTE" }] });
    await claseDictada(materia1, 3, [{ alumnoId: alumnoA, estado: null }, { alumnoId: alumnoB, estado: null }], { anulada: false });
    await claseDictada(materia1, 4, [{ alumnoId: alumnoA, estado: "AUSENTE" }], { anulada: true });
    await claseDictada(materia2, 5, [{ alumnoId: alumnoA, estado: "AUSENTE" }]);
  });
  afterAll(async () => { await db?.$disconnect(); });

  it("asistenciaDeAlumno usa el estado vigente (la corrección), ignora la clase anulada y separa las sin control", async () => {
    expect(await asistenciaDeAlumno(alumnoA, undefined, db)).toEqual([
      { materia_id: materia1, presentes: 2, ausentes: 0, sin_control: 1, porcentaje: 100 },
      { materia_id: materia2, presentes: 0, ausentes: 1, sin_control: 0, porcentaje: 0 },
    ].sort((x, y) => (x.materia_id < y.materia_id ? -1 : 1)));
    expect(await asistenciaDeAlumno(alumnoB, materia1, db)).toEqual([{ materia_id: materia1, presentes: 0, ausentes: 2, sin_control: 1, porcentaje: 0 }]);
  });

  it("contarAsistenciasPorMes y contarClasesDictadasSinControl", async () => {
    const porMes = await contarAsistenciasPorMes({ desde: MES, hasta: MES }, {}, db);
    expect(porMes).toEqual([{ mes: MES, presentes: 2, ausentes: 3, sin_control: 2 }]);
    const porMateria = await contarAsistenciasPorMes({ desde: MES, hasta: MES }, { porMateria: true }, db);
    expect(porMateria.find((f) => f.materia_id === materia2)).toEqual({ mes: MES, materia_id: materia2, presentes: 0, ausentes: 1, sin_control: 0 });
    expect(await contarClasesDictadasSinControl({ desde: MES, hasta: MES }, db)).toBe(1);
  });

  it("listarAlumnosConPresentismoBajo: grupos bajo el umbral, ordenados y paginados", async () => {
    const r = await listarAlumnosConPresentismoBajo({ desde: MES, hasta: MES }, { umbral: 75, minimoClases: 1, limite: 10, desplazamiento: 0 }, db);
    expect(r.items).toEqual([
      { alumno_id: alumnoB, materia_id: materia1, clases: 2, presentes: 0, ausentes: 2 },
      { alumno_id: alumnoA, materia_id: materia2, clases: 1, presentes: 0, ausentes: 1 },
    ]);
    expect(r.total).toBe(2);
    expect(await listarAlumnosConPresentismoBajo({ desde: MES, hasta: MES }, { umbral: 75, minimoClases: 2, limite: 10, desplazamiento: 0 }, db)).toMatchObject({ total: 1 });
    expect(await listarAlumnosConPresentismoBajo({ desde: MES, hasta: MES }, { umbral: 75, minimoClases: 1, limite: 1, desplazamiento: 5 }, db)).toEqual({ total: 2, items: [] });
    await expect(listarAlumnosConPresentismoBajo({ desde: MES, hasta: MES }, { umbral: 101, minimoClases: 1, limite: 1, desplazamiento: 0 }, db)).rejects.toThrow(/umbral/);
  });

  it("alcance del profesor: indicación con una clase dictada no anulada (también ausente); historial también por inscripción vigente", async () => {
    expect(await profesorPuedeRegistrarIndicacion(profesorId, alumnoB, materia1, db)).toBe(true);
    expect(await profesorPuedeRegistrarIndicacion(profesorId, alumnoA, materia2, db)).toBe(true);
    const nuevo = await crearAlumnoDePrueba(db);
    // Solo figura en una clase dictada anulada: no alcanza.
    await claseDictada(materia2, 6, [{ alumnoId: nuevo.idAlumno, estado: "PRESENTE" }], { anulada: true });
    expect(await profesorPuedeRegistrarIndicacion(profesorId, nuevo.idAlumno, materia2, db)).toBe(false);
    expect(await profesorPuedeVerHistorial(profesorId, nuevo.idAlumno, materia2, db)).toBe(false);
    // Inscripto en una clase futura del profesor y la materia: ve el historial, pero todavía no registra indicaciones.
    const futura = await crearTurnoDePrueba(db, { enDias: 40, hora: "09:00", materiaId: materia2, profesorId });
    await crearInscripcionDePrueba(db, { turnoId: futura.idTurno, alumnoId: nuevo.idAlumno });
    expect(await profesorPuedeVerHistorial(profesorId, nuevo.idAlumno, materia2, db)).toBe(true);
    expect(await profesorPuedeRegistrarIndicacion(profesorId, nuevo.idAlumno, materia2, db)).toBe(false);
    expect(await profesorPuedeVerHistorial(profesorId, nuevo.idAlumno, materia1, db)).toBe(false);
  });
});
