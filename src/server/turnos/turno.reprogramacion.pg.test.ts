import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { abrirCajaDePrueba, crearOperacionDePrueba } from "@/server/testing/fabricas";
import { reprogramarTurno } from "./turno.reprogramacion.service";

// Inscripción vigente sin plazo de pago (PR-0.md §2.1 y §2.15): los campos que la fila exige desde el PR 0.
const SIN_PLAZO = { estadoPago: "PAGO_SIN_REGISTRAR", precio: 10000, reservadaEl: new Date() } as const;

// Solo contra una base aislada llamada noctium_test, con las migraciones aplicadas.
const url = process.env.DATABASE_URL;
const habilitada = Boolean(url && url === process.env.HU_C06_TEST_DATABASE_URL && new URL(url).pathname === "/noctium_test");
const db = habilitada ? new PrismaClient() : null;
const prefijo = `c06pg${Date.now()}`;
const fecha = (valor: string) => new Date(`${valor}T00:00:00.000Z`);
const hora = (valor: string) => new Date(`1970-01-01T${valor}:00.000Z`);
const materia = `${prefijo}-materia`;
const profesores = [0, 1, 2].map((n) => `${prefijo}-prof-${n}`);
const aulas = [0, 1, 2].map((n) => `${prefijo}-aula-${n}`);
const alumnos = [0, 1, 2, 3, 4].map((n) => `${prefijo}-alumno-${n}`);
const formaPago = `${prefijo}-fp`;
const usuario = `${prefijo}-mesa`;
const turnos: string[] = [];
// Fechas de 2030: con N-4 el tope es la fecha actual del turno, así la suite no depende del día en que corre.
const entrada = (dia: string, inicio: string) => ({ fecha: fecha(dia), hora_inicio: inicio });


/** Un pago de Sprint 2 con las filas que exige desde el PR 0 (2.3): caja abierta, operación e inscripción vigente del par. */
async function pagoDePrueba(turnoId: string, alumnoId: string, monto: string, fechaPago: Date) {
  const caja = await abrirCajaDePrueba(db!);
  const inscripcion = await db!.turnoAlumno.findFirstOrThrow({ where: { turnoId, alumnoId, vigencia: "VIGENTE" } });
  return crearOperacionDePrueba(db!, { cajaId: caja.idCaja, inscripcionIds: [inscripcion.idInscripcion], formaPagoId: formaPago, monto, fechaPago });
}
async function crearTurno(sufijo: string, datos: { dia: string; inicio: string; duracion?: number; profesor: string; aula: string; inscriptos: string[];
  estado?: "PENDIENTE" | "DISPONIBLE" | "COMPLETO"; cupo?: number }) {
  const idTurno = `${prefijo}-${sufijo}`;
  turnos.push(idTurno);
  await db!.turno.create({ data: { idTurno, fechaTurno: fecha(datos.dia), horaInicioTurno: hora(datos.inicio), duracionMinutosTurno: datos.duracion ?? 60,
    materiaId: materia, profesorId: datos.profesor, aulaId: datos.aula, cupoMaximoTurno: datos.cupo ?? 5, estadoTurno: "PENDIENTE", prioridadTurno: "ALTA" } });
  for (const alumnoId of datos.inscriptos) await db!.turnoAlumno.create({ data: { turnoId: idTurno, alumnoId, ...SIN_PLAZO } });
  // Confirmar después de inscribir: el trigger proyecta profesor, aula y alumnos (como §2.2).
  if ((datos.estado ?? "DISPONIBLE") !== "PENDIENTE") await db!.turno.update({ where: { idTurno }, data: { estadoTurno: datos.estado ?? "DISPONIBLE" } });
  return idTurno;
}

const reservas = (turnoId: string) => db!.$queryRawUnsafe<{ tipo: string; recurso: string; inicio: string; fin: string }[]>(
  `SELECT "tipoRecurso" AS tipo, "recursoId" AS recurso, to_char("inicioReserva", 'YYYY-MM-DD HH24:MI') AS inicio, to_char("finReserva", 'HH24:MI') AS fin
   FROM "reservas_turno" WHERE "turnoId" = $1 ORDER BY 1, 2`, turnoId);
const fila = (idTurno: string) => db!.turno.findUniqueOrThrow({ where: { idTurno } });
const eventos = (turnoId: string) => db!.eventoTurno.findMany({ where: { turnoId, tipoEvento: "turno:reprogramado" } });

