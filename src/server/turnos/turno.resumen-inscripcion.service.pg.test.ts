import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearInscripcionDePrueba, crearMateriaDePrueba, crearTurnoDePrueba, crearUsuarioDePrueba } from "@/server/testing/fabricas";
import { obtenerResumenInscripcion } from "@/server/turnos/turno.resumen-inscripcion.service";
import { solicitarTurnoPropio } from "@/server/turnos/turno.service";
import { ahora, conReloj } from "@/server/shared/reloj";
import { inicioDeTurno, isoCentro } from "@/server/shared/fechas-centro";

describe.skipIf(!basePgHabilitada)("C-20 PostgreSQL descartable: GET y confirmación real de C-12", () => {
  let db: PrismaClient;
  beforeAll(() => { db = clientePg(); });
  afterAll(async () => { await db?.$disconnect(); });
  const cuentaAlumno = async (activo = true) => {
    const cuenta = await crearUsuarioDePrueba(db, { rol: "ALUMNO" });
    const alumno = await crearAlumnoDePrueba(db, { usuarioId: cuenta.idUsuario, activo });
    return { usuarioId: cuenta.idUsuario, alumnoId: alumno.idAlumno };
  };
  // Snapshot persistido: detecta efectos del GET sobre filas, auditoría y proyecciones.
  const snapshot = async (turnoId: string) => ({
    turno: await db.turno.findUnique({ where: { idTurno: turnoId } }),
    inscripciones: await db.turnoAlumno.findMany({ where: { turnoId }, orderBy: { idInscripcion: "asc" } }),
    eventos: await db.eventoTurno.findMany({ where: { turnoId }, orderBy: { idEvento: "asc" } }),
    reservas: await db.reservaTurno.findMany({ where: { turnoId }, orderBy: [{ tipoRecurso: "asc" }, { recursoId: "asc" }] }),
    historial: await db.historialInscripcion.findMany({ where: { inscripcion: { turnoId } }, orderBy: { idHistorialInscripcion: "asc" } }),
  });
  it.each([60, 120, 180] as const)("GET %i min: datos reales, precio entero, offset, aula inactiva y ninguna mutación", async (duracionMin) => {
    const cuenta = await cuentaAlumno();
    const turno = await crearTurnoDePrueba(db, { duracionMin });
    await db.aula.update({ where: { idAula: turno.aulaId! }, data: { activaAula: false } });
    const antes = await snapshot(turno.idTurno);
    const data = await obtenerResumenInscripcion(turno.idTurno, cuenta.usuarioId, db);
    expect(data).toMatchObject({
      turno_id: turno.idTurno, precio: 12000 * duracionMin / 60, duracion_min: duracionMin,
      cupo: 10, lugares_disponibles: 10, plazo_pago_horas: 24, vence_pago_el: expect.stringMatching(/-03:00$/),
      materia: { id: turno.materiaId, nombre: expect.any(String) },
      profesor: { id: turno.profesorId, nombre_para_mostrar: expect.any(String) },
      aula: { id: turno.aulaId, nombre: expect.any(String) },
      fecha: turno.fechaTurno.toISOString().slice(0, 10), hora_inicio: "10:00",
      hora_fin: `${10 + duracionMin / 60}:00`,
      limite_cancelacion_en_linea: isoCentro(new Date(inicioDeTurno(turno).getTime() - 24 * 3_600_000)),
      limite_cancelacion_pasado: false,
    });
    expect(await snapshot(turno.idTurno)).toEqual(antes);
  });
  it("ocupación vigente: reserva vencida sin marcar no ocupa ni rechaza al mismo alumno; GET no la marca", async () => {
    const cuenta = await cuentaAlumno();
    const turno = await crearTurnoDePrueba(db, { cupo: 1 });
    await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: cuenta.alumnoId, estadoPago: "RESERVADA", reservadaEl: new Date(ahora().getTime() - 25 * 3_600_000) });
    await db.turno.update({ where: { idTurno: turno.idTurno }, data: { estadoTurno: "COMPLETO" } });
    const antes = await snapshot(turno.idTurno);
    expect(await obtenerResumenInscripcion(turno.idTurno, cuenta.usuarioId, db)).toMatchObject({ lugares_disponibles: 1 });
    expect(await snapshot(turno.idTurno)).toEqual(antes);
  });
  it("GET → cambio de cupo → POST rechaza sin alta, eventos ni proyecciones adicionales", async () => {
    const cuenta = await cuentaAlumno();
    const turno = await crearTurnoDePrueba(db, { cupo: 1 });
    await obtenerResumenInscripcion(turno.idTurno, cuenta.usuarioId, db);
    const otro = await cuentaAlumno();
    await solicitarTurnoPropio(turno.idTurno, otro.usuarioId);
    const antes = await snapshot(turno.idTurno);
    await expect(solicitarTurnoPropio(turno.idTurno, cuenta.usuarioId)).rejects.toMatchObject({ code: "CUPO_INSUFICIENTE" });
    expect(await snapshot(turno.idTurno)).toEqual(antes);
  });
  it("GET → inscripción superpuesta → POST rechaza sin alta; GET no valida superposición", async () => {
    const cuenta = await cuentaAlumno();
    const turno = await crearTurnoDePrueba(db, { enDias: 6, hora: "16:00" });
    await obtenerResumenInscripcion(turno.idTurno, cuenta.usuarioId, db);
    const otro = await crearTurnoDePrueba(db, { enDias: 6, hora: "16:30" });
    await solicitarTurnoPropio(otro.idTurno, cuenta.usuarioId);
    await expect(obtenerResumenInscripcion(turno.idTurno, cuenta.usuarioId, db)).resolves.toMatchObject({ turno_id: turno.idTurno });
    const antes = await snapshot(turno.idTurno);
    await expect(solicitarTurnoPropio(turno.idTurno, cuenta.usuarioId)).rejects.toMatchObject({ code: "ALUMNO_NO_DISPONIBLE" });
    expect(await snapshot(turno.idTurno)).toEqual(antes);
  });
  it("GET → tarifa nueva → POST guarda precio nuevo; cambios posteriores no modifican el almacenado", async () => {
    const cuenta = await cuentaAlumno();
    const turno = await crearTurnoDePrueba(db, { duracionMin: 120 });
    expect((await obtenerResumenInscripcion(turno.idTurno, cuenta.usuarioId, db)).precio).toBe(24000);
    // Fixture aislado para simular el cambio: no implementa la gestión de tarifas de L-06.
    await db.materia.update({ where: { idMateria: turno.materiaId }, data: { tarifaHoraMateria: 15000 } });
    await solicitarTurnoPropio(turno.idTurno, cuenta.usuarioId);
    const fila = await db.turnoAlumno.findFirstOrThrow({ where: { turnoId: turno.idTurno, alumnoId: cuenta.alumnoId } });
    expect(fila).toMatchObject({ precio: 30000, estadoPago: "RESERVADA", vigencia: "VIGENTE", venceEl: expect.any(Date), creadoPorUsuarioId: cuenta.usuarioId });
    await db.materia.update({ where: { idMateria: turno.materiaId }, data: { tarifaHoraMateria: 18000 } });
    expect((await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: fila.idInscripcion } })).precio).toBe(30000);
    expect(await db.historialInscripcion.count({ where: { inscripcionId: fila.idInscripcion } })).toBe(1);
    expect(await db.eventoTurno.count({ where: { turnoId: turno.idTurno, tipoEvento: "turno:alumno_agregado" } })).toBe(1);
  });
  it("dos resúmenes del último lugar: solo una confirmación concurrente persiste", async () => {
    const turno = await crearTurnoDePrueba(db, { cupo: 1 });
    const a = await cuentaAlumno(); const b = await cuentaAlumno();
    await Promise.all([a, b].map((cuenta) => obtenerResumenInscripcion(turno.idTurno, cuenta.usuarioId, db)));
    const resultados = await Promise.allSettled([a, b].map((cuenta) => solicitarTurnoPropio(turno.idTurno, cuenta.usuarioId)));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "CUPO_INSUFICIENTE" } });
    expect(await db.turnoAlumno.count({ where: { turnoId: turno.idTurno } })).toBe(1);
    expect(await db.eventoTurno.count({ where: { turnoId: turno.idTurno, tipoEvento: "turno:alumno_agregado" } })).toBe(1);
  });
  it("materia sin tarifa: GET y POST 422, sin cambios persistidos", async () => {
    const cuenta = await cuentaAlumno();
    const materia = await crearMateriaDePrueba(db, { tarifaHora: null });
    const turno = await crearTurnoDePrueba(db, { materiaId: materia.idMateria });
    const antes = await snapshot(turno.idTurno);
    await expect(obtenerResumenInscripcion(turno.idTurno, cuenta.usuarioId, db)).rejects.toMatchObject({ code: "MATERIA_SIN_TARIFA", status: 422 });
    await expect(solicitarTurnoPropio(turno.idTurno, cuenta.usuarioId)).rejects.toMatchObject({ code: "MATERIA_SIN_TARIFA", status: 422 });
    expect(await snapshot(turno.idTurno)).toEqual(antes);
  });
  it("clase en las próximas 24 h: límite pasado y vencimiento limitado al inicio", async () => {
    const cuenta = await cuentaAlumno();
    const momento = new Date("2026-10-09T18:00:00Z");
    const turno = await conReloj(momento, () => crearTurnoDePrueba(db, { enDias: 1, hora: "10:00" }));
    expect(await conReloj(momento, () => obtenerResumenInscripcion(turno.idTurno, cuenta.usuarioId, db))).toMatchObject({
      fecha: "2026-10-10", limite_cancelacion_en_linea: "2026-10-09T10:00:00-03:00", limite_cancelacion_pasado: true,
      plazo_pago_horas: 24, vence_pago_el: "2026-10-10T10:00:00-03:00",
    });
  });
});
