import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type EstadoTurno, type Prisma } from "@prisma/client";
import {
  ajustarCuposPorCapacidadDeAula,
  bloquearTurnoParaOperacion,
  contarTurnosFuturosDeProfesorPorMateria,
  obtenerAlumnosInscriptosDeTurno,
  promediarOcupacionTurnosPorMes,
} from "./turno.publico";

// Inscripción vigente sin plazo de pago (PR-0.md §2.1 y §2.15): los campos que la fila exige desde el PR 0.
const SIN_PLAZO = { estadoPago: "PAGO_SIN_REGISTRAR", precio: 10000, reservadaEl: new Date() } as const;

// Misma guarda que turno.reservas.pg.test.ts: nunca escribir en la base habitual.
const habilitada = Boolean(process.env.HU_C15_TEST_DATABASE_URL
  && process.env.DATABASE_URL === process.env.HU_C15_TEST_DATABASE_URL);
const db = habilitada ? new PrismaClient() : null;
const otraConexion = habilitada ? new PrismaClient() : null;
const prefijo = `pgpub${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
const materia = [`${prefijo}-m1`, `${prefijo}-m2`];
const profesor = [0, 1, 2].map((n) => `${prefijo}-p${n}`);
const aula = [0, 1, 2].map((n) => `${prefijo}-a${n}`);
const alumno = [0, 1, 2, 3].map((n) => `${prefijo}-s${n}`);
const usuarioId = `${prefijo}-usuario`;
const hora = (valor: string) => new Date(`1970-01-01T${valor}:00.000Z`);
const dia = (anio: number, mes: number, numero: number) =>
  new Date(Date.UTC(anio, mes - 1, numero));

function diaRelativo(dias: number) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)!.value);
  const fecha = dia(valor("year"), valor("month"), valor("day"));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha;
}

type CrearTurno = {
  estado: EstadoTurno;
  fecha: Date;
  materiaId?: string;
  profesorId?: string | null;
  aulaId?: string | null;
  cupo?: number | null;
  alumnoIds?: string[];
  inicio?: string;
  duracion?: number;
};

async function crearTurno(sufijo: string, opciones: CrearTurno) {
  const id = `${prefijo}-t-${sufijo}`;
  await db!.turno.create({
    data: {
      idTurno: id,
      fechaTurno: opciones.fecha,
      horaInicioTurno: hora(opciones.inicio ?? "10:00"),
      duracionMinutosTurno: opciones.duracion ?? 60,
      cupoMaximoTurno: opciones.cupo ?? 4,
      materiaId: opciones.materiaId ?? materia[0],
      profesorId: opciones.profesorId ?? null,
      aulaId: opciones.aulaId ?? null,
      estadoTurno: "PENDIENTE",
    },
  });
  if (opciones.alumnoIds?.length) {
    await db!.turnoAlumno.createMany({
      data: opciones.alumnoIds.map((alumnoId) => ({ turnoId: id, alumnoId, ...SIN_PLAZO })),
    });
  }
  if (opciones.estado !== "PENDIENTE") {
    await db!.turno.update({ where: { idTurno: id }, data: { estadoTurno: opciones.estado } });
  }
  return id;
}

async function esperarBloqueo(tx: Prisma.TransactionClient, pid: number) {
  const limite = Date.now() + 3_000;
  while (Date.now() < limite) {
    const [estado] = await tx.$queryRaw<{ wait_event_type: string | null }[]>`
      SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${pid}
    `;
    if (estado?.wait_event_type === "Lock") return;
    await new Promise((resolver) => setTimeout(resolver, 25));
  }
  throw new Error("La segunda conexión no llegó a esperar por el bloqueo del turno");
}

describe.skipIf(!habilitada)("turno.publico: PostgreSQL real aislado", () => {
  beforeAll(async () => {
    for (let n = 0; n < materia.length; n++) {
      await db!.materia.create({
        data: { idMateria: materia[n], nombreMateria: materia[n], nombreNormalizadaMateria: materia[n] },
      });
    }
    for (let n = 0; n < profesor.length; n++) {
      await db!.profesor.create({
        data: {
          idProfesor: profesor[n], nombreProfesor: "Prueba", apellidoProfesor: String(n),
          nombreNormalizadoProfesor: "prueba", apellidoNormalizadoProfesor: String(n),
          dniProfesor: `${prefijo}-dni-p${n}`, fechaNacimientoProfesor: dia(1990, 1, 1),
        },
      });
    }
    for (let n = 0; n < aula.length; n++) {
      await db!.aula.create({
        data: {
          idAula: aula[n], nombreAula: `${prefijo} ${n}`,
          nombreNormalizadaAula: `${prefijo} ${n}`, capacidadAula: 4,
        },
      });
    }
    for (let n = 0; n < alumno.length; n++) {
      await db!.alumno.create({
        data: {
          idAlumno: alumno[n], nombreAlumno: "Prueba", apellidoAlumno: String(n),
          nombreNormalizadoAlumno: "prueba", apellidoNormalizadoAlumno: String(n),
          dniAlumno: `${prefijo}-dni-a${n}`, fechaNacimientoAlumno: dia(2000, 1, 1),
        },
      });
    }
  });

  afterAll(async () => {
    try {
      if (db) {
        await db.eventoTurno.deleteMany({ where: { turnoId: { startsWith: prefijo } } });
        await db.turno.deleteMany({ where: { idTurno: { startsWith: prefijo } } });
        await db.alumno.deleteMany({ where: { idAlumno: { startsWith: prefijo } } });
        await db.aula.deleteMany({ where: { idAula: { startsWith: prefijo } } });
        await db.profesor.deleteMany({ where: { idProfesor: { startsWith: prefijo } } });
        await db.materia.deleteMany({ where: { idMateria: { startsWith: prefijo } } });
      }
    } finally {
      await Promise.all([db?.$disconnect(), otraConexion?.$disconnect()]);
    }
  });

  it("bloquearTurnoParaOperacion da formato, inscriptos, inexistente y vigencia", async () => {
    const futuro = await crearTurno("lectura-futuro", {
      fecha: diaRelativo(5), inicio: "10:30", duracion: 120,
      estado: "COMPLETO", profesorId: profesor[0], aulaId: aula[0],
      alumnoIds: [alumno[1], alumno[0]], cupo: 2,
    });
    const pasado = await crearTurno("lectura-pasado", {
      fecha: diaRelativo(-5), estado: "DISPONIBLE", profesorId: profesor[0], aulaId: aula[0],
    });
    await db!.$transaction(async (tx) => {
      expect(await bloquearTurnoParaOperacion(`${prefijo}-inexistente`, tx)).toBeNull();
      expect(await bloquearTurnoParaOperacion(futuro, tx)).toEqual({
        id: futuro, estado: "COMPLETO", fecha: diaRelativo(5).toISOString().slice(0, 10),
        hora_inicio: "10:30", hora_fin: "12:30", duracion_min: 120,
        materia_id: materia[0], profesor_id: profesor[0], aula_id: aula[0],
        alumno_ids: [alumno[0], alumno[1]], vencido: false,
      });
      expect(await bloquearTurnoParaOperacion(pasado, tx)).toMatchObject({ vencido: true });
    });
  });

  it("FOR SHARE retiene una cancelación de otra conexión hasta el commit", async () => {
    const id = await crearTurno("bloqueo", {
      fecha: diaRelativo(6), estado: "DISPONIBLE", aulaId: aula[0],
    });
    let cancelar: Promise<unknown> | undefined;
    await db!.$transaction(async (tx) => {
      expect((await bloquearTurnoParaOperacion(id, tx))?.estado).toBe("DISPONIBLE");
      let avisarPid!: (pid: number) => void;
      const pidListo = new Promise<number>((resolver) => { avisarPid = resolver; });
      cancelar = otraConexion!.$transaction(async (otroTx) => {
        const [conexion] = await otroTx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        avisarPid(conexion.pid);
        await otroTx.turno.update({ where: { idTurno: id }, data: { estadoTurno: "CANCELADO" } });
      }, { timeout: 15_000 });
      await esperarBloqueo(tx, await pidListo);
      expect((await tx.turno.findUniqueOrThrow({ where: { idTurno: id } })).estadoTurno).toBe("DISPONIBLE");
    }, { timeout: 15_000 });
    await cancelar;
    expect((await db!.turno.findUniqueOrThrow({ where: { idTurno: id } })).estadoTurno).toBe("CANCELADO");
  }, 20_000);

  it("obtenerAlumnosInscriptosDeTurno distingue null, vacío y lista de IDs", async () => {
    const vacio = await crearTurno("alumnos-vacio", { fecha: diaRelativo(7), estado: "PENDIENTE" });
    const ocupado = await crearTurno("alumnos-ocupado", {
      fecha: diaRelativo(8), estado: "PENDIENTE", alumnoIds: [alumno[2], alumno[0]],
    });
    expect(await obtenerAlumnosInscriptosDeTurno(`${prefijo}-no-existe`, db!)).toBeNull();
    expect(await obtenerAlumnosInscriptosDeTurno(vacio, db!)).toEqual([]);
    expect(await obtenerAlumnosInscriptosDeTurno(ocupado, db!)).toEqual([alumno[0], alumno[2]]);
  });

  it("contarTurnosFuturosDeProfesorPorMateria separa estados y excluye ajenos", async () => {
    const base = { profesorId: profesor[1], materiaId: materia[1] };
    await crearTurno("conteo-disponible", { ...base, fecha: diaRelativo(10), estado: "DISPONIBLE" });
    await crearTurno("conteo-completo", {
      ...base, fecha: diaRelativo(11), estado: "COMPLETO", cupo: 1, alumnoIds: [alumno[0]],
    });
    await crearTurno("conteo-pendiente", { ...base, fecha: diaRelativo(12), estado: "PENDIENTE" });
    await crearTurno("conteo-cancelado", { ...base, fecha: diaRelativo(13), estado: "CANCELADO" });
    await crearTurno("conteo-pasado", { ...base, fecha: diaRelativo(-10), estado: "DISPONIBLE" });
    await crearTurno("conteo-otro-profesor", {
      ...base, profesorId: profesor[2], fecha: diaRelativo(14), estado: "DISPONIBLE",
    });
    await crearTurno("conteo-otra-materia", {
      ...base, materiaId: materia[0], fecha: diaRelativo(15), estado: "DISPONIBLE",
    });
    expect(await contarTurnosFuturosDeProfesorPorMateria(profesor[1], materia[1], db!))
      .toEqual({ confirmados: 2, pendientes: 1 });
  });

  it("ajustarCuposPorCapacidadDeAula devuelve los IDs en conflicto sin escribir", async () => {
    const uno = await crearTurno("conflicto-uno", {
      fecha: diaRelativo(20), estado: "DISPONIBLE", aulaId: aula[1], cupo: 4,
      alumnoIds: [alumno[0], alumno[1]],
    });
    const dos = await crearTurno("conflicto-dos", {
      fecha: diaRelativo(21), estado: "COMPLETO", aulaId: aula[1], cupo: 3,
      alumnoIds: [alumno[0], alumno[1], alumno[2]],
    });
    const pendiente = await crearTurno("conflicto-pendiente", {
      fecha: diaRelativo(22), estado: "PENDIENTE", aulaId: aula[1], cupo: 4,
      alumnoIds: [alumno[0], alumno[1], alumno[2]],
    });
    const ids = [uno, dos, pendiente];
    const antes = await db!.turno.findMany({
      where: { idTurno: { in: ids } },
      select: { idTurno: true, cupoMaximoTurno: true, estadoTurno: true, updatedAtTurno: true },
      orderBy: { idTurno: "asc" },
    });
    const resultado = await db!.$transaction((tx) => ajustarCuposPorCapacidadDeAula(aula[1], 1, usuarioId, tx));
    const despues = await db!.turno.findMany({
      where: { idTurno: { in: ids } },
      select: { idTurno: true, cupoMaximoTurno: true, estadoTurno: true, updatedAtTurno: true },
      orderBy: { idTurno: "asc" },
    });
    expect(despues).toEqual(antes);
    expect(await db!.eventoTurno.count({ where: { turnoId: { in: ids } } })).toBe(0);
    expect(resultado).toEqual({
      ok: false, turnos_en_conflicto: [uno, dos], max_inscriptos: 3,
    });
  });

  it("ajustarCuposPorCapacidadDeAula recalcula estados y solo devuelve eventos", async () => {
    const pendiente = await crearTurno("ajuste-pendiente", {
      fecha: diaRelativo(30), estado: "PENDIENTE", aulaId: aula[2], cupo: 4,
    });
    const disponible = await crearTurno("ajuste-disponible", {
      fecha: diaRelativo(31), estado: "DISPONIBLE", aulaId: aula[2], cupo: 4,
      alumnoIds: [alumno[0], alumno[1]],
    });
    const completo = await crearTurno("ajuste-completo", {
      fecha: diaRelativo(32), estado: "COMPLETO", aulaId: aula[2], cupo: 1,
      alumnoIds: [alumno[2]],
    });
    const pasado = await crearTurno("ajuste-pasado", {
      fecha: diaRelativo(-30), estado: "DISPONIBLE", aulaId: aula[2], cupo: 4,
    });
    const pasadoAntes = await db!.turno.findUniqueOrThrow({ where: { idTurno: pasado } });
    const resultado = await db!.$transaction((tx) => ajustarCuposPorCapacidadDeAula(aula[2], 2, usuarioId, tx));
    expect(resultado).toMatchObject({ ok: true, turnos_actualizados: 3 });
    if (!resultado.ok) throw new Error("Se esperaba éxito");
    const estado = await db!.turno.findMany({
      where: { idTurno: { in: [pendiente, disponible, completo, pasado] } },
      select: { idTurno: true, cupoMaximoTurno: true, estadoTurno: true },
    });
    const porId = new Map(estado.map((fila) => [fila.idTurno, fila]));
    expect(porId.get(pendiente)).toMatchObject({ cupoMaximoTurno: 2, estadoTurno: "PENDIENTE" });
    expect(porId.get(disponible)).toMatchObject({ cupoMaximoTurno: 2, estadoTurno: "COMPLETO" });
    expect(porId.get(completo)).toMatchObject({ cupoMaximoTurno: 2, estadoTurno: "DISPONIBLE" });
    expect(porId.get(pasado)).toMatchObject({ cupoMaximoTurno: 4, estadoTurno: "DISPONIBLE" });
    expect(await db!.turno.findUniqueOrThrow({ where: { idTurno: pasado } })).toEqual(pasadoAntes);
    expect(resultado.eventos).toContainEqual({
      tipoEvento: "turno:completado", turnoId: disponible,
      payloadEvento: { turno_id: disponible, alumno_ids: [alumno[0], alumno[1]], cupo_maximo: 2, usuario_id: usuarioId },
    });
    expect(resultado.eventos).toContainEqual({
      tipoEvento: "turno:disponible_nuevamente", turnoId: completo,
      payloadEvento: { turno_id: completo, alumno_id_liberado: null, usuario_id: usuarioId },
    });
    for (const id of [pendiente, disponible, completo]) {
      expect(resultado.eventos).toContainEqual({
        tipoEvento: "turno:cupo_actualizado", turnoId: id,
        payloadEvento: {
          turno_id: id, aula_id: aula[2],
          cupo_anterior: id === completo ? 1 : 4, cupo_nuevo: 2, usuario_id: usuarioId,
        },
      });
    }
    expect(resultado.eventos).toHaveLength(5);
    expect(await db!.eventoTurno.count({
      where: { turnoId: { in: [pendiente, disponible, completo, pasado] } },
    })).toBe(0);
  });

  it("ajustarCuposPorCapacidadDeAula bloquea un turno vencido sin modificarlo", async () => {
    const id = await crearTurno("ajuste-vencido-bloqueado", {
      fecha: diaRelativo(-40), estado: "DISPONIBLE", aulaId: aula[0], cupo: 4,
    });
    const antes = await db!.turno.findUniqueOrThrow({ where: { idTurno: id } });
    let actualizar: Promise<unknown> | undefined;
    await db!.$transaction(async (tx) => {
      const resultado = await ajustarCuposPorCapacidadDeAula(aula[0], 2, usuarioId, tx);
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) throw new Error("Se esperaba un ajuste exitoso");
      expect(resultado.eventos.every(({ turnoId }) => turnoId !== id)).toBe(true);
      expect(await tx.turno.findUniqueOrThrow({ where: { idTurno: id } })).toEqual(antes);
      let avisarPid!: (pid: number) => void;
      const pidListo = new Promise<number>((resolver) => { avisarPid = resolver; });
      actualizar = otraConexion!.$transaction(async (otroTx) => {
        const [conexion] = await otroTx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        avisarPid(conexion.pid);
        await otroTx.turno.update({ where: { idTurno: id }, data: { cupoMaximoTurno: 9 } });
      }, { timeout: 15_000 });
      await esperarBloqueo(tx, await pidListo);
    }, { timeout: 15_000 });
    await actualizar;
    expect((await db!.turno.findUniqueOrThrow({ where: { idTurno: id } })).cupoMaximoTurno).toBe(9);
  }, 20_000);

  it("ajustarCuposPorCapacidadDeAula respeta el rollback del llamador", async () => {
    const id = `${prefijo}-t-ajuste-disponible`;
    const antes = await db!.turno.findUniqueOrThrow({ where: { idTurno: id } });
    const capacidadAnterior = (await db!.aula.findUniqueOrThrow({ where: { idAula: aula[2] } })).capacidadAula;
    await expect(db!.$transaction(async (tx) => {
      await tx.aula.update({ where: { idAula: aula[2] }, data: { capacidadAula: 5 } });
      const resultado = await ajustarCuposPorCapacidadDeAula(aula[2], 5, usuarioId, tx);
      expect(resultado).toMatchObject({ ok: true, turnos_actualizados: 3 });
      throw new Error("ROLLBACK_DE_PRUEBA");
    })).rejects.toThrow("ROLLBACK_DE_PRUEBA");
    const despues = await db!.turno.findUniqueOrThrow({ where: { idTurno: id } });
    expect(despues).toMatchObject({ cupoMaximoTurno: antes.cupoMaximoTurno, estadoTurno: antes.estadoTurno });
    expect((await db!.aula.findUniqueOrThrow({ where: { idAula: aula[2] } })).capacidadAula).toBe(capacidadAnterior);
  });

  it("promediarOcupacionTurnosPorMes promedia inscriptos/cupo solo de DISPONIBLE/COMPLETO hasta la fecha máxima", async () => {
    const anio = new Date().getUTCFullYear() + 10;
    // Diciembre: 1/4 (DISPONIBLE) y 1/1 (COMPLETO) → (0.25 + 1) / 2 = 0.625.
    await crearTurno("ocu-disp", { fecha: dia(anio, 12, 3), estado: "DISPONIBLE", cupo: 4, alumnoIds: [alumno[0]] });
    await crearTurno("ocu-comp", { fecha: dia(anio, 12, 4), estado: "COMPLETO", cupo: 1, alumnoIds: [alumno[1]] });
    // Excluidos: CANCELADO y PENDIENTE (alterarían el promedio si contaran) y uno posterior a la fecha máxima.
    await crearTurno("ocu-canc", { fecha: dia(anio, 12, 5), estado: "CANCELADO", cupo: 4, alumnoIds: [] });
    await crearTurno("ocu-pend", { fecha: dia(anio, 12, 6), estado: "PENDIENTE", cupo: 2, alumnoIds: [] });
    await crearTurno("ocu-futuro", { fecha: dia(anio + 1, 1, 20), estado: "DISPONIBLE", cupo: 4, alumnoIds: [] });
    // Enero: 2/4 → 0.5; cruza de año.
    await crearTurno("ocu-enero", { fecha: dia(anio + 1, 1, 10), estado: "DISPONIBLE", cupo: 4, alumnoIds: [alumno[2], alumno[3]] });

    const ocupacion = await promediarOcupacionTurnosPorMes(`${anio}-11`, `${anio + 1}-01`, `${anio + 1}-01-15`, db!);
    expect(ocupacion).toEqual([
      { mes: `${anio}-12`, promedio: 0.625, turnos: 2 },
      { mes: `${anio + 1}-01`, promedio: 0.5, turnos: 1 },
    ]);
    // Sin tope de fecha, el turno futuro de enero (0/4) baja el promedio a 0.25.
    expect(await promediarOcupacionTurnosPorMes(`${anio + 1}-01`, `${anio + 1}-01`, `${anio + 1}-12-31`, db!))
      .toEqual([{ mes: `${anio + 1}-01`, promedio: 0.25, turnos: 2 }]);
  });

});

const { emitirEventosTurno } = await import("./turno.publico");

describe.skipIf(!habilitada)("emitirEventosTurno: PostgreSQL real aislado", () => {
  const dbEventos = habilitada ? new PrismaClient() : null;
  const prefijoEventos = `pgevt${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
  const materiaEventos = `${prefijoEventos}-m`;
  const aulaEventos = [0, 1].map((n) => `${prefijoEventos}-a${n}`);
  const alumnoEventos = [0, 1, 2].map((n) => `${prefijoEventos}-s${n}`);
  const usuarioEventos = `${prefijoEventos}-usuario`;

  async function crearTurnoEventos(sufijo: string, opciones: {
    estado: EstadoTurno; fecha: Date; aulaId: string; cupo: number; alumnoIds?: string[];
  }) {
    const id = `${prefijoEventos}-t-${sufijo}`;
    await dbEventos!.turno.create({
      data: {
        idTurno: id, fechaTurno: opciones.fecha, horaInicioTurno: hora("10:00"), duracionMinutosTurno: 60,
        cupoMaximoTurno: opciones.cupo, materiaId: materiaEventos, aulaId: opciones.aulaId, estadoTurno: "PENDIENTE",
      },
    });
    if (opciones.alumnoIds?.length) {
      await dbEventos!.turnoAlumno.createMany({
        data: opciones.alumnoIds.map((alumnoId) => ({ turnoId: id, alumnoId, ...SIN_PLAZO })),
      });
    }
    if (opciones.estado !== "PENDIENTE") {
      await dbEventos!.turno.update({ where: { idTurno: id }, data: { estadoTurno: opciones.estado } });
    }
    return id;
  }

  beforeAll(async () => {
    await dbEventos!.materia.create({
      data: { idMateria: materiaEventos, nombreMateria: materiaEventos, nombreNormalizadaMateria: materiaEventos },
    });
    for (const idAula of aulaEventos) {
      await dbEventos!.aula.create({
        data: { idAula, nombreAula: idAula, nombreNormalizadaAula: idAula, capacidadAula: 4 },
      });
    }
    for (let n = 0; n < alumnoEventos.length; n++) {
      await dbEventos!.alumno.create({
        data: {
          idAlumno: alumnoEventos[n], nombreAlumno: "Prueba", apellidoAlumno: String(n),
          nombreNormalizadoAlumno: "prueba", apellidoNormalizadoAlumno: String(n),
          dniAlumno: `${prefijoEventos}-dni-a${n}`, fechaNacimientoAlumno: dia(2000, 1, 1),
        },
      });
    }
  });

  afterAll(async () => {
    try {
      if (dbEventos) {
        await dbEventos.eventoTurno.deleteMany({ where: { turnoId: { startsWith: prefijoEventos } } });
        await dbEventos.turno.deleteMany({ where: { idTurno: { startsWith: prefijoEventos } } });
        await dbEventos.alumno.deleteMany({ where: { idAlumno: { startsWith: prefijoEventos } } });
        await dbEventos.aula.deleteMany({ where: { idAula: { startsWith: prefijoEventos } } });
        await dbEventos.materia.deleteMany({ where: { idMateria: { startsWith: prefijoEventos } } });
      }
    } finally {
      await dbEventos?.$disconnect();
    }
  });

  it("después del COMMIT registra un cupo_actualizado por turno futuro y un evento por transición", async () => {
    const pendiente = await crearTurnoEventos("pendiente", {
      estado: "PENDIENTE", fecha: diaRelativo(30), aulaId: aulaEventos[0], cupo: 4,
    });
    const disponible = await crearTurnoEventos("disponible", {
      estado: "DISPONIBLE", fecha: diaRelativo(31), aulaId: aulaEventos[0], cupo: 4,
      alumnoIds: [alumnoEventos[0], alumnoEventos[1]],
    });
    const completo = await crearTurnoEventos("completo", {
      estado: "COMPLETO", fecha: diaRelativo(32), aulaId: aulaEventos[0], cupo: 1, alumnoIds: [alumnoEventos[2]],
    });
    const pasado = await crearTurnoEventos("pasado", {
      estado: "DISPONIBLE", fecha: diaRelativo(-30), aulaId: aulaEventos[0], cupo: 4,
    });
    const ids = [pendiente, disponible, completo, pasado];

    const ajuste = await dbEventos!.$transaction((tx) =>
      ajustarCuposPorCapacidadDeAula(aulaEventos[0], 2, usuarioEventos, tx));
    if (!ajuste.ok) throw new Error("Se esperaba un ajuste exitoso");
    expect(await dbEventos!.eventoTurno.count({ where: { turnoId: { in: ids } } })).toBe(0);
    await emitirEventosTurno(ajuste.eventos);

    const filas = await dbEventos!.eventoTurno.findMany({
      where: { turnoId: { in: ids } },
      select: { tipoEvento: true, turnoId: true, usuarioId: true, payloadEvento: true },
    });
    const cupo = (turnoId: string, anterior: number) => ({
      tipoEvento: "turno:cupo_actualizado", turnoId, usuarioId: usuarioEventos,
      payloadEvento: { turno_id: turnoId, aula_id: aulaEventos[0], cupo_anterior: anterior, cupo_nuevo: 2, usuario_id: usuarioEventos },
    });
    expect(filas).toHaveLength(5);
    expect(filas).toEqual(expect.arrayContaining([
      cupo(pendiente, 4), cupo(disponible, 4), cupo(completo, 1),
      {
        tipoEvento: "turno:completado", turnoId: disponible, usuarioId: usuarioEventos,
        payloadEvento: { turno_id: disponible, alumno_ids: [alumnoEventos[0], alumnoEventos[1]], cupo_maximo: 2, usuario_id: usuarioEventos },
      },
      {
        tipoEvento: "turno:disponible_nuevamente", turnoId: completo, usuarioId: usuarioEventos,
        payloadEvento: { turno_id: completo, alumno_id_liberado: null, usuario_id: usuarioEventos },
      },
    ]));
    expect(filas.some(({ turnoId }) => turnoId === pasado)).toBe(false);
  });

  it("un ajuste con ok: false revierte la transacción y no inserta filas", async () => {
    const id = await crearTurnoEventos("conflicto", {
      estado: "DISPONIBLE", fecha: diaRelativo(33), aulaId: aulaEventos[1], cupo: 4,
      alumnoIds: [alumnoEventos[0], alumnoEventos[1]],
    });
    const antes = await dbEventos!.turno.findUniqueOrThrow({ where: { idTurno: id } });
    // Mismo flujo que modificarAula(): la emisión va después del COMMIT y un throw en el callback no llega a ella.
    const modificarAula = async () => {
      const eventos = await dbEventos!.$transaction(async (tx) => {
        await tx.aula.update({ where: { idAula: aulaEventos[1] }, data: { capacidadAula: 1 } });
        const ajuste = await ajustarCuposPorCapacidadDeAula(aulaEventos[1], 1, usuarioEventos, tx);
        if (!ajuste.ok) throw new Error("CAPACIDAD_MENOR_A_INSCRIPTOS");
        return ajuste.eventos;
      });
      await emitirEventosTurno(eventos);
    };
    await expect(modificarAula()).rejects.toThrow("CAPACIDAD_MENOR_A_INSCRIPTOS");
    expect(await dbEventos!.turno.findUniqueOrThrow({ where: { idTurno: id } })).toEqual(antes);
    expect((await dbEventos!.aula.findUniqueOrThrow({ where: { idAula: aulaEventos[1] } })).capacidadAula).toBe(4);
    expect(await dbEventos!.eventoTurno.count({ where: { turnoId: id } })).toBe(0);
  });
});
