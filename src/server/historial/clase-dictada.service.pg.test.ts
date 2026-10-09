import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba, crearInscripcionDePrueba, corregirAsistenciaDePrueba } from "@/server/testing/fabricas";
import { registrarClaseDictada, obtenerRegistroClaseDictada, registrarClaseDictadaDesdeSolicitud } from "@/server/historial/clase-dictada.service";
import { obtenerHistorialAlumno } from "@/server/historial/historial.service";
import { asistenciaDeAlumno } from "@/server/historial/historial.publico";
import { transaccion } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import { ahora, conReloj } from "@/server/shared/reloj";
import { inicioDeTurno, finDeTurno } from "@/server/shared/fechas-centro";

describe.skipIf(!basePgHabilitada)("HU-E-09 registro con PostgreSQL real", () => {
  let db: PrismaClient; let usuarioId: string;
  beforeAll(async () => { db = clientePg(); usuarioId = (await crearUsuarioDePrueba(db)).idUsuario; });
  afterAll(async () => { await db?.$disconnect(); });
  async function escenario() {
    const turno = await crearTurnoDePrueba(db, { enDias: -2 });
    const alumnos = await Promise.all([crearAlumnoDePrueba(db), crearAlumnoDePrueba(db)]);
    const antes = new Date(inicioDeTurno(turno).getTime() - 60_000);
    const inscripciones = [];
    for (const alumno of alumnos) inscripciones.push(await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno, creadoPorUsuarioId: usuarioId, reservadaEl: antes }));
    const asistencias = inscripciones.map((i, n) => ({ inscripcionId: i.idInscripcion, estado: n === 0 ? "PRESENTE" as const : "AUSENTE" as const }));
    return { turno, alumnos, inscripciones, asistencias };
  }
  const guardar = (turnoId: string, asistencias?: { inscripcionId: string; estado: "PRESENTE" | "AUSENTE" }[]) => transaccion((tx) => registrarClaseDictada(tx, { turnoId, actor: actorUsuario(usuarioId), asistencias }), { db });

  it("guarda snapshot, asistencia y auditoría juntos sin alterar inscripción ni pagos", async () => {
    const e = await escenario();
    const antes = await db.turnoAlumno.findMany({ where: { turnoId: e.turno.idTurno }, orderBy: { idInscripcion: "asc" } });
    const pagosAntes = await db.operacionPago.count();
    const r = await guardar(e.turno.idTurno, e.asistencias);
    expect(r).toMatchObject({ alumnos_registrados: 2, con_control_asistencia: true, presentes: 1, ausentes: 1, ya_existia: false });
    const clase = await db.claseDictada.findUniqueOrThrow({ where: { idClaseDictada: r.id }, include: { alumnos: true } });
    expect(clase.creadoPorUsuarioId).toBe(usuarioId); expect(clase.fechaClaseDictada).toEqual(e.turno.fechaTurno);
    expect(clase.alumnos.map((a) => a.estadoAsistencia).sort()).toEqual(["AUSENTE", "PRESENTE"]);
    expect(await db.turnoAlumno.findMany({ where: { turnoId: e.turno.idTurno }, orderBy: { idInscripcion: "asc" } })).toEqual(antes);
    expect(await db.operacionPago.count()).toBe(pagosAntes);
  });
  it("sin cuerpo conserva null y queda fuera del porcentaje", async () => {
    const e = await escenario(); const r = await guardar(e.turno.idTurno);
    expect(r).toMatchObject({ presentes: null, ausentes: null, con_control_asistencia: false });
    expect(await asistenciaDeAlumno(e.alumnos[0].idAlumno, undefined, db)).toEqual([{ materia_id: e.turno.materiaId, presentes: 0, ausentes: 0, sin_control: 1, porcentaje: null }]);
  });
  it("validación incompleta revierte todo y no genera clase parcial", async () => {
    const e = await escenario();
    await expect(guardar(e.turno.idTurno, e.asistencias.slice(0, 1))).rejects.toMatchObject({ code: "ASISTENCIA_INCOMPLETA" });
    expect(await db.claseDictada.count({ where: { turnoId: e.turno.idTurno } })).toBe(0);
    expect(await db.claseDictadaAlumno.count({ where: { alumnoId: { in: e.alumnos.map((a) => a.idAlumno) } } })).toBe(0);
  });
  it("excluye reserva vencida, marca vencimiento y traza después del commit", async () => {
    const e = await escenario(); const alumno = await crearAlumnoDePrueba(db);
    const reserva = await crearInscripcionDePrueba(db, { turnoId: e.turno.idTurno, alumnoId: alumno.idAlumno, estadoPago: "RESERVADA", reservadaEl: new Date(inicioDeTurno(e.turno).getTime() - 60_000) });
    const r = await guardar(e.turno.idTurno, e.asistencias);
    expect(r.alumnos_registrados).toBe(2);
    expect((await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: reserva.idInscripcion } })).vigencia).toBe("RESERVA_VENCIDA");
    expect(await db.historialInscripcion.count({ where: { inscripcionId: reserva.idInscripcion } })).toBe(1);
  });
  it("rollback de validación también revierte vencimiento y descarta evento", async () => {
    const e = await escenario(); const alumno = await crearAlumnoDePrueba(db);
    const reserva = await crearInscripcionDePrueba(db, { turnoId: e.turno.idTurno, alumnoId: alumno.idAlumno, estadoPago: "RESERVADA", reservadaEl: new Date(inicioDeTurno(e.turno).getTime() - 60_000) });
    await expect(guardar(e.turno.idTurno, [])).rejects.toMatchObject({ code: "ASISTENCIA_INCOMPLETA" });
    expect((await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: reserva.idInscripcion } })).vigencia).toBe("VIGENTE");
    expect(await db.historialInscripcion.count({ where: { inscripcionId: reserva.idInscripcion } })).toBe(0);
  });
  it("dos registros simultáneos tienen un ganador sin cambiar estados", async () => {
    const e = await escenario();
    const resultados = await Promise.all([guardar(e.turno.idTurno, e.asistencias), guardar(e.turno.idTurno, e.asistencias)]);
    expect(resultados.map((r) => r.ya_existia).sort()).toEqual([false, true]);
    expect(resultados[0].id).toBe(resultados[1].id); expect(await db.claseDictada.count({ where: { turnoId: e.turno.idTurno } })).toBe(1);
    await expect(guardar(e.turno.idTurno, [])).resolves.toMatchObject({ ya_existia: true, presentes: 1, ausentes: 1 });
  });
  it("registro nuevo tras anulación usa índice parcial y conserva original", async () => {
    const e = await escenario(); const original = await guardar(e.turno.idTurno, e.asistencias);
    // Solo setup de prueba de T3: no se agrega operación de anulación de E-11.
    await db.claseDictada.update({ where: { idClaseDictada: original.id }, data: { anuladaEl: ahora(), anuladaPorUsuarioId: usuarioId, motivoAnulacion: "Prueba índice parcial" } });
    const siguiente = await guardar(e.turno.idTurno, e.asistencias);
    expect(siguiente.id).not.toBe(original.id); expect(siguiente.ya_existia).toBe(false);
    expect(await db.claseDictada.count({ where: { turnoId: e.turno.idTurno } })).toBe(2);
    expect(await db.claseDictadaAlumno.count({ where: { claseDictadaId: original.id } })).toBe(2);
  });
  it("GET, historial y lectura pública coinciden con corrección vigente", async () => {
    const e = await escenario(); const r = await guardar(e.turno.idTurno, e.asistencias);
    await corregirAsistenciaDePrueba(db, { claseDictadaId: r.id, cambios: [{ alumnoId: e.alumnos[0].idAlumno, anterior: "PRESENTE", nuevo: "AUSENTE" }] });
    const usuario = { id: usuarioId, rol: "MESA_ENTRADA" as const };
    const get = await obtenerRegistroClaseDictada(e.turno.idTurno, usuario);
    expect(get.totales).toEqual({ presentes: 0, ausentes: 2 });
    const historial = await obtenerHistorialAlumno(e.alumnos[0].idAlumno, { pagina: 1, por_pagina: 10 }, usuario);
    expect(historial.items[0]).toMatchObject({ asistencia: "AUSENTE" });
    expect(historial.asistencia_por_materia).toEqual(await asistenciaDeAlumno(e.alumnos[0].idAlumno, undefined, db));
    expect(historial.asistencia_por_materia[0].porcentaje).toBe(0);
  });
  it("fin exacto se permite, un milisegundo antes no", async () => {
    const e = await escenario(); const fin = finDeTurno(e.turno);
    await expect(conReloj(new Date(fin.getTime() - 1), () => guardar(e.turno.idTurno, e.asistencias))).rejects.toMatchObject({ code: "CLASE_NO_FINALIZADA" });
    await expect(conReloj(fin, () => guardar(e.turno.idTurno, e.asistencias))).resolves.toMatchObject({ ya_existia: false });
  });
  it("entrada HTTP resuelve conjunto en términos de alumno y persiste igual al core", async () => {
    const e = await escenario();
    const r = await registrarClaseDictadaDesdeSolicitud(e.turno.idTurno, { id: usuarioId, rol: "MESA_ENTRADA" }, e.alumnos.map((a) => ({ alumno_id: a.idAlumno, estado: "AUSENTE" })));
    expect(r).toMatchObject({ presentes: 0, ausentes: 2 });
  });
});
