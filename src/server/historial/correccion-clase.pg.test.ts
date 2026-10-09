import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba, crearInscripcionDePrueba } from "@/server/testing/fabricas";
import { registrarClaseDictada, obtenerRegistroClaseDictada, corregirAsistenciaClaseDictada, anularClaseDictada } from "./clase-dictada.service";
import { registrarObservacionClase } from "./observacion-clase.service";
import { registrarIndicacion } from "./indicacion.service";
import { registrarResultadoExamen } from "./resultado-examen.service";
import { obtenerHistorialAlumno } from "./historial.service";
import { asistenciaDeAlumno, contarAsistenciasPorMes, profesorPuedeRegistrarIndicacion } from "./historial.publico";
import { transaccion } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import { inicioDeTurno } from "@/server/shared/fechas-centro";
import { conReloj } from "@/server/shared/reloj";
describe.skipIf(!basePgHabilitada)("E11 operaciones reales e integraciones", () => {
 let db: PrismaClient; let actor: { id: string; rol: "MESA_ENTRADA" };
 beforeAll(async () => { db = clientePg(); actor = { id: (await crearUsuarioDePrueba(db, { rol: "MESA_ENTRADA" })).idUsuario, rol: "MESA_ENTRADA" }; });
 afterAll(async () => { await db?.$disconnect(); });
 async function escenario(control = true) {
  const turno = await crearTurnoDePrueba(db, { enDias: -2 });
  const alumno = await crearAlumnoDePrueba(db);
  const inscripcion = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, creadoPorUsuarioId: actor.id, reservadaEl: new Date(inicioDeTurno(turno).getTime() - 60000) });
  const guardar = () => transaccion(tx => registrarClaseDictada(tx, { turnoId: turno.idTurno, actor: actorUsuario(actor.id), asistencias: control ? [{ inscripcionId: inscripcion.idInscripcion, estado: "PRESENTE" }] : undefined }));
  const clase = await guardar();
  const corregir = (estado: "PRESENTE" | "AUSENTE") => corregirAsistenciaClaseDictada(turno.idTurno, actor, { motivo: "Error real", asistencias: [{ alumno_id: alumno.idAlumno, estado }] });
  return { turno, alumno, clase, guardar, corregir };
 }
 it("correcciones sucesivas guardan anteriores vigentes y no modifican snapshot", async () => {
  const e = await escenario(); const snapshot = await db.claseDictadaAlumno.findMany({ where: { claseDictadaId: e.clase.id } });
  await e.corregir("AUSENTE");
  expect((await asistenciaDeAlumno(e.alumno.idAlumno))[0]).toMatchObject({ presentes: 0, ausentes: 1, porcentaje: 0 });
  await e.corregir("PRESENTE");
  expect(await db.claseDictadaAlumno.findMany({ where: { claseDictadaId: e.clase.id } })).toEqual(snapshot);
  expect((await db.correccionAsistenciaAlumno.findMany({ where: { alumnoId: e.alumno.idAlumno }, orderBy: { correccion: { createdAtCorreccion: "asc" } } })).map(c => [c.estadoAnterior, c.estadoNuevo])).toEqual([["PRESENTE", "AUSENTE"], ["AUSENTE", "PRESENTE"]]);
  expect((await obtenerRegistroClaseDictada(e.turno.idTurno, actor)).totales).toEqual({ presentes: 1, ausentes: 0 });
 });
 it("primera carga legacy y rollback con conjunto inválido", async () => {
  const e = await escenario(false);
  await expect(corregirAsistenciaClaseDictada(e.turno.idTurno, actor, { motivo: "Inválido", asistencias: [] })).rejects.toMatchObject({ code: "ASISTENCIA_INCOMPLETA" });
  expect(await db.correccionAsistencia.count({ where: { claseDictadaId: e.clase.id } })).toBe(0);
  await e.corregir("PRESENTE");
  expect((await db.correccionAsistenciaAlumno.findFirstOrThrow({ where: { alumnoId: e.alumno.idAlumno } })).estadoAnterior).toBeNull();
  expect((await obtenerRegistroClaseDictada(e.turno.idTurno, actor)).con_control_asistencia).toBe(true);
 });
 it("dos correcciones iguales simultáneas generan una sola compensación", async () => {
  const e = await escenario(); const r = await Promise.allSettled([e.corregir("AUSENTE"), e.corregir("AUSENTE")]);
  expect(r.filter(v => v.status === "fulfilled")).toHaveLength(1);
  expect(await db.correccionAsistencia.count({ where: { claseDictadaId: e.clase.id } })).toBe(1);
 });
 it("anular conserva hechos/finanzas, oculta observación, desvincula indicación y excluye H07", async () => {
  const e = await escenario();
  await transaccion(tx => registrarObservacionClase(tx, e.turno.idTurno, { temas_vistos: "Funciones", observaciones_internas: "Privado" }, actor));
  await transaccion(tx => registrarIndicacion(tx, e.alumno.idAlumno, { materia_id: e.turno.materiaId, indicacion: "Repasar", clase_dictada_id: e.clase.id }, actor));
  const examen = await registrarResultadoExamen(e.alumno.idAlumno, { materia_id: e.turno.materiaId, fecha_examen: e.turno.fechaTurno, nota: "8" }, actor);
  const inscripciones = await db.turnoAlumno.findMany({ where: { turnoId: e.turno.idTurno } });
  const pagos = await db.pago.count(); const momento = new Date();
  await anularClaseDictada(e.turno.idTurno, actor, "No se dio");
  await expect(obtenerRegistroClaseDictada(e.turno.idTurno, actor)).rejects.toMatchObject({ code: "CLASE_NO_REGISTRADA" });
  expect(await asistenciaDeAlumno(e.alumno.idAlumno)).toEqual([]);
  const mes = e.turno.fechaTurno.toISOString().slice(0,7);
  const conteo = await contarAsistenciasPorMes({ desde: mes, hasta: mes }, { porMateria: true });
  expect(conteo.find(c => c.materia_id === e.turno.materiaId)).toBeUndefined();
  const historial = await obtenerHistorialAlumno(e.alumno.idAlumno, { pagina: 1, por_pagina: 10 }, actor);
  expect(historial.items.map(i => i.tipo).sort()).toEqual(["EXAMEN", "INDICACION"]);
  expect(historial.items.find(i => i.tipo === "INDICACION")).toMatchObject({ clase_dictada_id: null });
  expect(await db.resultadoExamen.findUnique({ where: { idResultadoExamen: examen.id } })).not.toBeNull();
  expect(await db.observacionClase.count({ where: { claseDictadaId: e.clase.id } })).toBe(1);
  expect(await db.turnoAlumno.findMany({ where: { turnoId: e.turno.idTurno } })).toEqual(inscripciones); expect(await db.pago.count()).toBe(pagos);
  expect(await profesorPuedeRegistrarIndicacion(e.turno.profesorId!, e.alumno.idAlumno, e.turno.materiaId)).toBe(false);
  const anulada = await db.claseDictada.findUniqueOrThrow({ where: { idClaseDictada: e.clase.id } });
  expect(anulada.motivoAnulacion).toBe("No se dio"); expect(anulada.anuladaPorUsuarioId).toBe(actor.id); expect(anulada.anuladaEl!.getTime()).toBeGreaterThanOrEqual(momento.getTime());
  const nueva = await e.guardar(); expect(nueva.id).not.toBe(e.clase.id);
 });
 it("anulación simultánea y profesor fuera de plazo no duplican ni mutan", async () => {
  const e = await escenario(); const r = await Promise.allSettled([anularClaseDictada(e.turno.idTurno, actor, "A"), anularClaseDictada(e.turno.idTurno, actor, "B")]);
  expect(r.filter(v => v.status === "fulfilled")).toHaveLength(1);
  const otra = await escenario(); const profesorUsuario = await crearUsuarioDePrueba(db, { rol: "PROFESOR" });
  await db.profesor.update({ where: { idProfesor: otra.turno.profesorId! }, data: { usuarioId: profesorUsuario.idUsuario } });
  await conReloj(new Date(`${otra.turno.fechaTurno.toISOString().slice(0,10)}T12:00:00-03:00`), () => expect(corregirAsistenciaClaseDictada(otra.turno.idTurno, { id: profesorUsuario.idUsuario, rol: "PROFESOR" }, { motivo: "Ok", asistencias: [{ alumno_id: otra.alumno.idAlumno, estado: "AUSENTE" }] })).resolves.toMatchObject({ con_control_asistencia: true }));
  await conReloj(new Date(otra.turno.fechaTurno.getTime() + 9 * 86400000), () => expect(anularClaseDictada(otra.turno.idTurno, { id: profesorUsuario.idUsuario, rol: "PROFESOR" }, "Tarde")).rejects.toMatchObject({ code: "PLAZO_CORRECCION_VENCIDO" }));
 });
});
