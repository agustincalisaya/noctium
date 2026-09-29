import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type Prisma } from "@prisma/client";
import { profesorActivoDictaMateria } from "./profesor.publico";

// Misma guarda que turno.publico.pg.test.ts: nunca escribir en la base habitual.
const habilitada = Boolean(process.env.HU_C15_TEST_DATABASE_URL
  && process.env.DATABASE_URL === process.env.HU_C15_TEST_DATABASE_URL);
const db = habilitada ? new PrismaClient() : null;
const otraConexion = habilitada ? new PrismaClient() : null;
const prefijo = `pgprof${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
const materia = [`${prefijo}-m0`, `${prefijo}-m1`];
const activo = `${prefijo}-p-activo`;
const inactivo = `${prefijo}-p-inactivo`;

async function esperarBloqueo(tx: Prisma.TransactionClient, pid: number) {
  const limite = Date.now() + 3_000;
  while (Date.now() < limite) {
    const [estado] = await tx.$queryRaw<{ wait_event_type: string | null }[]>`
      SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${pid}
    `;
    if (estado?.wait_event_type === "Lock") return;
    await new Promise((resolver) => setTimeout(resolver, 25));
  }
  throw new Error("La segunda conexión no llegó a esperar por el bloqueo de profesor_materia");
}

describe.skipIf(!habilitada)("profesor.publico: PostgreSQL real aislado", () => {
  beforeAll(async () => {
    for (const id of materia) {
      await db!.materia.create({ data: { idMateria: id, nombreMateria: id, nombreNormalizadaMateria: id } });
    }
    for (const [id, activoProfesor] of [[activo, true], [inactivo, false]] as const) {
      await db!.profesor.create({
        data: {
          idProfesor: id, nombreProfesor: "Prueba", apellidoProfesor: id,
          nombreNormalizadoProfesor: "prueba", apellidoNormalizadoProfesor: id,
          dniProfesor: `${id}-dni`, fechaNacimientoProfesor: new Date("1990-01-01T00:00:00.000Z"),
          activoProfesor,
        },
      });
    }
    await db!.profesorMateria.createMany({
      data: [
        { profesorId: activo, materiaId: materia[0]! },
        { profesorId: inactivo, materiaId: materia[0]! },
      ],
    });
  });

  afterAll(async () => {
    try {
      if (db) {
        await db.profesorMateria.deleteMany({ where: { profesorId: { startsWith: prefijo } } });
        await db.profesor.deleteMany({ where: { idProfesor: { startsWith: prefijo } } });
        await db.materia.deleteMany({ where: { idMateria: { startsWith: prefijo } } });
      }
    } finally {
      await Promise.all([db?.$disconnect(), otraConexion?.$disconnect()]);
    }
  });

  it("con db responde igual que sin db", async () => {
    const casos = [[activo, materia[0]!], [activo, materia[1]!], [inactivo, materia[0]!]] as const;
    for (const [profesorId, materiaId] of casos) {
      const sinDb = await profesorActivoDictaMateria(profesorId, materiaId);
      const conDb = await db!.$transaction((tx) => profesorActivoDictaMateria(profesorId, materiaId, tx));
      expect(conDb).toBe(sinDb);
    }
    expect(await db!.$transaction((tx) => profesorActivoDictaMateria(activo, materia[0]!, tx))).toBe(true);
    expect(await profesorActivoDictaMateria(inactivo, materia[0]!)).toBe(false);
  });

  it("FOR SHARE retiene un UPDATE de profesor_materia de otra conexión hasta el commit", async () => {
    let actualizar: Promise<unknown> | undefined;
    let terminoAntesDelCommit = false;
    await db!.$transaction(async (tx) => {
      expect(await profesorActivoDictaMateria(activo, materia[0]!, tx)).toBe(true);
      let avisarPid!: (pid: number) => void;
      const pidListo = new Promise<number>((resolver) => { avisarPid = resolver; });
      actualizar = otraConexion!.$transaction(async (otroTx) => {
        const [conexion] = await otroTx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        avisarPid(conexion!.pid);
        await otroTx.profesorMateria.update({
          where: { profesorId_materiaId: { profesorId: activo, materiaId: materia[0]! } },
          data: { creadoPorUsuarioId: `${prefijo}-usuario` },
        });
      }, { timeout: 15_000 }).then(() => { terminoAntesDelCommit = true; });
      await esperarBloqueo(tx, await pidListo);
      expect(terminoAntesDelCommit).toBe(false);
    }, { timeout: 15_000 });
    await actualizar;
    const fila = await db!.profesorMateria.findUniqueOrThrow({
      where: { profesorId_materiaId: { profesorId: activo, materiaId: materia[0]! } },
    });
    expect(fila.creadoPorUsuarioId).toBe(`${prefijo}-usuario`);
  }, 20_000);

  it("no bloquea la fila del profesor", async () => {
    await db!.$transaction(async (tx) => {
      expect(await profesorActivoDictaMateria(activo, materia[0]!, tx)).toBe(true);
      await otraConexion!.$transaction(async (otroTx) => {
        await otroTx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
        await otroTx.profesor.update({
          where: { idProfesor: activo }, data: { modificadoPorUsuarioId: `${prefijo}-usuario` },
        });
      }, { timeout: 10_000 });
    }, { timeout: 15_000 });
    expect((await db!.profesor.findUniqueOrThrow({ where: { idProfesor: activo } })).modificadoPorUsuarioId)
      .toBe(`${prefijo}-usuario`);
  }, 20_000);
});
