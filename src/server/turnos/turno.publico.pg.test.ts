import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type EstadoTurno, type Prisma } from "@prisma/client";
import {
  ajustarCuposPorCapacidadDeAula,
  bloquearTurnoParaOperacion,
  contarTurnosFuturosDeProfesorPorMateria,
  contarTurnosPorMes,
  obtenerAlumnosInscriptosDeTurno,
} from "./turno.publico";

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
      data: opciones.alumnoIds.map((alumnoId) => ({ turnoId: id, alumnoId })),
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

  it("contarTurnosPorMes usa fechaTurno, cruza año y omite estados y meses vacíos", async () => {
    const anio = new Date().getUTCFullYear() + 10;
    const crear = (sufijo: string, fecha: Date, estado: EstadoTurno) =>
      crearTurno(sufijo, { fecha, estado, cupo: estado === "COMPLETO" ? 1 : 4,
        alumnoIds: estado === "COMPLETO" ? [alumno[3]] : [] });
    await crear("mes-antes", dia(anio, 11, 30), "DISPONIBLE");
    await crear("mes-inicio", dia(anio, 12, 1), "DISPONIBLE");
    await crear("mes-cancelado", dia(anio, 12, 2), "CANCELADO");
    await crear("mes-final", dia(anio + 1, 1, 31), "COMPLETO");
    await crear("mes-pendiente", dia(anio + 1, 1, 30), "PENDIENTE");
    await crear("mes-despues", dia(anio + 1, 2, 1), "DISPONIBLE");
    const desde = `${anio}-12`;
    const hasta = `${anio + 1}-01`;
    const conteo = await contarTurnosPorMes(desde, hasta, db!);
    expect(conteo).toEqual([{ mes: desde, cantidad: 2 }, { mes: hasta, cantidad: 1 }]);
    expect(typeof conteo[0].cantidad).toBe("number");
    const [conteoRaw] = await db!.$queryRaw<{ cantidad: bigint }[]>`
      SELECT COUNT(*) AS cantidad FROM "turnos" WHERE "fechaTurno" = ${dia(anio, 12, 1)}
    `;
    expect(typeof conteoRaw.cantidad).toBe("bigint");
    expect(await contarTurnosPorMes(`${anio}-12`, `${anio + 1}-03`, db!)).toEqual([
      { mes: desde, cantidad: 2 }, { mes: hasta, cantidad: 1 }, { mes: `${anio + 1}-02`, cantidad: 1 },
    ]);
  });
});
