import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearInscripcionDePrueba, crearMateriaDePrueba, crearProfesorDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba } from "@/server/testing/fabricas";
import { ahora, conReloj } from "@/server/shared/reloj";
import { transaccion, type Tx } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import {
  contarInscripcionesPorMes,
  crearInscripcion,
  existeInscripcionVigenteConProfesor,
  finalizarInscripcion,
  listarInscripcionesDeAlumno,
  listarReservasPendientes,
  listarReservasVencidas,
  resumenReservas,
} from "@/server/turnos/inscripcion.publico";
import { contarClasesPorMes, gerentePuedeGestionarClaseDeBaja } from "@/server/turnos/turno.publico";

// PostgreSQL real (`npm run test:pg -- <ruta>`): lecturas públicas de C
// (PR-0.md §2.13). Las clases de los conteos por mes van a un mes lejano para
// no mezclarse con las de otras pruebas de la misma base.
describe.skipIf(!basePgHabilitada)("lecturas públicas de la inscripción con PostgreSQL real", () => {
  let db: PrismaClient;
  let usuarioId: string;
  const HORA = 60 * 60 * 1000;
  const enTx = <T>(fn: (tx: Tx) => Promise<T>, momento?: Date) =>
    momento ? conReloj(momento, () => transaccion(fn, { db })) : transaccion(fn, { db });
  const inscribir = (turnoId: string, alumnoId: string, reserva = false) =>
    enTx((tx) => crearInscripcion(tx, { turnoId, alumnoId, origen: reserva ? "ALUMNO" : "CENTRO", conReserva: reserva, actor: actorUsuario(usuarioId) }));
  const finalizar = (inscripcionId: string, vigencia: "CANCELADA_ALUMNO" | "BAJA_ALUMNO" | "QUITADA_CENTRO") =>
    enTx((tx) => finalizarInscripcion(tx, { inscripcionId, vigencia, actor: actorUsuario(usuarioId) }));

  beforeAll(async () => {
    db = clientePg();
    usuarioId = (await crearUsuarioDePrueba(db)).idUsuario;
  });
  afterAll(async () => { await db?.$disconnect(); });

  it("listarInscripcionesDeAlumno: todas las vigencias, vigente_ahora con la regla única y cancelada_el del evento de la clase", async () => {
    const alumno = await crearAlumnoDePrueba(db);
    const conReserva = await crearTurnoDePrueba(db, { enDias: 10, hora: "09:00" });
    const quitada = await crearTurnoDePrueba(db, { enDias: 11, hora: "09:00" });
    const cancelada = await crearTurnoDePrueba(db, { enDias: 12, hora: "09:00" });
    const reserva = await inscribir(conReserva.idTurno, alumno.idAlumno, true);
    await finalizar((await inscribir(quitada.idTurno, alumno.idAlumno)).inscripcion.id, "QUITADA_CENTRO");
    await inscribir(cancelada.idTurno, alumno.idAlumno);
    const canceladaEl = new Date();
    await db.turno.update({ where: { idTurno: cancelada.idTurno }, data: { estadoTurno: "CANCELADO" } });
    await db.eventoTurno.create({ data: { tipoEvento: "turno:cancelado", turnoId: cancelada.idTurno, usuarioId, payloadEvento: {}, creadoEnEvento: canceladaEl } });

    const lista = await listarInscripcionesDeAlumno(alumno.idAlumno, {}, db);
    expect(lista.map((i) => [i.turno_id, i.vigencia, i.vigente_ahora])).toEqual([
      [cancelada.idTurno, "VIGENTE", true], [quitada.idTurno, "QUITADA_CENTRO", false], [conReserva.idTurno, "VIGENTE", true],
    ]);
    expect(lista[0]).toMatchObject({ estado_clase: "CANCELADO", cancelada_el: canceladaEl, hora_inicio: "09:00", hora_fin: "10:00", aula: expect.any(String), profesor: expect.stringContaining(",") });
    const despues = new Date(reserva.inscripcion.venceEl!.getTime() + 1000);
    const vencida = (await conReloj(despues, () => listarInscripcionesDeAlumno(alumno.idAlumno, {}, db))).find((i) => i.turno_id === conReserva.idTurno)!;
    expect(vencida).toMatchObject({ vigencia: "VIGENTE", vigente_ahora: false });
    const filtrada = await listarInscripcionesDeAlumno(alumno.idAlumno, { desde: conReserva.fechaTurno.toISOString().slice(0, 10), hasta: conReserva.fechaTurno.toISOString().slice(0, 10) }, db);
    expect(filtrada.map((i) => i.turno_id)).toEqual([conReserva.idTurno]);
  });

  it("contarInscripcionesPorMes y contarClasesPorMes: clasificación en ahora() y sin PENDIENTE ni QUITADA_CENTRO", async () => {
    const materia = await crearMateriaDePrueba(db);
    const profesor = await crearProfesorDePrueba(db);
    const clase = (hora: string, estado?: "PENDIENTE") => crearTurnoDePrueba(db, { enDias: 420, hora, materiaId: materia.idMateria, profesorId: profesor.idProfesor, cupo: 10, estado });
    const a = await clase("08:00");
    const b = await clase("10:00");
    const pendiente = await clase("12:00", "PENDIENTE");
    const mes = a.fechaTurno.toISOString().slice(0, 7);
    const alumnos = await Promise.all([0, 1, 2, 3, 4].map(() => crearAlumnoDePrueba(db)));
    const reserva = await inscribir(a.idTurno, alumnos[0]!.idAlumno, true);
    await inscribir(a.idTurno, alumnos[1]!.idAlumno);
    await finalizar((await inscribir(a.idTurno, alumnos[2]!.idAlumno)).inscripcion.id, "CANCELADA_ALUMNO");
    await finalizar((await inscribir(b.idTurno, alumnos[3]!.idAlumno)).inscripcion.id, "BAJA_ALUMNO");
    await finalizar((await inscribir(b.idTurno, alumnos[4]!.idAlumno)).inscripcion.id, "QUITADA_CENTRO");
    await db.turno.update({ where: { idTurno: b.idTurno }, data: { estadoTurno: "CANCELADO" } });

    const despues = new Date(reserva.inscripcion.venceEl!.getTime() + 1000);
    const conteo = await conReloj(despues, () => contarInscripcionesPorMes({ desde: mes, hasta: mes },
      { vigencias: ["VIGENTE", "RESERVA_VENCIDA", "CANCELADA_ALUMNO", "BAJA_ALUMNO"], porMateria: true }, db));
    // La clase B quedó cancelada: sus inscripciones no se cuentan.
    expect(conteo.filter((c) => c.materia_id === materia.idMateria)).toEqual([
      { mes, vigencia: "CANCELADA_ALUMNO", materia_id: materia.idMateria, cantidad: 1 },
      { mes, vigencia: "RESERVA_VENCIDA", materia_id: materia.idMateria, cantidad: 1 },
      { mes, vigencia: "VIGENTE", materia_id: materia.idMateria, cantidad: 1 },
    ]);
    const clases = await contarClasesPorMes({ desde: mes, hasta: mes }, { estados: ["DISPONIBLE", "COMPLETO", "CANCELADO"], por: "profesor" }, db);
    expect(clases.filter((c) => c.profesor_id === profesor.idProfesor)).toEqual([
      { mes, estado: "CANCELADO", profesor_id: profesor.idProfesor, cantidad: 1, minutos: 60 },
      { mes, estado: "DISPONIBLE", profesor_id: profesor.idProfesor, cantidad: 1, minutos: 60 },
    ]);
    expect(pendiente.estadoTurno).toBe("PENDIENTE");
    await expect(contarClasesPorMes({ desde: mes, hasta: mes }, { estados: ["PENDIENTE" as "CANCELADO"] }, db)).rejects.toThrow(/PENDIENTE/);
  });

  it("reservas: pendientes ordenadas por vencimiento con filtros, vencidas (marcadas y sin marcar) y resumen", async () => {
    const momento = ahora();
    const antes = await resumenReservas(db);
    const alumno = await crearAlumnoDePrueba(db);
    const cerca = await crearTurnoDePrueba(db, { enDias: 1, hora: "08:00" });
    const lejos = await crearTurnoDePrueba(db, { enDias: 9, hora: "08:00" });
    const r1 = await crearInscripcionDePrueba(db, { turnoId: cerca.idTurno, alumnoId: alumno.idAlumno, estadoPago: "RESERVADA", reservadaEl: momento, plazoHoras: 2, precio: 24000 });
    const r2 = await crearInscripcionDePrueba(db, { turnoId: lejos.idTurno, alumnoId: alumno.idAlumno, estadoPago: "RESERVADA", reservadaEl: momento, plazoHoras: 30 });
    const vieja = await crearTurnoDePrueba(db, { enDias: 2, hora: "13:00" });
    const sinMarcar = await crearInscripcionDePrueba(db, { turnoId: vieja.idTurno, alumnoId: alumno.idAlumno, estadoPago: "RESERVADA", reservadaEl: new Date(momento.getTime() - 25 * HORA) });

    const despues = await resumenReservas(db);
    expect(despues.pendientes.cantidad - antes.pendientes.cantidad).toBe(2);
    expect(despues.pendientes.importe_total - antes.pendientes.importe_total).toBe(24000 + 12000);
    expect(despues.vencen_en_3_horas - antes.vencen_en_3_horas).toBe(1);

    const pendientes = await listarReservasPendientes({ alumno: alumno.dniAlumno }, db);
    expect(pendientes.items.map((i) => i.inscripcion_id)).toEqual([r1.idInscripcion, r2.idInscripcion]);
    expect(pendientes.items[0]).toMatchObject({ vence_pronto: true, precio: 24000, alumno: { dni: alumno.dniAlumno, reservas_pendientes: 2 }, vence_el: expect.stringMatching(/-03:00$/) });
    expect(pendientes.paginacion).toEqual({ total: 2, pagina_actual: 1, total_paginas: 1, por_pagina: 10 });
    expect((await listarReservasPendientes({ alumno: alumno.dniAlumno, vencen: "en_3_horas" }, db)).items.map((i) => i.inscripcion_id)).toEqual([r1.idInscripcion]);

    const vencidas = await listarReservasVencidas({ alumno: alumno.dniAlumno }, db);
    expect(vencidas.items).toEqual([expect.objectContaining({ inscripcion_id: sinMarcar.idInscripcion, sin_marcar: true })]);
    await enTx(async (tx) => {
      const { marcarVencidas } = await import("@/server/turnos/inscripcion.publico");
      await marcarVencidas(tx, vieja.idTurno);
    });
    expect((await listarReservasVencidas({ alumno: alumno.dniAlumno }, db)).items).toEqual([expect.objectContaining({ inscripcion_id: sinMarcar.idInscripcion, sin_marcar: false })]);
  });

  it("existeInscripcionVigenteConProfesor y gerentePuedeGestionarClaseDeBaja", async () => {
    const turno = await crearTurnoDePrueba(db, { enDias: 13, hora: "16:00" });
    const alumno = await crearAlumnoDePrueba(db);
    expect(await existeInscripcionVigenteConProfesor(alumno.idAlumno, turno.profesorId!, turno.materiaId, db)).toBe(false);
    const insc = await inscribir(turno.idTurno, alumno.idAlumno);
    expect(await existeInscripcionVigenteConProfesor(alumno.idAlumno, turno.profesorId!, turno.materiaId, db)).toBe(true);
    expect(await existeInscripcionVigenteConProfesor(alumno.idAlumno, turno.profesorId!, "otra-materia", db)).toBe(false);
    await finalizar(insc.inscripcion.id, "QUITADA_CENTRO");
    expect(await existeInscripcionVigenteConProfesor(alumno.idAlumno, turno.profesorId!, turno.materiaId, db)).toBe(false);
    expect(await gerentePuedeGestionarClaseDeBaja(turno.idTurno, turno.profesorId!, db)).toBe(true);
    expect(await gerentePuedeGestionarClaseDeBaja(turno.idTurno, "otro-profesor", db)).toBe(false);
    expect(await gerentePuedeGestionarClaseDeBaja("no-existe", turno.profesorId!, db)).toBe(false);
  });
});
