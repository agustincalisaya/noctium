import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import {
  abrirCajaDePrueba,
  crearAlumnoDePrueba,
  crearInscripcionDePrueba,
  crearOperacionDePrueba,
  crearTurnoDePrueba,
} from "@/server/testing/fabricas";
import { conReloj } from "@/server/shared/reloj";
import { transaccion } from "@/server/shared/transaccion";
import { bloquear } from "@/server/shared/bloquear";
import {
  esVigenteEn,
  inscripcionesVigentes,
  ocupacion,
  recalcularEstadoTurno,
  sqlVigenteEn,
} from "@/server/turnos/inscripcion.vigencia";

// PostgreSQL real: sqlVigenteEn da lo mismo que esVigenteEn (PR-0.md §2.2) y
// el recálculo de Turno.estado usa solo las inscripciones vigentes.
describe.skipIf(!basePgHabilitada)("vigente a un momento dado con PostgreSQL real", () => {
  let db: PrismaClient;
  const reservadaEl = new Date("2030-05-01T15:00:00.000Z");
  const venceEl = new Date(reservadaEl.getTime() + 24 * 60 * 60 * 1000);
  const momentos = {
    antes: new Date(venceEl.getTime() - 1000),
    en: venceEl,
    despues: new Date(venceEl.getTime() + 1000),
  };
  let disponible: string;
  let cancelada: string;

  beforeAll(async () => {
    db = clientePg();
    // Las clases quedan a 20 días del reloj de la prueba, así el vencimiento
    // de las reservas es el del plazo (24 h) y no el inicio de la clase.
    await conReloj(reservadaEl, async () => {
      disponible = (await crearTurnoDePrueba(db, { enDias: 20 })).idTurno;
      cancelada = (await crearTurnoDePrueba(db, { enDias: 20, hora: "16:00", estado: "CANCELADO" })).idTurno;
      const alumnos = await Promise.all([0, 1, 2, 3, 4].map(() => crearAlumnoDePrueba(db)));
      await crearInscripcionDePrueba(db, { turnoId: disponible, alumnoId: alumnos[0]!.idAlumno, estadoPago: "RESERVADA" });
      await crearInscripcionDePrueba(db, { turnoId: disponible, alumnoId: alumnos[1]!.idAlumno });
      const aPagar = await crearInscripcionDePrueba(db, { turnoId: disponible, alumnoId: alumnos[2]!.idAlumno, estadoPago: "RESERVADA" });
      const caja = await abrirCajaDePrueba(db);
      await crearOperacionDePrueba(db, { cajaId: caja.idCaja, inscripcionIds: [aPagar.idInscripcion] });
      const quitada = await crearInscripcionDePrueba(db, { turnoId: disponible, alumnoId: alumnos[3]!.idAlumno, estadoPago: "RESERVADA" });
      await db.turnoAlumno.update({
        where: { idInscripcion: quitada.idInscripcion },
        data: { vigencia: "QUITADA_CENTRO", finalizadaEl: reservadaEl, finalizadaPorActorTipo: "PROCESO_AUTOMATICO" },
      });
      await crearInscripcionDePrueba(db, { turnoId: cancelada, alumnoId: alumnos[4]!.idAlumno, estadoPago: "RESERVADA" });
    });
  });

  afterAll(async () => { await db?.$disconnect(); });

  it.each(Object.entries(momentos))("sqlVigenteEn coincide con esVigenteEn %s de venceEl", async (_nombre, momento) => {
    const filas = await db.turnoAlumno.findMany({
      where: { turnoId: { in: [disponible, cancelada] } },
      include: { turno: { select: { estadoTurno: true } } },
    });
    const enJs = filas
      .filter((f) => esVigenteEn({ ...f, estadoClase: f.turno.estadoTurno }, momento))
      .map((f) => f.idInscripcion).sort();
    const enSql = (await db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT ta."idInscripcion" AS id FROM "turno_alumno" ta
      WHERE ta."turnoId" IN (${disponible}, ${cancelada}) AND ${sqlVigenteEn("ta", momento)}
    `)).map((f) => f.id).sort();
    expect(enSql).toEqual(enJs);
  });

  it("la reserva cuenta antes de venceEl y no en venceEl ni después; en la clase cancelada no vence", async () => {
    expect((await inscripcionesVigentes(db, disponible, momentos.antes)).length).toBe(3);
    expect((await inscripcionesVigentes(db, disponible, momentos.en)).length).toBe(2);
    expect((await inscripcionesVigentes(db, disponible, momentos.despues)).length).toBe(2);
    expect((await inscripcionesVigentes(db, cancelada, momentos.despues)).length).toBe(1);
  });

  it("recalcularEstadoTurno pasa a COMPLETO al llenar el cupo y vuelve a DISPONIBLE cuando vence la reserva", async () => {
    await db.turno.update({ where: { idTurno: disponible }, data: { cupoMaximoTurno: 3 } });
    const recalcular = (momento: Date) => transaccion(async (tx) => {
      await bloquear(tx, { clases: [disponible] });
      return recalcularEstadoTurno(tx, disponible, momento);
    }, { db });
    await expect(recalcular(momentos.antes)).resolves.toEqual({ anterior: "DISPONIBLE", nuevo: "COMPLETO", cambio: true });
    expect((await ocupacion(db, disponible, momentos.antes))!.estado).toBe("COMPLETO");
    // Con el reloj después del vencimiento, la clase guardada COMPLETO solo
    // está llena por una reserva vencida sin marcar: se muestra y se guarda DISPONIBLE.
    expect((await ocupacion(db, disponible, momentos.despues))!).toMatchObject({ estadoGuardado: "COMPLETO", estado: "DISPONIBLE", inscriptos: 2 });
    await expect(recalcular(momentos.despues)).resolves.toEqual({ anterior: "COMPLETO", nuevo: "DISPONIBLE", cambio: true });
  });

  it("no cambia el estado de una clase CANCELADO ni PENDIENTE", async () => {
    const pendiente = (await crearTurnoDePrueba(db, { estado: "PENDIENTE", cupo: 1 })).idTurno;
    for (const turnoId of [cancelada, pendiente]) {
      const antes = await db.turno.findUniqueOrThrow({ where: { idTurno: turnoId } });
      const resultado = await transaccion((tx) => recalcularEstadoTurno(tx, turnoId, momentos.antes), { db });
      expect(resultado).toEqual({ anterior: antes.estadoTurno, nuevo: antes.estadoTurno, cambio: false });
    }
  });

  it("las fábricas respetan los CHECK: el pago deja la inscripción PAGADA y sin vencimiento", async () => {
    const pagada = await db.turnoAlumno.findFirstOrThrow({ where: { turnoId: disponible, estadoPago: "PAGADA" }, include: { pagos: true } });
    expect(pagada).toMatchObject({ venceEl: null, venceBaseEl: null });
    expect(pagada.pagos).toHaveLength(1);
    expect(pagada.pagos[0]!.precio).toBe(pagada.precio);
  });
});