describe.skipIf(!habilitada)("HU-C-06 reprogramar en PostgreSQL aislado", () => {
  beforeAll(async () => {
    await db!.materia.create({ data: { idMateria: materia, nombreMateria: materia, nombreNormalizadaMateria: materia } });
    for (const [n, idProfesor] of profesores.entries()) {
      await db!.profesor.create({ data: { idProfesor, nombreProfesor: "Profesor", apellidoProfesor: `C06 ${n}`, nombreNormalizadoProfesor: "profesor",
        apellidoNormalizadoProfesor: `c06 ${n}`, dniProfesor: `${Date.now()}${n}`.slice(-9), fechaNacimientoProfesor: fecha("1980-01-01") } });
      for (const diaSemanaHorario of ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"] as const) {
        await db!.horarioProfesor.create({ data: { profesorId: idProfesor, diaSemanaHorario, horaDesdeHorario: hora("08:00"), horaHastaHorario: hora(n === 2 ? "12:00" : "20:00") } });
      }
    }
    for (const [n, idAula] of aulas.entries()) await db!.aula.create({ data: { idAula, nombreAula: `C06 ${prefijo.slice(-10)} ${n}`, nombreNormalizadaAula: `c06 ${prefijo.slice(-10)} ${n}`, capacidadAula: 5 } });
    for (const [n, idAlumno] of alumnos.entries()) await db!.alumno.create({ data: { idAlumno, nombreAlumno: "Alumno", apellidoAlumno: `C06 ${n}`,
      nombreNormalizadoAlumno: "alumno", apellidoNormalizadoAlumno: `c06 ${n}`, dniAlumno: `${Date.now()}${n}`.slice(-9), fechaNacimientoAlumno: fecha("2000-01-01") } });
    await db!.formaPago.create({ data: { idFormaPago: formaPago, nombreFormaPago: prefijo, nombreNormalizadaFormaPago: prefijo } });
  });
  afterAll(async () => {
    if (!db) return;
    await db.claseDictadaAlumno.deleteMany({ where: { clase: { turnoId: { in: turnos } } } });
    await db.claseDictada.deleteMany({ where: { turnoId: { in: turnos } } });
    await db.eventoTurno.deleteMany({ where: { turnoId: { in: turnos } } });
    await db.pago.deleteMany({ where: { turnoId: { in: turnos } } });
    await db.operacionPago.deleteMany({ where: { formaPagoId: formaPago } });
    await db.turnoAlumno.deleteMany({ where: { turnoId: { in: turnos } } });
    await db.turno.deleteMany({ where: { idTurno: { in: turnos } } });
    await db.formaPago.deleteMany({ where: { idFormaPago: formaPago } });
    await db.alumno.deleteMany({ where: { idAlumno: { in: alumnos } } });
    await db.aula.deleteMany({ where: { idAula: { in: aulas } } });
    await db.horarioProfesor.deleteMany({ where: { profesorId: { in: profesores } } });
    await db.profesor.deleteMany({ where: { idProfesor: { in: profesores } } });
    await db.materia.deleteMany({ where: { idMateria: materia } });
    await db.$disconnect();
    await prisma.$disconnect();
  });

  it("E-01: rechaza un turno con clase registrada y conserva turno, clase y alumnos", async () => {
    const id = await crearTurno("clase", { dia: "2020-10-16", inicio: "10:00", profesor: profesores[0], aula: aulas[0], inscriptos: [alumnos[0]] });
    const clase = await db!.claseDictada.create({ data: {
      turnoId: id, fechaClaseDictada: fecha("2020-10-16"), materiaId: materia, profesorId: profesores[0],
      alumnos: { create: [{ alumnoId: alumnos[0] }] },
    }, include: { alumnos: true } });
    const turnoAntes = await fila(id);
    const reservasAntes = await reservas(id);

    await expect(reprogramarTurno(id, entrada("2030-10-16", "11:00"), usuario)).rejects.toMatchObject({ code: "TURNO_VENCIDO" });

    expect(await fila(id)).toEqual(turnoAntes);
    expect(await reservas(id)).toEqual(reservasAntes);
    // Relación 1:N (PR-0.md §2.0): la clase dictada del turno es la no anulada.
    expect(await db!.claseDictada.findFirst({ where: { turnoId: id, anuladaEl: null }, include: { alumnos: true } })).toEqual(clase);
    expect(await eventos(id)).toEqual([]);
  });

  it("AC3/AC4 (parte 1): cambia solo fecha y hora; conserva estado, duración, materia, profesor, aula, cupo, prioridad, inscripciones y pagos; mueve las reservas", async () => {
    const t1 = await crearTurno("t1", { dia: "2030-10-16", inicio: "10:00", profesor: profesores[0], aula: aulas[0], inscriptos: [alumnos[0], alumnos[1]] });
    await pagoDePrueba(t1, alumnos[0], "9000.00", fecha("2030-10-01"));
    const antes = await fila(t1);

    await expect(reprogramarTurno(t1, entrada("2030-10-15", "14:00"), usuario)).resolves.toEqual({
      id: t1, fecha: "2030-10-15", hora_inicio: "14:00", hora_fin: "15:00", estado: "DISPONIBLE" });

    const despues = await fila(t1);
    expect(despues).toMatchObject({ estadoTurno: antes.estadoTurno, duracionMinutosTurno: antes.duracionMinutosTurno, materiaId: antes.materiaId,
      profesorId: antes.profesorId, aulaId: antes.aulaId, cupoMaximoTurno: antes.cupoMaximoTurno, prioridadTurno: "ALTA",
      creadoPorUsuarioId: antes.creadoPorUsuarioId, modificadoPorUsuarioId: usuario });
    expect(despues.fechaTurno).toEqual(fecha("2030-10-15"));
    expect(despues.horaInicioTurno).toEqual(hora("14:00"));
    expect(despues.updatedAtTurno.getTime()).toBeGreaterThan(antes.updatedAtTurno.getTime());
    expect((await db!.turnoAlumno.findMany({ where: { turnoId: t1 }, orderBy: { alumnoId: "asc" } })).map((r) => r.alumnoId)).toEqual([alumnos[0], alumnos[1]]);
    expect(await db!.pago.count({ where: { turnoId: t1 } })).toBe(1);
    expect((await reservas(t1)).map((r) => `${r.tipo} ${r.inicio}-${r.fin}`)).toEqual([
      "ALUMNO 2030-10-15 14:00-15:00", "ALUMNO 2030-10-15 14:00-15:00", "AULA 2030-10-15 14:00-15:00", "PROFESOR 2030-10-15 14:00-15:00",
    ]);
    // El horario anterior quedó libre: otro turno con el mismo profesor, aula y alumno confirma ahí.
    const t2 = await crearTurno("t2", { dia: "2030-10-16", inicio: "10:00", profesor: profesores[0], aula: aulas[0], inscriptos: [alumnos[0]] });
    expect((await fila(t2)).estadoTurno).toBe("DISPONIBLE");

    const [evento] = await eventos(t1);
    expect(evento.payloadEvento).toEqual({ turno_id: t1, fecha_anterior: "2030-10-16", hora_inicio_anterior: "10:00", fecha_nueva: "2030-10-15",
      hora_inicio_nueva: "14:00", hora_fin_nueva: "15:00", usuario_id: usuario });
  });

  it("AC3: un COMPLETO sigue COMPLETO", async () => {
    const t3 = await crearTurno("t3", { dia: "2030-10-16", inicio: "15:00", profesor: profesores[1], aula: aulas[1], inscriptos: [alumnos[2]], estado: "COMPLETO", cupo: 1 });
    await expect(reprogramarTurno(t3, entrada("2030-10-16", "17:00"), usuario)).resolves.toMatchObject({ estado: "COMPLETO" });
    expect((await fila(t3)).estadoTurno).toBe("COMPLETO");
  });

  it("exclusión del propio turno: 10:00–12:00 → 11:00–13:00 el mismo día no choca consigo mismo", async () => {
    const t4 = await crearTurno("t4", { dia: "2030-10-17", inicio: "10:00", duracion: 120, profesor: profesores[1], aula: aulas[1], inscriptos: [alumnos[3]] });
    await expect(reprogramarTurno(t4, entrada("2030-10-17", "11:00"), usuario)).resolves.toMatchObject({ hora_inicio: "11:00", hora_fin: "13:00" });
    expect((await reservas(t4)).every((r) => r.inicio === "2030-10-17 11:00" && r.fin === "13:00")).toBe(true);
  });

  it("AC2: profesor fuera de horario, aula y alumno ocupados → 409 con todos los recursos; el turno queda intacto y sin evento", async () => {
    const t5 = await crearTurno("t5", { dia: "2030-10-18", inicio: "08:00", profesor: profesores[2], aula: aulas[2], inscriptos: [alumnos[4], alumnos[3]] });
    await crearTurno("ocupa-aula-alumno", { dia: "2030-10-18", inicio: "13:00", profesor: profesores[1], aula: aulas[2], inscriptos: [alumnos[4]] });
    const antes = await fila(t5);
    // profesor-2 atiende solo 08:00–12:00: a las 13:00 queda fuera de horario.
    await expect(reprogramarTurno(t5, entrada("2030-10-18", "13:00"), usuario)).rejects.toMatchObject({ code: "REPROGRAMACION_CONFLICTO", detalles: { conflictos: [
      { recurso: "PROFESOR", id: profesores[2] }, { recurso: "AULA", id: aulas[2] }, { recurso: "ALUMNO", id: alumnos[4] },
    ] } });
    expect(await fila(t5)).toEqual(antes);
    expect(await eventos(t5)).toHaveLength(0);
  });

  it("concurrencia: dos reprogramaciones simultáneas hacia la misma aula y horario → una gana, la otra 409 y queda intacta", async () => {
    const a = await crearTurno("conc-a", { dia: "2030-10-23", inicio: "08:00", profesor: profesores[0], aula: aulas[1], inscriptos: [] });
    const b = await crearTurno("conc-b", { dia: "2030-10-23", inicio: "16:00", profesor: profesores[1], aula: aulas[1], inscriptos: [] });
    const [antesA, antesB] = [await fila(a), await fila(b)];
    const resultados = await Promise.allSettled([reprogramarTurno(a, entrada("2030-10-22", "10:00"), usuario), reprogramarTurno(b, entrada("2030-10-22", "10:00"), usuario)]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazo = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rechazo.reason).toMatchObject({ code: "REPROGRAMACION_CONFLICTO" });
    const perdedor = resultados[0].status === "rejected" ? a : b;
    expect(await fila(perdedor)).toEqual(perdedor === a ? antesA : antesB);
    expect(await eventos(perdedor)).toHaveLength(0);
    expect(await db!.eventoTurno.count({ where: { turnoId: { in: [a, b] }, tipoEvento: "turno:reprogramado" } })).toBe(1);
  });

  it("defensa de motor (23P01): una reserva que la validación no ve hace fallar el UPDATE, se traduce a 409 y revierte todo", async () => {
    const t6 = await crearTurno("t6", { dia: "2030-10-23", inicio: "12:00", profesor: profesores[0], aula: aulas[0], inscriptos: [alumnos[2]] });
    // Reserva de un turno PENDIENTE (la validación de §3.2 no lo mira) sobre el alumno, a la hora destino.
    const oculto = await crearTurno("oculto", { dia: "2030-10-21", inicio: "09:00", profesor: profesores[1], aula: aulas[1], inscriptos: [], estado: "PENDIENTE" });
    await db!.$executeRawUnsafe(`INSERT INTO "reservas_turno" VALUES ($1, 'ALUMNO', $2, '2030-10-21 09:00', '2030-10-21 10:00')`, oculto, alumnos[2]);
    const [antes, reservasAntes] = [await fila(t6), await reservas(t6)];
    await expect(reprogramarTurno(t6, entrada("2030-10-21", "09:00"), usuario)).rejects.toMatchObject({
      code: "REPROGRAMACION_CONFLICTO", detalles: { conflictos: [{ recurso: "ALUMNO", id: alumnos[2] }] } });
    expect(await fila(t6)).toEqual(antes);
    expect(await reservas(t6)).toEqual(reservasAntes);
    expect(await eventos(t6)).toHaveLength(0);
  });

  it("N-4: con el turno a fecha lejana, el tope es su propia fecha", async () => {
    const t7 = await crearTurno("t7", { dia: "2030-10-16", inicio: "18:00", profesor: profesores[1], aula: aulas[0], inscriptos: [] });
    await expect(reprogramarTurno(t7, entrada("2030-10-17", "18:00"), usuario)).rejects.toMatchObject({ code: "ANTICIPACION_EXCEDIDA" });
    await expect(reprogramarTurno(t7, entrada("2030-10-16", "19:00"), usuario)).resolves.toMatchObject({ fecha: "2030-10-16", hora_inicio: "19:00" });
  });

  it("T-PC (premisa): si falla el evento posterior al commit, el turno queda reprogramado y sin evento", async () => {
    const t8 = await crearTurno("t8", { dia: "2030-10-18", inicio: "16:00", profesor: profesores[0], aula: aulas[0], inscriptos: [] });
    const espia = vi.spyOn(prisma.eventoTurno, "create").mockRejectedValueOnce(new Error("eventos_turno no disponible"));
    await expect(reprogramarTurno(t8, entrada("2030-10-18", "17:00"), usuario)).rejects.toThrow("eventos_turno no disponible");
    espia.mockRestore();
    expect((await fila(t8)).horaInicioTurno).toEqual(hora("17:00"));
    expect(await eventos(t8)).toHaveLength(0);
  });
});
