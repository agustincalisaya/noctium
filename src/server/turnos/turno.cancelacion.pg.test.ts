import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cancelarTurno } from "@/server/turnos/turno.cancelacion.service";
import { abrirCajaDePrueba, crearOperacionDePrueba } from "@/server/testing/fabricas";

// Inscripción vigente sin plazo de pago (PR-0.md §2.1 y §2.15): los campos que la fila exige desde el PR 0.
const SIN_PLAZO = { estadoPago: "PAGO_SIN_REGISTRAR", precio: 10000, reservadaEl: new Date() } as const;

// Solo contra una base aislada llamada noctium_test, con las migraciones aplicadas.
const url = process.env.DATABASE_URL;
const habilitada = Boolean(url && url === process.env.HU_C05_TEST_DATABASE_URL && new URL(url).pathname === "/noctium_test");
const db = habilitada ? new PrismaClient() : null;
const prefijo = `c05pg${Date.now()}`;
const fecha = (valor: string) => new Date(`${valor}T00:00:00.000Z`);
const hora = (valor: string) => new Date(`1970-01-01T${valor}:00.000Z`);
const materia = `${prefijo}-materia`;
const profesor = `${prefijo}-prof`;
const aula = `${prefijo}-aula`;
const alumnos = [0, 1].map((n) => `${prefijo}-alumno-${n}`);
const formaPago = `${prefijo}-fp`;
const usuario = `${prefijo}-mesa`;
const turnos: string[] = [];

async function crearTurno(sufijo: string, dia: string, inicio: string, estadoTurno: "PENDIENTE" | "DISPONIBLE", inscriptos: string[], conAula = true) {
  const idTurno = `${prefijo}-${sufijo}`;
  turnos.push(idTurno);
  // Se inserta PENDIENTE y se confirma después: el trigger reserva al pasar a DISPONIBLE (como §2.2).
  await db!.turno.create({ data: { idTurno, fechaTurno: fecha(dia), horaInicioTurno: hora(inicio), duracionMinutosTurno: 60,
    materiaId: materia, profesorId: profesor, aulaId: conAula ? aula : null, cupoMaximoTurno: conAula ? 5 : null, estadoTurno: "PENDIENTE" } });
  for (const alumnoId of inscriptos) await db!.turnoAlumno.create({ data: { turnoId: idTurno, alumnoId, ...SIN_PLAZO } });
  if (estadoTurno === "DISPONIBLE") await db!.turno.update({ where: { idTurno }, data: { estadoTurno } });
  return idTurno;
}

/** Un pago de Sprint 2 con las filas que exige desde el PR 0 (2.3): caja abierta, operación e inscripción vigente del par. */
async function pagoDePrueba(turnoId: string, alumnoId: string, monto: string, fechaPago: Date) {
  const caja = await abrirCajaDePrueba(db!);
  const inscripcion = await db!.turnoAlumno.findFirstOrThrow({ where: { turnoId, alumnoId, vigencia: "VIGENTE" } });
  return crearOperacionDePrueba(db!, { cajaId: caja.idCaja, inscripcionIds: [inscripcion.idInscripcion], formaPagoId: formaPago, monto, fechaPago });
}

const reservas = (turnoId: string) => db!.$queryRawUnsafe<{ tipo: string; recurso: string }[]>(
  'SELECT "tipoRecurso" AS tipo, "recursoId" AS recurso FROM "reservas_turno" WHERE "turnoId" = $1 ORDER BY 1, 2', turnoId);

