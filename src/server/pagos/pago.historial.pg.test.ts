import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { registrarOperacionDePago, listarHistorialDePagos, obtenerOpcionesHistorialPagos } from "@/server/pagos/pago.service";
import { corregirPago, anularPago } from "@/server/pagos/correccion.service";
import { conReloj } from "@/server/shared/reloj";
import { transaccion } from "@/server/shared/transaccion";
import { abrirCajaDePrueba, crearFichaMesaEntradaDePrueba } from "@/server/testing/fabricas";

const url = process.env.DATABASE_URL;
const habilitada = Boolean(url && process.env.HU_PR0_TEST_DATABASE_URL === url &&
  new URL(url).hostname === "127.0.0.1" && new URL(url).port === "55434");
const db = habilitada ? new PrismaClient() : null;
const momento = new Date("2026-10-13T15:00:00.000Z");
const prefijo = `hui02${randomUUID().replaceAll("-", "").slice(0, 14)}`;
let alumnoId: string;
let autor: string;
let formaId: string;
let materiaId: string;
let pagosIds: string[];
let inscripcionesIds: string[];
const usuario = () => ({ id: autor, rol: "MESA_ENTRADA" as const, puedeCrearPago: true });
const query = (extra: Record<string, unknown> = {}) => ({
  alumno_id: alumnoId, pagina: 1, ...extra,
}) as Parameters<typeof listarHistorialDePagos>[0];

