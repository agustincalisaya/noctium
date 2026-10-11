import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearMateriaDePrueba, crearTurnoDePrueba, crearFichaGerenteDePrueba, crearFichaMesaEntradaDePrueba, unico } from "@/server/testing/fabricas";
import { cambiarTarifaMateria, obtenerMateriaPorId } from "@/server/materias/materia.service";
import { transaccion } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import { crearInscripcion } from "@/server/turnos/inscripcion.publico";
import { registrarOperacion } from "@/server/pagos/operacion.service";
import { conReloj, ahora } from "@/server/shared/reloj";
import { abrirCaja } from "@/server/pagos/caja.service";

describe.skipIf(!basePgHabilitada)("HU-L-06: PostgreSQL descartable", () => {
  let db: PrismaClient;
  let gerente: string;
  beforeAll(async () => { db = clientePg(); gerente = (await crearFichaGerenteDePrueba(db)).usuarioId!; });
  afterAll(async () => { await db?.$disconnect(); });
  it("define tarifa null, registra historial y conserva versión de nombre/código", async () => {
    const m = await crearMateriaDePrueba(db, { tarifaHora: null });
    await cambiarTarifaMateria(m.idMateria, { tarifa_hora: 15000, tarifa_actual: null }, gerente, { db });
    const fila = await db.materia.findUniqueOrThrow({ where: { idMateria: m.idMateria } });
    expect(fila).toMatchObject({ tarifaHoraMateria: 15000, modificadoPorUsuarioId: gerente, version: m.version });
    const historial = await db.historialTarifa.findMany({ where: { materiaId: m.idMateria } });
    expect(historial).toHaveLength(1);
    expect(historial[0]).toMatchObject({ tarifaAnterior: null, tarifaNueva: 15000, usuarioId: gerente, masivo: false });
    expect((await obtenerMateriaPorId(m.idMateria, { conTarifa: true })).historial_tarifas?.[0].usuario.nombre).toContain("Gerente");
  });
  it("dos cambios simultáneos y reintento no duplican historial", async () => {
    const m = await crearMateriaDePrueba(db);
    const resultados = await Promise.allSettled([15000, 18000].map((tarifa_hora) => cambiarTarifaMateria(m.idMateria, { tarifa_hora, tarifa_actual: 12000 }, gerente, { db })));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "CONFLICTO_EDICION_CONCURRENTE" } });
    const actual = await db.materia.findUniqueOrThrow({ where: { idMateria: m.idMateria } });
    await expect(cambiarTarifaMateria(m.idMateria, { tarifa_hora: actual.tarifaHoraMateria!, tarifa_actual: 12000 }, gerente, { db })).rejects.toMatchObject({ code: "CONFLICTO_EDICION_CONCURRENTE" });
    expect(await db.historialTarifa.count({ where: { materiaId: m.idMateria } })).toBe(1);
  });
  it("si falla la inserción del historial revierte también la tarifa", async () => {
    const m = await crearMateriaDePrueba(db);
    // Falla inyectada solo en la segunda escritura; la transacción y rollback son reales.
    const fallando = db.$extends({ query: { historialTarifa: { create: async () => { throw new Error("fallo de historial simulado"); } } } });
    await expect(cambiarTarifaMateria(m.idMateria, { tarifa_hora: 15000, tarifa_actual: 12000 }, gerente, { db: fallando as unknown as PrismaClient })).rejects.toThrow("fallo de historial simulado");
    expect((await db.materia.findUniqueOrThrow({ where: { idMateria: m.idMateria } })).tarifaHoraMateria).toBe(12000);
    expect(await db.historialTarifa.count({ where: { materiaId: m.idMateria } })).toBe(0);
  });
  it("precio anterior al cobrar; nuevas reservas, inscripción centro y pago directo usan nueva tarifa", async () => {
    const m = await crearMateriaDePrueba(db);
    const clase = await crearTurnoDePrueba(db, { materiaId: m.idMateria });
    const mesa = (await crearFichaMesaEntradaDePrueba(db)).usuarioId!;
    await transaccion((tx) => abrirCaja(tx, { usuarioId: mesa, fondoInicial: "0" }), { db });
    const nombreForma = unico("Efectivo L06 ");
    const forma = await db.formaPago.create({ data: { nombreFormaPago: nombreForma, nombreNormalizadaFormaPago: nombreForma.toLowerCase(), esEfectivo: true } });
    const inscribir = async (origen: "ALUMNO" | "CENTRO") => {
      const alumno = await crearAlumnoDePrueba(db);
      return { alumno, resultado: await transaccion((tx) => crearInscripcion(tx, { turnoId: clase.idTurno, alumnoId: alumno.idAlumno, origen, conReserva: true, actor: actorUsuario(mesa) }), { db }) };
    };
    const anterior = await inscribir("ALUMNO");
    expect(anterior.resultado.inscripcion.precio).toBe(12000);
    // I-10 solo crea al cobrar cuando hubo una reserva vencida/cancelada sin pago.
    // Crear esa reserva por servicio con reloj anterior, sin falsear filas de inscripción.
    const reingreso = await conReloj(new Date(ahora().getTime() - 48 * 3600000), () => inscribir("ALUMNO"));
    expect(reingreso.resultado.inscripcion.precio).toBe(12000);
    await cambiarTarifaMateria(m.idMateria, { tarifa_hora: 15000, tarifa_actual: 12000 }, gerente, { db });
    const cobro = await transaccion((tx) => registrarOperacion(tx, { alumnoId: anterior.alumno.idAlumno, usuarioId: mesa, modo: "completo", formaPagoId: forma.idFormaPago,
      items: [{ inscripcionId: anterior.resultado.inscripcion.id, monto: "12000" }],
    }), { db });
    expect(cobro.pagos[0].precio).toBe(12000);
    expect((await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: anterior.resultado.inscripcion.id } })).precio).toBe(12000);
    for (const origen of ["ALUMNO", "CENTRO"] as const) expect((await inscribir(origen)).resultado.inscripcion.precio).toBe(15000);
    const alumno = reingreso.alumno;
    const pago = await transaccion((tx) => registrarOperacion(tx, { alumnoId: alumno.idAlumno, usuarioId: mesa, modo: "completo", formaPagoId: forma.idFormaPago,
      items: [{ crearInscripcion: { turnoId: clase.idTurno }, monto: "15000" }],
    }), { db });
    expect(pago.pagos[0].precio).toBe(15000);
  });
  it("seed oficial completo repetido conserva tarifa cambiada e historial", async () => {
    const seed = () => execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], {
      env: { ...process.env, SEED_SOLO_VALIDAR: "0", SEED_FECHA_HOY: "2026-10-11" }, encoding: "utf8", timeout: 120000,
    });
    seed();
    const m = await db.materia.findFirstOrThrow({ where: { nombreMateria: "Matemática" } });
    const actor = await db.usuario.findUniqueOrThrow({ where: { emailUsuario: "gerente@noctium.local" } });
    await cambiarTarifaMateria(m.idMateria, { tarifa_hora: 15000, tarifa_actual: m.tarifaHoraMateria }, actor.idUsuario, { db });
    const historial = await db.historialTarifa.findMany({ where: { materiaId: m.idMateria } });
    seed();
    expect((await db.materia.findUniqueOrThrow({ where: { idMateria: m.idMateria } })).tarifaHoraMateria).toBe(15000);
    expect(await db.historialTarifa.findMany({ where: { materiaId: m.idMateria } })).toEqual(historial);
  }, 240000);
});