describe.skipIf(!habilitada)("HU-C-05 cancelar/descartar en PostgreSQL aislado", () => {
  beforeAll(async () => {
    await db!.materia.create({ data: { idMateria: materia, nombreMateria: materia, nombreNormalizadaMateria: materia } });
    await db!.profesor.create({ data: { idProfesor: profesor, nombreProfesor: "Profesor", apellidoProfesor: "C05",
      nombreNormalizadoProfesor: "profesor", apellidoNormalizadoProfesor: "c05", dniProfesor: `${Date.now()}`.slice(-9), fechaNacimientoProfesor: fecha("1980-01-01") } });
    await db!.aula.create({ data: { idAula: aula, nombreAula: `C05 ${prefijo.slice(-10)}`, nombreNormalizadaAula: `c05 ${prefijo.slice(-10)}`, capacidadAula: 5 } });
    for (const [n, idAlumno] of alumnos.entries()) await db!.alumno.create({ data: { idAlumno, nombreAlumno: "Alumno", apellidoAlumno: `C05 ${n}`,
      nombreNormalizadoAlumno: "alumno", apellidoNormalizadoAlumno: `c05 ${n}`, dniAlumno: `${Date.now()}${n}`.slice(-9), fechaNacimientoAlumno: fecha("2000-01-01") } });
    await db!.formaPago.create({ data: { idFormaPago: formaPago, nombreFormaPago: prefijo, nombreNormalizadaFormaPago: prefijo } });
  });
  afterAll(async () => {
    if (!db) return;
    // Limpieza de los fixtures propios de esta base aislada.
    await db.eventoTurno.deleteMany({ where: { turnoId: { in: turnos } } });
    await db.pago.deleteMany({ where: { turnoId: { in: turnos } } });
    await db.operacionPago.deleteMany({ where: { formaPagoId: formaPago } });
    await db.turnoAlumno.deleteMany({ where: { turnoId: { in: turnos } } });
    await db.turno.deleteMany({ where: { idTurno: { in: turnos } } });
    await db.formaPago.deleteMany({ where: { idFormaPago: formaPago } });
    await db.alumno.deleteMany({ where: { idAlumno: { in: alumnos } } });
    await db.aula.deleteMany({ where: { idAula: aula } });
    await db.profesor.deleteMany({ where: { idProfesor: profesor } });
    await db.materia.deleteMany({ where: { idMateria: materia } });
    await db.$disconnect();
    await prisma.$disconnect();
  });

  it("AC3/AC5: cancela un DISPONIBLE, el trigger libera aula/profesor/alumnos y se conservan inscripciones y pagos", async () => {
    const t1 = await crearTurno("t1", "2030-10-07", "10:00", "DISPONIBLE", alumnos);
    await pagoDePrueba(t1, alumnos[0], "12000.00", fecha("2030-09-30"));
    expect(await reservas(t1)).toHaveLength(4); // aula + profesor + 2 alumnos
    const antes = await db!.turno.findUniqueOrThrow({ where: { idTurno: t1 } });

    // Mientras T1 está confirmado, otro turno superpuesto con el mismo profesor, aula y alumno no puede confirmarse.
    const t2 = await crearTurno("t2", "2030-10-07", "10:30", "PENDIENTE", [alumnos[1]]);
    await expect(db!.turno.update({ where: { idTurno: t2 }, data: { estadoTurno: "DISPONIBLE" } })).rejects.toThrow();

    await expect(cancelarTurno(t1, usuario)).resolves.toEqual({ id: t1, estado: "CANCELADO" });

    const despues = await db!.turno.findUniqueOrThrow({ where: { idTurno: t1 } });
    expect(despues).toMatchObject({ estadoTurno: "CANCELADO", modificadoPorUsuarioId: usuario, profesorId: profesor, aulaId: aula,
      cupoMaximoTurno: 5, prioridadTurno: antes.prioridadTurno, duracionMinutosTurno: 60 });
    expect(despues.fechaTurno).toEqual(antes.fechaTurno);
    expect(despues.updatedAtTurno.getTime()).toBeGreaterThan(antes.updatedAtTurno.getTime());
    expect(await reservas(t1)).toEqual([]);
    expect(await db!.turnoAlumno.count({ where: { turnoId: t1 } })).toBe(2);
    expect(await db!.pago.count({ where: { turnoId: t1 } })).toBe(1);

    // Liberado: ahora el turno superpuesto sí confirma (profesor, aula y alumno libres).
    await expect(db!.turno.update({ where: { idTurno: t2 }, data: { estadoTurno: "DISPONIBLE" } })).resolves.toBeTruthy();
    expect(await reservas(t2)).toHaveLength(3);

    const eventos = await db!.eventoTurno.findMany({ where: { turnoId: t1 } });
    expect(eventos.map((evento) => [evento.tipoEvento, evento.usuarioId, evento.payloadEvento])).toEqual([[
      "turno:cancelado", usuario,
      { turno_id: t1, estado_anterior: "DISPONIBLE", profesor_id: profesor, aula_id: aula, alumno_ids: [...alumnos].sort(), usuario_id: usuario },
    ]]);
  });

  it("AC3: un CANCELADO es terminal — cancelar de nuevo responde TURNO_CANCELADO sin otro evento", async () => {
    const t1 = `${prefijo}-t1`;
    await expect(cancelarTurno(t1, usuario)).rejects.toMatchObject({ code: "TURNO_CANCELADO" });
    expect(await db!.eventoTurno.count({ where: { turnoId: t1 } })).toBe(1);
  });

  it("AC2 / N-1: descarta un PENDIENTE vencido (sin reservas previas) y lo deja CANCELADO", async () => {
    const pendiente = await crearTurno("pend-vencido", "2020-10-05", "10:00", "PENDIENTE", [], false);
    expect(await reservas(pendiente)).toEqual([]);
    await expect(cancelarTurno(pendiente, usuario)).resolves.toEqual({ id: pendiente, estado: "CANCELADO" });
    expect((await db!.turno.findUniqueOrThrow({ where: { idTurno: pendiente } })).estadoTurno).toBe("CANCELADO");
    const [evento] = await db!.eventoTurno.findMany({ where: { turnoId: pendiente } });
    expect(evento.payloadEvento).toMatchObject({ estado_anterior: "PENDIENTE", aula_id: null, alumno_ids: [] });
  });

  it("R5-6: un DISPONIBLE vencido no se cancela y queda intacto", async () => {
    const vencido = await crearTurno("disp-vencido", "2020-10-06", "10:00", "DISPONIBLE", [alumnos[0]]);
    const antes = await db!.turno.findUniqueOrThrow({ where: { idTurno: vencido } });
    await expect(cancelarTurno(vencido, usuario)).rejects.toMatchObject({ code: "TURNO_VENCIDO" });
    const despues = await db!.turno.findUniqueOrThrow({ where: { idTurno: vencido } });
    expect(despues).toEqual(antes);
    expect(await reservas(vencido)).toHaveLength(3);
    expect(await db!.eventoTurno.count({ where: { turnoId: vencido } })).toBe(0);
  });

  it("concurrencia (Regla 7): dos cancelaciones simultáneas del mismo turno — una gana, la otra TURNO_CANCELADO, un solo evento", async () => {
    const t3 = await crearTurno("t3", "2030-10-08", "10:00", "DISPONIBLE", [alumnos[0]]);
    const resultados = await Promise.allSettled([cancelarTurno(t3, usuario), cancelarTurno(t3, usuario)]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazo = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rechazo.reason).toMatchObject({ code: "TURNO_CANCELADO" });
    expect(await db!.eventoTurno.count({ where: { turnoId: t3 } })).toBe(1);
    expect(await reservas(t3)).toEqual([]);
  });

  it("T-PC (premisa): si falla el evento posterior al commit, el turno queda CANCELADO y sin evento", async () => {
    const t4 = await crearTurno("t4", "2030-10-09", "10:00", "DISPONIBLE", [alumnos[1]]);
    const espia = vi.spyOn(prisma.eventoTurno, "create").mockRejectedValueOnce(new Error("eventos_turno no disponible"));
    await expect(cancelarTurno(t4, usuario)).rejects.toThrow("eventos_turno no disponible");
    espia.mockRestore();
    expect((await db!.turno.findUniqueOrThrow({ where: { idTurno: t4 } })).estadoTurno).toBe("CANCELADO");
    expect(await reservas(t4)).toEqual([]);
    expect(await db!.eventoTurno.count({ where: { turnoId: t4 } })).toBe(0);
  });

  it("inexistente responde TURNO_NO_ENCONTRADO", async () => {
    await expect(cancelarTurno(`${prefijo}-no-existe`, usuario)).rejects.toMatchObject({ code: "TURNO_NO_ENCONTRADO" });
  });
});