describe.skipIf(!habilitada)("HU-I-02 PostgreSQL descartable en noctium_i02_pg", () => {
  beforeAll(async () => {
    autor = (await crearFichaMesaEntradaDePrueba(db!)).usuarioId!;
    await abrirCajaDePrueba(db!, { usuarioId: autor });
    const materia = await db!.materia.create({ data: { nombreMateria: prefijo, nombreNormalizadaMateria: prefijo } });
    materiaId = materia.idMateria;
    const alumno = await db!.alumno.create({ data: {
      nombreAlumno: "Lara", apellidoAlumno: prefijo, nombreNormalizadoAlumno: "lara",
      apellidoNormalizadoAlumno: prefijo, dniAlumno: prefijo, fechaNacimientoAlumno: new Date("2005-01-01"),
      activoAlumno: true,
    } });
    alumnoId = alumno.idAlumno;
    const forma = await db!.formaPago.create({ data: { nombreFormaPago: prefijo, nombreNormalizadaFormaPago: prefijo } });
    formaId = forma.idFormaPago;
    const inscripciones = [];
    for (let n = 0; n < 3; n++) {
      const turno = await db!.turno.create({ data: {
        materiaId, fechaTurno: new Date(`2026-10-${14 + n}T00:00:00Z`),
        horaInicioTurno: new Date("1970-01-01T16:00:00Z"), duracionMinutosTurno: 60,
        estadoTurno: "DISPONIBLE", cupoMaximoTurno: 1,
        alumnos: { create: { alumnoId, estadoPago: "PAGO_SIN_REGISTRAR", precio: 100, reservadaEl: momento } },
      }, include: { alumnos: true } });
      inscripciones.push(turno.alumnos[0]!.idInscripcion);
    }
    inscripcionesIds = inscripciones;
    const operacion = await conReloj(momento, () => registrarOperacionDePago({
      alumno_id: alumnoId,
      items: inscripcionesIds.map((inscripcion_id, i) => ({ inscripcion_id, monto: i === 1 ? "90.00" : "100.00",
        ...(i === 1 ? { motivo_ajuste: "Beca" } : {}) })),
      forma_pago_id: formaId,
    }, autor));
    pagosIds = operacion.pagos.map((p) => p.id);
  });
  afterAll(async () => db?.$disconnect());

  it("lee precios congelados y total decimal exacto sin modificar tablas", async () => {
    const antes = {
      pagos: await db!.pago.findMany({ where: { idPago: { in: pagosIds } } }),
      inscripciones: await db!.turnoAlumno.findMany({ where: { idInscripcion: { in: inscripcionesIds } } }),
      cajas: await db!.caja.findMany({ where: { usuarioId: autor } }),
    };
    const resultado = await conReloj(momento, () => listarHistorialDePagos(query(), usuario()));
    expect(resultado).toMatchObject({ modo: "HISTORIAL", total_pagado: "290.00",
      paginacion: { total: 3, pagina_actual: 1, por_pagina: 10 } });
    if (resultado.modo !== "HISTORIAL") throw new Error("modo");
    expect(resultado.items.every((p) => p.precio === 100 && p.comprobante !== null)).toBe(true);
    expect(await db!.pago.findMany({ where: { idPago: { in: pagosIds } } })).toEqual(antes.pagos);
    expect(await db!.turnoAlumno.findMany({ where: { idInscripcion: { in: inscripcionesIds } } })).toEqual(antes.inscripciones);
    expect(await db!.caja.findMany({ where: { usuarioId: autor } })).toEqual(antes.cajas);
  });
  it("aplica corrección y anulación compensatorias, conserva originales y suma vigentes", async () => {
    await conReloj(momento, () => transaccion((tx) => corregirPago(tx, {
      pagoId: pagosIds[0]!, monto: "101.01", motivo: "Ajuste de prueba", usuario: usuario(),
    })));
    await conReloj(momento, () => transaccion((tx) => anularPago(tx, {
      pagoId: pagosIds[2]!, motivo: "Anulación de prueba", usuario: usuario(),
    })));
    const resultado = await conReloj(momento, () => listarHistorialDePagos(query(), usuario()));
    expect(resultado).toMatchObject({ modo: "HISTORIAL", total_pagado: "191.01" });
    if (resultado.modo !== "HISTORIAL") throw new Error("modo");
    expect(resultado.items.find((p) => p.pago_id === pagosIds[0])).toMatchObject({
      monto: "101.01", monto_original: "100.00", ajuste: null, cambios: 1,
    });
    expect(resultado.items.find((p) => p.pago_id === pagosIds[1])).toMatchObject({ ajuste: { motivo: "Beca" }, precio: 100, monto: "90.00" });
    expect(resultado.items.find((p) => p.pago_id === pagosIds[2])).toMatchObject({ anulado: true });
    const sql = await db!.$queryRaw<{ idPago: string; original: Prisma.Decimal; vigente: Prisma.Decimal; anulado: boolean }[]>`
      SELECT p."idPago", p."montoPago" AS original,
        COALESCE((SELECT c."montoNuevo" FROM "correcciones_pago" c WHERE c."pagoId" = p."idPago"
          ORDER BY c."createdAtCorreccionPago" DESC, c."idCorreccionPago" DESC LIMIT 1), p."montoPago") AS vigente,
        EXISTS(SELECT 1 FROM "anulaciones_pago" a WHERE a."pagoId" = p."idPago") AS anulado
      FROM "pagos" p WHERE p."idPago" IN (${Prisma.join(pagosIds)})
      ORDER BY p."idPago"`;
    const porId = new Map(sql.map((p) => [p.idPago, {
      original: p.original.toFixed(2), vigente: p.vigente.toFixed(2), anulado: p.anulado,
    }]));
    expect(porId.get(pagosIds[0]!)).toEqual({ original: "100.00", vigente: "101.01", anulado: false });
    expect(porId.get(pagosIds[1]!)).toEqual({ original: "90.00", vigente: "90.00", anulado: false });
    expect(porId.get(pagosIds[2]!)).toEqual({ original: "100.00", vigente: "100.00", anulado: true });
    const originales = await db!.pago.findMany({ where: { idPago: { in: pagosIds } }, select: { montoPago: true } });
    expect(originales.map((p) => p.montoPago.toFixed(2))).toEqual(["100.00", "90.00", "100.00"]);
  });
  it("conserva pagos de una inscripción quitada y forma inactiva; opciones históricas", async () => {
    await db!.turnoAlumno.update({ where: { idInscripcion: inscripcionesIds[1] }, data: {
      vigencia: "QUITADA_CENTRO", finalizadaEl: momento, finalizadaPorActorTipo: "PROCESO_AUTOMATICO",
    } });
    await db!.formaPago.update({ where: { idFormaPago: formaId }, data: { activaFormaPago: false } });
    const resultado = await listarHistorialDePagos(query({ materia_id: materiaId, pagina: 99 }), usuario());
    expect(resultado).toMatchObject({ modo: "HISTORIAL", total_pagado: "191.01",
      paginacion: { total: 3, pagina_actual: 1 } });
    const opciones = await obtenerOpcionesHistorialPagos(alumnoId);
    expect(opciones).toMatchObject({ formas_pago: [{ id: formaId, is_active: false }],
      materias: [{ id: materiaId }] });
  });
  it("estado excluye inscripción quitada y preserva lectura sin filtro", async () => {
    const { listarInscripcionesDeAlumno } = await import("@/server/turnos/inscripcion.lecturas");
    const todas = await conReloj(momento, () => listarInscripcionesDeAlumno(alumnoId));
    expect(todas).toHaveLength(3);
    const pagadas = await conReloj(momento, () => listarHistorialDePagos(query({ estado_pago: "PAGADA" }), usuario()));
    expect(pagadas).toMatchObject({ modo: "ESTADO_DE_PAGO", paginacion: { total: 1 } });
    expect(pagadas).not.toHaveProperty("total_pagado");
  });
});
