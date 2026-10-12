import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";
import { crearAlumnoDePrueba, crearMateriaDePrueba, crearTurnoDePrueba, crearFichaGerenteDePrueba, crearFichaMesaEntradaDePrueba, unico } from "@/server/testing/fabricas";
import { cambiarTarifasMasivo, listarMateriasConTarifa } from "@/server/materias/materia.service";
import { transaccion } from "@/server/shared/transaccion";
import { actorUsuario } from "@/server/shared/historial";
import { crearInscripcion } from "@/server/turnos/inscripcion.publico";
import { registrarOperacion } from "@/server/pagos/operacion.service";
import { abrirCaja } from "@/server/pagos/caja.service";
import { conReloj, ahora } from "@/server/shared/reloj";

function senal() {
  let resolver!: () => void;
  const promesa = new Promise<void>((resolve) => { resolver = resolve; });
  return { promesa, resolver };
}

describe.skipIf(!basePgHabilitada)("HU-L-07: PostgreSQL descartable", () => {
  let db: PrismaClient;
  let gerente: string;
  beforeAll(async () => { db = clientePg(); gerente = (await crearFichaGerenteDePrueba(db)).usuarioId!; });
  afterAll(async () => { await db?.$disconnect(); });
  const lote = (filas: { idMateria: string; tarifaHoraMateria: number | null }[], tarifa_hora = 15000) => ({ tarifa_hora, materias: filas.map((fila) => ({ id: fila.idMateria, tarifa_actual: fila.tarifaHoraMateria })) });
  const estado = async (ids: string[]) => ({
    materias: await db.materia.findMany({ where: { idMateria: { in: ids } }, orderBy: { idMateria: "asc" } }),
    historial: await db.historialTarifa.findMany({ where: { materiaId: { in: ids } }, orderBy: { idHistorialTarifa: "asc" } }),
  });

  it("permiso real de las migraciones autoriza solo GERENTE para ambas rutas", async () => {
    const permisos = await db.rolPermiso.findMany({ where: { accionPermiso: "materias:cambiar_tarifa" }, select: { rolPermiso: true } });
    expect(permisos).toEqual([{ rolPermiso: "GERENTE" }]);
  });

  it("mezcla null/sin cambio: fecha común, marca masiva y metadata intacta para sin cambio", async () => {
    const filas = await Promise.all([null, 12000, 15000].map((tarifaHora) => crearMateriaDePrueba(db, { tarifaHora })));
    const fecha = new Date("2026-10-11T12:00:00.123Z");
    expect(await conReloj(fecha, () => cambiarTarifasMasivo(lote(filas), gerente, { db }))).toEqual({ tarifa_hora: 15000, actualizadas: 2, sin_cambio: 1 });
    const despues = await estado(filas.map((f) => f.idMateria));
    expect(despues.historial).toHaveLength(2);
    for (const h of despues.historial) expect(h).toMatchObject({ tarifaNueva: 15000, usuarioId: gerente, masivo: true, fecha });
    expect(despues.historial.map((h) => h.tarifaAnterior).sort()).toEqual([12000, null]);
    for (const f of filas.slice(0, 2)) expect(despues.materias.find((m) => m.idMateria === f.idMateria)).toMatchObject({ tarifaHoraMateria: 15000, version: f.version, modificadoPorUsuarioId: gerente });
    expect(despues.materias.find((m) => m.idMateria === filas[2].idMateria)).toEqual(filas[2]);
    const antesNoop = await estado(filas.map((f) => f.idMateria));
    expect(await cambiarTarifasMasivo(lote(antesNoop.materias), gerente, { db })).toEqual({ tarifa_hora: 15000, actualizadas: 0, sin_cambio: 3 });
    expect(await estado(filas.map((f) => f.idMateria))).toEqual(antesNoop);
  });
  describe("materias sin tarifa (null) frente a la guarda de la tarifa mostrada", () => {
    it("tarifa_actual null sobre una materia sin tarifa la define y deja historial con tarifaAnterior null", async () => {
      const sinTarifa = await crearMateriaDePrueba(db, { tarifaHora: null });
      const fecha = new Date("2026-10-11T13:00:00.000Z");
      expect(await conReloj(fecha, () => cambiarTarifasMasivo(lote([sinTarifa]), gerente, { db }))).toEqual({ tarifa_hora: 15000, actualizadas: 1, sin_cambio: 0 });
      const despues = await estado([sinTarifa.idMateria]);
      expect(despues.materias[0]).toMatchObject({ tarifaHoraMateria: 15000, modificadoPorUsuarioId: gerente });
      expect(despues.historial).toHaveLength(1);
      expect(despues.historial[0]).toMatchObject({ tarifaAnterior: null, tarifaNueva: 15000, usuarioId: gerente, masivo: true, fecha });
    });
    it("tarifa_actual distinta de null sobre una materia sin tarifa es conflicto y no escribe", async () => {
      const sinTarifa = await crearMateriaDePrueba(db, { tarifaHora: null });
      const antes = await estado([sinTarifa.idMateria]);
      await expect(cambiarTarifasMasivo({ tarifa_hora: 15000, materias: [{ id: sinTarifa.idMateria, tarifa_actual: 12000 }] }, gerente, { db }))
        .rejects.toMatchObject({ code: "CONFLICTO_EDICION_CONCURRENTE" });
      expect(await estado([sinTarifa.idMateria])).toEqual(antes);
    });
    it("tarifa_actual null sobre una materia que ya tiene tarifa es conflicto y no escribe", async () => {
      const conTarifa = await crearMateriaDePrueba(db, { tarifaHora: 12000 });
      const antes = await estado([conTarifa.idMateria]);
      await expect(cambiarTarifasMasivo({ tarifa_hora: 15000, materias: [{ id: conTarifa.idMateria, tarifa_actual: null }] }, gerente, { db }))
        .rejects.toMatchObject({ code: "CONFLICTO_EDICION_CONCURRENTE" });
      expect(await estado([conTarifa.idMateria])).toEqual(antes);
    });
    it("un pedido con materias con y sin tarifa cambia todas las que difieren y una sola guarda desactualizada anula el pedido completo", async () => {
      const filas = await Promise.all([null, 12000, 15000].map((tarifaHora) => crearMateriaDePrueba(db, { tarifaHora })));
      const ids = filas.map((f) => f.idMateria);
      const antes = await estado(ids);
      const desactualizado = lote(filas);
      desactualizado.materias[0].tarifa_actual = 9000; // la materia sin tarifa se mostró con un valor que ya no es el real
      await expect(cambiarTarifasMasivo(desactualizado, gerente, { db })).rejects.toMatchObject({ code: "CONFLICTO_EDICION_CONCURRENTE" });
      expect(await estado(ids)).toEqual(antes);
      expect(await cambiarTarifasMasivo(lote(filas), gerente, { db })).toEqual({ tarifa_hora: 15000, actualizadas: 2, sin_cambio: 1 });
      const despues = await estado(ids);
      expect(despues.materias.map((m) => m.tarifaHoraMateria)).toEqual(ids.map(() => 15000));
      expect(despues.historial.map((h) => h.materiaId).sort()).toEqual([ids[0], ids[1]].sort());
      expect(despues.historial.find((h) => h.materiaId === ids[0])!.tarifaAnterior).toBeNull();
      expect(despues.historial.find((h) => h.materiaId === ids[1])!.tarifaAnterior).toBe(12000);
    });
  });
  it.each(["faltante", "inactiva", "conflicto"] as const)("rechazo %s no escribe ninguna fila ni historial", async (caso) => {
    const filas = await Promise.all([12000, 15000].map((tarifaHora) => crearMateriaDePrueba(db, { tarifaHora })));
    const input = lote(filas);
    if (caso === "faltante") input.materias.push({ id: "cm000000000000000000000099", tarifa_actual: null });
    if (caso === "inactiva") await db.materia.update({ where: { idMateria: filas[1].idMateria }, data: { activaMateria: false } });
    if (caso === "conflicto") await db.materia.update({ where: { idMateria: filas[1].idMateria }, data: { tarifaHoraMateria: 18000 } });
    const ids = filas.map((f) => f.idMateria); const antes = await estado(ids);
    await expect(cambiarTarifasMasivo(input, gerente, { db })).rejects.toMatchObject({ code: caso === "faltante" ? "MATERIA_NO_ENCONTRADA" : caso === "inactiva" ? "MATERIA_INACTIVA" : "CONFLICTO_EDICION_CONCURRENTE" });
    expect(await estado(ids)).toEqual(antes);
    if (caso === "inactiva") expect((await listarMateriasConTarifa(db)).some((m) => m.id === filas[1].idMateria)).toBe(false);
  });
  it("fallo después del primer historial insertado revierte ambas tarifas e historiales", async () => {
    const filas = await Promise.all([0, 1].map(() => crearMateriaDePrueba(db)));
    const ids = filas.map((f) => f.idMateria); const antes = await estado(ids);
    let inserciones = 0;
    const fallando = db.$extends({ query: { historialTarifa: { create: async ({ args, query }) => {
      inserciones += 1;
      if (inserciones === 2) throw new Error("segundo historial falló");
      return query(args);
    } } } });
    await expect(cambiarTarifasMasivo(lote(filas), gerente, { db: fallando as unknown as PrismaClient })).rejects.toThrow("segundo historial falló");
    expect(inserciones).toBe(2); expect(await estado(ids)).toEqual(antes);
  });
  it.each([false, true])("dos cambios masivos con los mismos ids en orden cruzado se serializan: gana el que retiene los bloqueos y el otro recibe CONFLICTO_EDICION_CONCURRENTE (inverso=%s)", async (inverso) => {
    const filas = await Promise.all([0, 1].map(() => crearMateriaDePrueba(db)));
    const bloqueado = senal(); const liberar = senal(); const segundoIniciado = senal();
    // findMany se ejecuta después del FOR UPDATE: el primero retiene ambos locks y el segundo espera
    // en su propio bloqueo; al liberarse relee la tarifa nueva y su guarda la rechaza. Prueba la
    // serialización de dos lotes con ids invertidos, no el orden interno de adquisición de bloqueos.
    const primeroDb = db.$extends({ query: { materia: { findMany: async ({ args, query }) => {
      bloqueado.resolver(); await liberar.promesa; return query(args);
    } } } });
    const segundoDb = db.$extends({ query: { $queryRawUnsafe: async ({ args, query }) => {
      segundoIniciado.resolver(); return query(args);
    } } });
    const primerOrden = inverso ? [...filas].reverse() : filas;
    const primero = cambiarTarifasMasivo(lote(primerOrden), gerente, { db: primeroDb as unknown as PrismaClient });
    await bloqueado.promesa;
    const segundo = cambiarTarifasMasivo(lote([...primerOrden].reverse(), 18000), gerente, { db: segundoDb as unknown as PrismaClient });
    const resultados = Promise.allSettled([primero, segundo]);
    await segundoIniciado.promesa; liberar.resolver();
    expect(await resultados).toMatchObject([{ status: "fulfilled", value: { actualizadas: 2 } }, { status: "rejected", reason: { code: "CONFLICTO_EDICION_CONCURRENTE" } }]);
    const despues = await estado(filas.map((f) => f.idMateria));
    expect(despues.historial).toHaveLength(2); expect(despues.materias.every((f) => f.tarifaHoraMateria === 15000)).toBe(true);
  });
  it("precio congelado al cobrar; nuevas reservas, centro y pago directo toman tarifa masiva", async () => {
    const materia = await crearMateriaDePrueba(db);
    const clase = await crearTurnoDePrueba(db, { materiaId: materia.idMateria });
    const mesa = (await crearFichaMesaEntradaDePrueba(db)).usuarioId!;
    await transaccion((tx) => abrirCaja(tx, { usuarioId: mesa, fondoInicial: "0" }), { db });
    const nombreForma = unico("Efectivo L07 ");
    const forma = await db.formaPago.create({ data: { nombreFormaPago: nombreForma, nombreNormalizadaFormaPago: nombreForma.toLowerCase(), esEfectivo: true } });
    const inscribir = async (origen: "ALUMNO" | "CENTRO") => {
      const alumno = await crearAlumnoDePrueba(db);
      return { alumno, resultado: await transaccion((tx) => crearInscripcion(tx, { turnoId: clase.idTurno, alumnoId: alumno.idAlumno, origen, conReserva: true, actor: actorUsuario(mesa) }), { db }) };
    };
    const anterior = await inscribir("ALUMNO");
    const reingreso = await conReloj(new Date(ahora().getTime() - 48 * 3600000), () => inscribir("ALUMNO"));
    const filaAnterior = await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: anterior.resultado.inscripcion.id } });
    await cambiarTarifasMasivo(lote([materia]), gerente, { db });
    expect(await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: anterior.resultado.inscripcion.id } })).toEqual(filaAnterior);
    const cobro = await transaccion((tx) => registrarOperacion(tx, { alumnoId: anterior.alumno.idAlumno, usuarioId: mesa, modo: "completo", formaPagoId: forma.idFormaPago,
      items: [{ inscripcionId: anterior.resultado.inscripcion.id, monto: "12000" }],
    }), { db });
    expect(cobro.pagos[0].precio).toBe(12000);
    expect((await db.turnoAlumno.findUniqueOrThrow({ where: { idInscripcion: filaAnterior.idInscripcion } })).precio).toBe(12000);
    for (const origen of ["ALUMNO", "CENTRO"] as const) expect((await inscribir(origen)).resultado.inscripcion.precio).toBe(15000);
    const pago = await transaccion((tx) => registrarOperacion(tx, { alumnoId: reingreso.alumno.idAlumno, usuarioId: mesa, modo: "completo", formaPagoId: forma.idFormaPago,
      items: [{ crearInscripcion: { turnoId: clase.idTurno }, monto: "15000" }],
    }), { db });
    expect(pago.pagos[0].precio).toBe(15000);
  });
});
