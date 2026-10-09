import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import {
  abrirCajaDePrueba,
  crearAlumnoDePrueba,
  crearFichaGerenteDePrueba,
  crearFichaMesaEntradaDePrueba,
  crearInscripcionDePrueba,
  crearOperacionDePrueba,
  crearTurnoDePrueba,
} from "@/server/testing/fabricas";
import { bloquear, ErrorDeBloqueo } from "@/server/shared/bloquear";
import { transaccion } from "@/server/shared/transaccion";
import { PROCESO_AUTOMATICO, encolarHistorial, prepararHistorial, registrarHistorial } from "@/server/shared/historial";

// PostgreSQL real (base descartable, `npm run test:pg`): bloquear() toma los
// bloqueos en el orden canónico de PR-0.md §2.10 y transaccion() traduce las
// esperas y los interbloqueos a TRANSACCION_OCUPADA.
describe.skipIf(!basePgHabilitada)("bloquear() y transaccion() con PostgreSQL real", () => {
  let db: PrismaClient;
  let otro: PrismaClient;
  const consultas: string[] = [];
  const ids = {} as {
    aula: string; materia: string; profesor: string; alumno: string; fichaMesa: string; fichasGerente: string[];
    clases: string[]; inscripcion: string; operacion: string; caja: string;
  };

  beforeAll(async () => {
    db = clientePg({ log: [{ emit: "event", level: "query" }] });
    db.$on("query", (evento) => consultas.push(evento.query));
    otro = clientePg();
    const turno = await crearTurnoDePrueba(db);
    const turno2 = await crearTurnoDePrueba(db, { hora: "14:00" });
    const alumno = await crearAlumnoDePrueba(db);
    const inscripcion = await crearInscripcionDePrueba(db, { turnoId: turno.idTurno, alumnoId: alumno.idAlumno });
    const caja = await abrirCajaDePrueba(db);
    const { operacion } = await crearOperacionDePrueba(db, { cajaId: caja.idCaja, inscripcionIds: [inscripcion.idInscripcion] });
    Object.assign(ids, {
      aula: turno.aulaId!, materia: turno.materiaId, profesor: turno.profesorId!, alumno: alumno.idAlumno,
      fichaMesa: (await crearFichaMesaEntradaDePrueba(db)).idFichaMesaEntrada,
      fichasGerente: [(await crearFichaGerenteDePrueba(db)).idFichaGerente, (await crearFichaGerenteDePrueba(db)).idFichaGerente],
      clases: [turno.idTurno, turno2.idTurno], inscripcion: inscripcion.idInscripcion,
      operacion: operacion.idOperacionPago, caja: caja.idCaja,
    });
  });

  afterAll(async () => {
    await db?.$disconnect();
    await otro?.$disconnect();
  });

  /** Intenta tomar la fila desde otra conexión sin esperar: falla si está bloqueada. */
  async function estaBloqueada(tabla: string, columna: string, id: string) {
    try {
      await otro.$transaction(async (tx) => {
        await tx.$queryRawUnsafe(`SELECT 1 FROM "${tabla}" WHERE "${columna}" = $1 FOR UPDATE NOWAIT`, id);
      });
      return false;
    } catch {
      return true;
    }
  }

  it("toma recurso → clase → inscripción → operación → caja, por id ascendente, y las filas quedan bloqueadas", async () => {
    consultas.length = 0;
    await transaccion(async (tx) => {
      await bloquear(tx, {
        cajas: [ids.caja], operaciones: [ids.operacion], inscripciones: [ids.inscripcion],
        clases: [...ids.clases].reverse(),
        recursos: {
          fichasGerente: [...ids.fichasGerente].reverse(), fichasMesaEntrada: [ids.fichaMesa], alumnos: [ids.alumno],
          profesores: [ids.profesor], materias: [ids.materia], aulas: [ids.aula],
        },
      });
      expect(await estaBloqueada("turnos", "idTurno", ids.clases[0]!)).toBe(true);
      expect(await estaBloqueada("fichas_gerente", "idFichaGerente", ids.fichasGerente[1]!)).toBe(true);
      expect(await estaBloqueada("cajas", "idCaja", ids.caja)).toBe(true);
    }, { db });
    const tablas = consultas.filter((sql) => sql.includes("FOR UPDATE")).map((sql) => sql.match(/FROM "([^"]+)"/)![1]);
    expect(tablas).toEqual([
      "aulas", "materias", "profesores", "alumnos", "fichas_mesa_entrada", "fichas_gerente",
      "turnos", "turno_alumno", "operaciones_pago", "cajas",
    ]);
    expect(await estaBloqueada("cajas", "idCaja", ids.caja)).toBe(false);
  });

  it("pedir un nivel anterior al ya tomado lanza ErrorDeBloqueo y la transacción se deshace", async () => {
    await expect(transaccion(async (tx) => {
      await bloquear(tx, { clases: [ids.clases[0]!] });
      await bloquear(tx, { recursos: { alumnos: [ids.alumno] } });
    }, { db })).rejects.toBeInstanceOf(ErrorDeBloqueo);
  });

  it("el conjunto de formas de pago se bloquea solo y entero", async () => {
    await transaccion(async (tx) => {
      const { formasPago } = await bloquear(tx, { formasPago: true });
      expect(formasPago).toContain("formapago-efectivo");
      expect(await estaBloqueada("formas_pago", "idFormaPago", "formapago-efectivo")).toBe(true);
      await expect(bloquear(tx, { clases: [ids.clases[0]!] })).rejects.toBeInstanceOf(ErrorDeBloqueo);
    }, { db });
  });

  it("dos operaciones que piden las mismas clases en distinto orden no se interbloquean", async () => {
    const operacion = (orden: string[]) => transaccion(async (tx) => {
      await bloquear(tx, { clases: orden });
      await tx.$executeRawUnsafe("SELECT pg_sleep(0.3)");
      return "ok";
    }, { db });
    await expect(Promise.all([operacion([...ids.clases]), operacion([...ids.clases].reverse())])).resolves.toEqual(["ok", "ok"]);
  });

  it("sin el orden canónico se interbloquean: PostgreSQL corta una y se informa TRANSACCION_OCUPADA", async () => {
    const [a, b] = ids.clases as [string, string];
    const aMano = (primero: string, segundo: string) => transaccion(async (tx) => {
      await tx.$queryRawUnsafe('SELECT 1 FROM "turnos" WHERE "idTurno" = $1 FOR UPDATE', primero);
      await tx.$executeRawUnsafe("SELECT pg_sleep(0.3)");
      await tx.$queryRawUnsafe('SELECT 1 FROM "turnos" WHERE "idTurno" = $1 FOR UPDATE', segundo);
    }, { db });
    const resultados = await Promise.allSettled([aMano(a, b), aMano(b, a)]);
    const rechazos = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rechazos).toHaveLength(1);
    expect(rechazos[0]!.reason).toMatchObject({ code: "TRANSACCION_OCUPADA", status: 409 });
  });

  it("una espera de bloqueo que supera lock_timeout se informa TRANSACCION_OCUPADA", async () => {
    const tomada = transaccion(async (tx) => {
      await bloquear(tx, { cajas: [ids.caja] });
      await tx.$executeRawUnsafe("SELECT pg_sleep(1.2)");
    }, { db });
    await new Promise((resolver) => setTimeout(resolver, 200));
    await expect(transaccion(async (tx) => {
      await bloquear(tx, { cajas: [ids.caja] });
    }, { db, tiempos: { lockTimeoutMs: 300 } })).rejects.toMatchObject({ code: "TRANSACCION_OCUPADA" });
    await tomada;
  });

  it("despuesDelCommit escribe el historial solo si confirma, y repetir el mismo registro no lo duplica", async () => {
    const datos = {
      tipo: "INSCRIPCION" as const, inscripcionId: ids.inscripcion,
      vigenciaAnterior: null, vigenciaNueva: "VIGENTE" as const,
      estadoPagoAnterior: null, estadoPagoNuevo: "PAGO_SIN_REGISTRAR" as const,
      actor: PROCESO_AUTOMATICO, fecha: new Date(),
    };
    let confirmado = "";
    await transaccion(async (tx) => { confirmado = encolarHistorial(tx, datos, { db }).id; }, { db });
    let revertido = "";
    await expect(transaccion(async (tx) => {
      revertido = encolarHistorial(tx, datos, { db }).id;
      throw new Error("revierte");
    }, { db })).rejects.toThrow("revierte");
    expect(await db.historialInscripcion.count({ where: { idHistorialInscripcion: confirmado } })).toBe(1);
    expect(await db.historialInscripcion.count({ where: { idHistorialInscripcion: revertido } })).toBe(0);

    const registro = prepararHistorial(datos);
    await registrarHistorial(registro, { db });
    await registrarHistorial(registro, { db });
    expect(await db.historialInscripcion.count({ where: { idHistorialInscripcion: registro.id } })).toBe(1);
  });
});
