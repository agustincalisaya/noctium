import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { listarMisPagos, obtenerOpcionesMisPagos, registrarOperacionDePago } from "@/server/pagos/pago.service";
import { MisPagosQuerySchema } from "@/server/pagos/pago.schema";
import { anularPago, corregirOperacion, corregirPago } from "@/server/pagos/correccion.service";
import { comprobanteDelPago, leerComprobanteDeAlumno } from "@/server/pagos/comprobante.lectura";
import { conReloj } from "@/server/shared/reloj";
import { transaccion } from "@/server/shared/transaccion";
import { abrirCajaDePrueba, crearAlumnoDePrueba, crearFichaMesaEntradaDePrueba, crearUsuarioDePrueba } from "@/server/testing/fabricas";
import { basePgHabilitada, clientePg } from "@/server/testing/pg";

// HU-I-05 (spec_modulo_I.md §2.15) con PostgreSQL real y descartable
// (`npm run test:pg`): cobros, corrección de monto, de fecha y forma, anulación
// parcial y total hechos con los servicios de dominio (HU-I-10/HU-I-06), dos
// alumnos en la misma clase y verificación de que la consulta no escribe nada.

const db: PrismaClient | null = basePgHabilitada ? clientePg() : null;
const momento = new Date("2026-10-13T15:00:00.000Z");
const prefijo = `i05${randomUUID().replaceAll("-", "").slice(0, 10)}`;
const q = (extra: Record<string, unknown> = {}) => MisPagosQuerySchema.parse(extra);
const MOTIVOS = { ajuste: `AJUSTE-SECRETO-${prefijo}`, parcial: `MOTIVO-PARCIAL-SECRETO-${prefijo}`, total: `MOTIVO-TOTAL-SECRETO-${prefijo}`, correccion: `CORRECCION-SECRETA-${prefijo}` };

let autor: string;
let usuarioA: string;
let usuarioB: string;
let usuarioSinFicha: string;
let usuarioSinPagos: string;
let alumnoA: string;
let materiaFis: { id: string; nombre: string };
let materiaAlg: { id: string; nombre: string };
let formaUno: string;
let formaDos: string;
/** Pagos de A por operación: op[0] tiene dos clases (Física, Álgebra); op[1..10] una cada una. */
const op: { pagos: string[]; comprobante: string }[] = [];
let pagoDeB: string;
let pagoDeBOtraClase: string;
const operador = () => ({ id: autor, rol: "MESA_ENTRADA" as const });

async function clase(materiaId: string, dia: number, alumnos: string[]) {
  const turno = await db!.turno.create({ data: {
    materiaId, fechaTurno: new Date(Date.UTC(2026, 9, dia)), horaInicioTurno: new Date("1970-01-01T16:00:00Z"),
    duracionMinutosTurno: 60, estadoTurno: "DISPONIBLE", cupoMaximoTurno: 5,
    alumnos: { create: alumnos.map((alumnoId) => ({ alumnoId, estadoPago: "PAGO_SIN_REGISTRAR" as const, precio: 100, reservadaEl: momento })) },
  }, include: { alumnos: true } });
  return Object.fromEntries(turno.alumnos.map((i) => [i.alumnoId, i.idInscripcion]));
}

async function cobrar(alumnoId: string, items: { inscripcion_id: string; monto: string }[], fecha: string, forma = formaUno) {
  return conReloj(momento, () => registrarOperacionDePago({
    alumno_id: alumnoId,
    items: items.map((i) => ({ ...i, ...(i.monto !== "100.00" ? { motivo_ajuste: MOTIVOS.ajuste } : {}) })),
    forma_pago_id: forma, fecha_pago: new Date(`${fecha}T00:00:00.000Z`),
  }, autor));
}

async function fotoDeTablas() {
  const [pagos, correcciones, correccionesOp, anulaciones, operaciones, comprobantes, inscripciones, cajas] = await Promise.all([
    db!.pago.findMany({ orderBy: { idPago: "asc" } }),
    db!.correccionPago.findMany({ orderBy: { idCorreccionPago: "asc" } }),
    db!.correccionOperacion.findMany({ orderBy: { idCorreccionOperacion: "asc" } }),
    db!.anulacionPago.findMany({ orderBy: { idAnulacionPago: "asc" } }),
    db!.operacionPago.findMany({ orderBy: { idOperacionPago: "asc" } }),
    db!.comprobante.findMany({ orderBy: { numero: "asc" } }),
    db!.turnoAlumno.findMany({ orderBy: { idInscripcion: "asc" } }),
    db!.caja.findMany({ orderBy: { idCaja: "asc" } }),
  ]);
  return { pagos, correcciones, correccionesOp, anulaciones, operaciones, comprobantes, inscripciones, cajas };
}

