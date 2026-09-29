import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { contarAlumnosNuevosPorMes } from "./alumno.publico";

// Misma guarda que turno.publico.pg.test.ts: nunca escribir en la base habitual.
const habilitada = Boolean(process.env.HU_C15_TEST_DATABASE_URL
  && process.env.DATABASE_URL === process.env.HU_C15_TEST_DATABASE_URL);
const db = habilitada ? new PrismaClient() : null;
const prefijo = `pgalu${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
let secuencia = 0;

async function crearAlumno(createdAt: Date, activo = true) {
  const id = `${prefijo}-${secuencia++}`;
  await db!.alumno.create({
    data: {
      idAlumno: id, nombreAlumno: "Prueba", apellidoAlumno: id,
      nombreNormalizadoAlumno: "prueba", apellidoNormalizadoAlumno: id,
      dniAlumno: `${id}-dni`, fechaNacimientoAlumno: new Date("2000-01-01T00:00:00.000Z"),
      activoAlumno: activo, createdAtAlumno: createdAt,
    },
  });
  return id;
}

function mesEnBuenosAires(instante: Date) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit",
  }).formatToParts(instante);
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)!.value;
  return `${valor("year")}-${valor("month")}`;
}

const cantidadDe = (conteo: { mes: string; cantidad: number }[], mes: string) =>
  conteo.find((fila) => fila.mes === mes)?.cantidad ?? 0;

describe.skipIf(!habilitada)("alumno.publico: PostgreSQL real aislado", () => {
  afterAll(async () => {
    try {
      await db?.alumno.deleteMany({ where: { idAlumno: { startsWith: prefijo } } });
    } finally {
      await db?.$disconnect();
    }
  });

  it("agrupa por mes de Buenos Aires, no de UTC (borde 30/09 → 01/10)", async () => {
    const antes = await contarAlumnosNuevosPorMes("2026-09", "2026-10", db!);
    // 2026-10-01T01:30Z es 30/09 22:30 en Buenos Aires; 03:30Z es 01/10 00:30.
    await crearAlumno(new Date("2026-10-01T01:30:00.000Z"));
    await crearAlumno(new Date("2026-10-01T03:30:00.000Z"));
    const despues = await contarAlumnosNuevosPorMes("2026-09", "2026-10", db!);
    expect(cantidadDe(despues, "2026-09") - cantidadDe(antes, "2026-09")).toBe(1);
    expect(cantidadDe(despues, "2026-10") - cantidadDe(antes, "2026-10")).toBe(1);
  });

  it("cuenta igual un alta de Prisma y una de SQL crudo con CURRENT_TIMESTAMP", async () => {
    const mes = mesEnBuenosAires(new Date());
    const antes = cantidadDe(await contarAlumnosNuevosPorMes(mes, mes, db!), mes);
    await crearAlumno(new Date());
    const id = `${prefijo}-raw`;
    await db!.$executeRaw`
      INSERT INTO "alumnos" (
        "idAlumno", "nombreAlumno", "apellidoAlumno", "nombreNormalizadoAlumno",
        "apellidoNormalizadoAlumno", "dniAlumno", "fechaNacimientoAlumno",
        "activoAlumno", "createdAtAlumno", "updatedAtAlumno"
      ) VALUES (
        ${id}, 'Prueba', ${id}, 'prueba', ${id}, ${`${id}-dni`}, DATE '2000-01-01',
        true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;
    const despues = cantidadDe(await contarAlumnosNuevosPorMes(mes, mes, db!), mes);
    expect(mesEnBuenosAires(new Date())).toBe(mes);
    expect(despues - antes).toBe(2);
  });

  it("omite meses sin datos, cuenta activos e inactivos y ordena ascendente", async () => {
    const anio = new Date().getUTCFullYear() + 100;
    await crearAlumno(new Date(`${anio}-01-15T12:00:00.000Z`), true);
    await crearAlumno(new Date(`${anio}-01-20T12:00:00.000Z`), false);
    await crearAlumno(new Date(`${anio}-03-10T12:00:00.000Z`), false);
    await crearAlumno(new Date(`${anio}-05-10T12:00:00.000Z`), true);
    const conteo = await contarAlumnosNuevosPorMes(`${anio}-01`, `${anio}-04`, db!);
    expect(conteo).toEqual([{ mes: `${anio}-01`, cantidad: 2 }, { mes: `${anio}-03`, cantidad: 1 }]);
    expect(typeof conteo[0]!.cantidad).toBe("number");
  });
});