describe.skipIf(!basePgHabilitada)("HU-I-05 Mis pagos con PostgreSQL descartable", () => {
  beforeAll(async () => {
    autor = (await crearFichaMesaEntradaDePrueba(db!)).usuarioId!;
    await abrirCajaDePrueba(db!, { usuarioId: autor, abiertaEl: new Date("2026-10-13T11:00:00.000Z") });
    usuarioA = (await crearUsuarioDePrueba(db!, { rol: "ALUMNO" })).idUsuario;
    usuarioB = (await crearUsuarioDePrueba(db!, { rol: "ALUMNO" })).idUsuario;
    usuarioSinFicha = (await crearUsuarioDePrueba(db!, { rol: "ALUMNO" })).idUsuario;
    usuarioSinPagos = (await crearUsuarioDePrueba(db!, { rol: "ALUMNO" })).idUsuario;
    alumnoA = (await crearAlumnoDePrueba(db!, { usuarioId: usuarioA })).idAlumno;
    const alumnoB = (await crearAlumnoDePrueba(db!, { usuarioId: usuarioB })).idAlumno;
    await crearAlumnoDePrueba(db!, { usuarioId: usuarioSinPagos });
    const materia = async (nombre: string) => {
      const m = await db!.materia.create({ data: { nombreMateria: nombre, nombreNormalizadaMateria: nombre.toLowerCase() } });
      return { id: m.idMateria, nombre };
    };
    materiaFis = await materia(`Física ${prefijo}`);
    materiaAlg = await materia(`Álgebra ${prefijo}`);
    const materiaQuiDeB = await materia(`Química ${prefijo}`);
    formaUno = (await db!.formaPago.create({ data: { nombreFormaPago: `Uno ${prefijo}`, nombreNormalizadaFormaPago: `uno ${prefijo}` } })).idFormaPago;
    formaDos = (await db!.formaPago.create({ data: { nombreFormaPago: `Dos ${prefijo}`, nombreNormalizadaFormaPago: `dos ${prefijo}` } })).idFormaPago;

    // Operación de dos clases; B paga la misma clase de Física.
    const compartida = await clase(materiaFis.id, 14, [alumnoA, alumnoB]);
    const algebra = await clase(materiaAlg.id, 15, [alumnoA]);
    const multi = await cobrar(alumnoA, [
      { inscripcion_id: compartida[alumnoA]!, monto: "100.10" }, { inscripcion_id: algebra[alumnoA]!, monto: "200.20" },
    ], "2026-10-10");
    op.push({ pagos: multi.pagos.map((p) => p.id), comprobante: multi.comprobante.id });
    pagoDeB = (await cobrar(alumnoB, [{ inscripcion_id: compartida[alumnoB]!, monto: "999.99" }], "2026-10-11")).pagos[0]!.id;
    const quimica = await clase(materiaQuiDeB.id, 16, [alumnoB]);
    pagoDeBOtraClase = (await cobrar(alumnoB, [{ inscripcion_id: quimica[alumnoB]!, monto: "100.00" }], "2026-10-11")).pagos[0]!.id;
    for (let i = 1; i <= 10; i++) {
      const insc = await clase(i % 2 ? materiaFis.id : materiaAlg.id, 16 + i, [alumnoA]);
      const r = await cobrar(alumnoA, [{ inscripcion_id: insc[alumnoA]!, monto: "50.05" }], `2026-10-${String(i).padStart(2, "0")}`);
      op.push({ pagos: [r.pagos[0]!.id], comprobante: r.comprobante.id });
    }
    // HU-I-06: anulación parcial (op 0, Álgebra), total (op 1), corrección de monto (op 2) y de fecha + forma (op 3).
    await conReloj(momento, () => transaccion((tx) => anularPago(tx, { pagoId: op[0]!.pagos[1]!, motivo: MOTIVOS.parcial, usuario: operador() })));
    await conReloj(momento, () => transaccion((tx) => anularPago(tx, { pagoId: op[1]!.pagos[0]!, motivo: MOTIVOS.total, usuario: operador() })));
    await conReloj(momento, () => transaccion((tx) => corregirPago(tx, { pagoId: op[2]!.pagos[0]!, monto: "77.77", motivo: MOTIVOS.correccion, usuario: operador() })));
    await conReloj(momento, () => transaccion((tx) => corregirOperacion(tx, {
      pagoId: op[3]!.pagos[0]!, fechaPago: new Date("2026-10-12T00:00:00.000Z"), formaPagoId: formaDos, motivo: MOTIVOS.correccion, usuario: operador(),
    })));
  }, 180_000);
  afterAll(async () => db?.$disconnect());

  it("lista solo los pagos de A con valores vigentes, total exacto de todo el resultado y diez filas", async () => {
    const p1 = await listarMisPagos(usuarioA, q());
    // Vigentes no anulados: 100.10 (op0 Física) + 77.77 (op2 corregido) + 8 × 50.05 = 578.27.
    expect(p1.total_pagado).toBe("578.27");
    expect(p1.paginacion).toEqual({ total: 12, pagina_actual: 1, total_paginas: 2, por_pagina: 10 });
    expect(p1.items).toHaveLength(10);
    const p2 = await listarMisPagos(usuarioA, q({ pagina: "2" }));
    expect(p2.total_pagado).toBe("578.27");
    expect(p2.items).toHaveLength(2);
    const todos = [...p1.items, ...p2.items];
    expect(new Set(todos.map((i) => i.pago_id))).toEqual(new Set(op.flatMap((o) => o.pagos)));
    expect(todos.map((i) => i.pago_id)).not.toContain(pagoDeB);
    const fechas = todos.map((i) => i.fecha_pago);
    expect(fechas).toEqual([...fechas].sort().reverse());
    // Corrección de fecha y forma: el pago de op 3 pasa a la fecha y forma vigentes y encabeza la lista.
    expect(p1.items[0]).toMatchObject({ pago_id: op[3]!.pagos[0], fecha_pago: "2026-10-12", forma_pago: { id: formaDos }, monto: "50.05" });
    expect(todos.find((i) => i.pago_id === op[2]!.pagos[0])).toMatchObject({ monto: "77.77", anulado: false });
    expect(todos.find((i) => i.pago_id === op[1]!.pagos[0])).toMatchObject({ anulado: true, monto: "50.05" });
    expect(todos.find((i) => i.pago_id === op[0]!.pagos[1])).toMatchObject({ anulado: true, clase: { materia: materiaAlg } });
    expect(await listarMisPagos(usuarioA, q({ pagina: "99" }))).toMatchObject({ paginacion: { pagina_actual: 2 } });
  });

  it("filtros combinados sobre la fecha de pago vigente y la materia, inclusivos", async () => {
    const dia12 = await listarMisPagos(usuarioA, q({ desde: "2026-10-12", hasta: "2026-10-12" }));
    expect(dia12.items.map((i) => i.pago_id)).toEqual([op[3]!.pagos[0]]);
    expect((await listarMisPagos(usuarioA, q({ desde: "2026-10-03", hasta: "2026-10-03" }))).items).toEqual([]);
    const fisRango = await listarMisPagos(usuarioA, q({ materia_id: materiaFis.id, desde: "2026-10-01", hasta: "2026-10-10" }));
    // Física: op0 (10/10, 100.10) y op 1, 5, 7, 9 (días impares; op1 anulado). op3 (Física) se movió al 12/10.
    expect(fisRango.items.map((i) => i.pago_id).sort()).toEqual([op[0]!.pagos[0], op[1]!.pagos[0], op[5]!.pagos[0], op[7]!.pagos[0], op[9]!.pagos[0]].sort());
    expect(fisRango.total_pagado).toBe("250.25");
    const deB = await listarMisPagos(usuarioA, q({ materia_id: (await obtenerOpcionesMisPagos(usuarioB)).materias.find((m) => m.nombre.startsWith("Química"))!.id }));
    expect(deB).toMatchObject({ items: [], total_pagado: "0.00", paginacion: { total: 0, pagina_actual: 1, total_paginas: 0 } });
  });

  it("proyección propia: claves exactas y nada interno (precio, ajuste, motivos, actores, caja) ni pagos de B", async () => {
    const { items } = await listarMisPagos(usuarioA, q());
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(["anulado", "clase", "comprobante", "fecha_pago", "forma_pago", "monto", "pago_id"]);
      expect(Object.keys(item.clase).sort()).toEqual(["fecha", "hora_inicio", "materia"]);
      expect(Object.keys(item.forma_pago).sort()).toEqual(["id", "nombre"]);
    }
    const json = JSON.stringify(await listarMisPagos(usuarioA, q({ pagina: "2" }))) + JSON.stringify(items);
    for (const prohibido of [...Object.values(MOTIVOS), autor, pagoDeB, "precio", "registrado", "caja", "operacion", "cambios", "puede_corregir"]) {
      expect(json).not.toContain(prohibido);
    }
  });

  it("opciones: materias de A con pagos (anulados incluidos), alfabéticas, sin las que solo pagó B", async () => {
    expect(await obtenerOpcionesMisPagos(usuarioA)).toEqual({ materias: [materiaAlg, materiaFis] });
    expect(await obtenerOpcionesMisPagos(usuarioSinPagos)).toEqual({ materias: [] });
  });

  it("sin pagos → vacío; cuenta sin ficha → ALUMNO_NO_ENCONTRADO", async () => {
    expect(await listarMisPagos(usuarioSinPagos, q())).toEqual({
      total_pagado: "0.00", items: [], paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 10 },
    });
    await expect(listarMisPagos(usuarioSinFicha, q())).rejects.toMatchObject({ code: "ALUMNO_NO_ENCONTRADO" });
    await expect(obtenerOpcionesMisPagos(usuarioSinFicha)).rejects.toMatchObject({ code: "ALUMNO_NO_ENCONTRADO" });
  });

  it("cada pago enlaza el comprobante correcto por pago_id y la vista del alumno omite registrador y motivo (diferidos I-11 C2/C5)", async () => {
    const todos = [...(await listarMisPagos(usuarioA, q())).items, ...(await listarMisPagos(usuarioA, q({ pagina: "2" }))).items];
    for (const item of todos) {
      expect(item.comprobante).not.toBeNull();
      const desdePago = await comprobanteDelPago(db!, item.pago_id);
      expect(desdePago).toEqual(item.comprobante);
      const vista = await leerComprobanteDeAlumno(db!, desdePago.id, alumnoA);
      expect(vista).not.toBeNull();
      expect(vista).not.toHaveProperty("registrado_por");
      expect(vista!.registrado_en_el_centro).toBe(true);
      expect(JSON.stringify(vista)).not.toMatch(/SECRET/);
    }
    // Anulación parcial: el anulado abre el ORIGINAL («Reemplazado por»); el vigente, el reemplazo («reemplaza a»).
    const anuladoParcial = todos.find((i) => i.pago_id === op[0]!.pagos[1])!;
    const vigenteParcial = todos.find((i) => i.pago_id === op[0]!.pagos[0])!;
    expect(anuladoParcial.comprobante!.id).toBe(op[0]!.comprobante);
    expect(vigenteParcial.comprobante!.id).not.toBe(op[0]!.comprobante);
    const original = await leerComprobanteDeAlumno(db!, op[0]!.comprobante, alumnoA);
    expect(original!.marcas).toEqual({ anulado: null, reemplazado_por: vigenteParcial.comprobante, reemplaza_a: null });
    const reemplazo = await leerComprobanteDeAlumno(db!, vigenteParcial.comprobante!.id, alumnoA);
    expect(reemplazo!.marcas.reemplaza_a).toEqual({ numero: anuladoParcial.comprobante!.numero });
    expect(reemplazo!.clases).toHaveLength(1);
    // Anulación total: el vigente queda «ANULADO» con la fecha y sin el motivo.
    const total = await leerComprobanteDeAlumno(db!, todos.find((i) => i.pago_id === op[1]!.pagos[0])!.comprobante!.id, alumnoA);
    expect(total!.marcas.anulado).toEqual({ fecha: "2026-10-13" });
    // Corrección: el pago corregido abre el reemplazo con el monto nuevo; el documento conserva su copia.
    const corregido = await leerComprobanteDeAlumno(db!, todos.find((i) => i.pago_id === op[2]!.pagos[0])!.comprobante!.id, alumnoA);
    expect(corregido!.total).toBe("77.77");
    expect(corregido!.marcas.reemplaza_a).not.toBeNull();
  });

  it("A no puede leer el comprobante de un pago de B, ni de la misma clase ni de otra (diferido I-11 C4)", async () => {
    for (const ajeno of [pagoDeB, pagoDeBOtraClase]) {
      const { id } = await comprobanteDelPago(db!, ajeno);
      await expect(leerComprobanteDeAlumno(db!, id, alumnoA)).rejects.toMatchObject({ code: "FUERA_DE_ALCANCE", status: 403 });
    }
  });

  it("consultar listado, opciones y comprobantes no escribe ninguna tabla de pagos, comprobantes, inscripciones ni cajas", async () => {
    const antes = await fotoDeTablas();
    const { items } = await listarMisPagos(usuarioA, q());
    await obtenerOpcionesMisPagos(usuarioA);
    for (const item of items) await leerComprobanteDeAlumno(db!, (await comprobanteDelPago(db!, item.pago_id)).id, alumnoA);
    expect(await fotoDeTablas()).toEqual(antes);
  });
});
