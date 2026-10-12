import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { comprobanteDelPago, comprobanteDelPagoEnOperacion, leerComprobante, leerComprobanteDeAlumno, type OperacionLeida } from "./comprobante.lectura";

// Lectura de comprobantes (HU-I-11, spec_modulo_I.md §2.9.3/2.9.4): la vista
// sale de la copia fija y las marcas se derivan de anulaciones y reemplazos.
const db = {
  comprobante: { findUnique: vi.fn() },
  pago: { findUnique: vi.fn() },
};
const tx = db as unknown as Prisma.TransactionClient;

const datos = (pagoIds: string[] = ["pago-1"]) => ({
  version: 1,
  centro: { nombre: "Noctium", domicilio: "Av. Colón 1250", telefono: "351-4000000" },
  alumno: { id: "alumno-1", nombre: "Ana", apellido: "Pérez", dni: "40100001" },
  fecha_pago: "2026-10-09",
  forma_pago: { id: "fp-1", nombre: "Transferencia" },
  registrado_por: { usuario_id: "mesa-1", nombre_completo: "Ruiz, Marta" },
  clases: pagoIds.map((pagoId, i) => ({
    pago_id: pagoId, materia: { id: `m-${i}`, nombre: "Física I" }, fecha: "2026-10-12", hora_inicio: "18:00", precio: 24000, monto: "22000.00",
  })),
  total: (22000 * pagoIds.length).toFixed(2),
});

const anulacion = (fecha: string, motivo: string) => ({ createdAtAnulacionPago: new Date(fecha), motivo });
const pago = (idPago: string, anulada: ReturnType<typeof anulacion> | null = null) => ({
  idPago, turnoId: `t-${idPago}`, inscripcionId: `i-${idPago}`, precio: 24000, montoPago: new Prisma.Decimal("22000"),
  motivoAjuste: null, ajustadoPorUsuarioId: null, createdAtPago: new Date("2026-10-09T18:31:00.000Z"), anulacion: anulada, correcciones: [],
});
const operacion = (pagos: ReturnType<typeof pago>[], alumnoId = "alumno-1") => ({
  idOperacionPago: "op-1", alumnoId, cajaId: "caja-1", creadoPorUsuarioId: "mesa-1", registradaEl: new Date("2026-10-09T18:31:00.000Z"),
  formaPagoId: "fp-1", fechaPago: new Date("2026-10-09T00:00:00.000Z"), correcciones: [], pagos,
});
const comprobante = (extra: Record<string, unknown> = {}) => ({
  idComprobante: "comp-1", numero: 123, datos: datos(), emitidoEl: new Date("2026-10-09T18:31:00.000Z"),
  reemplazaA: null, reemplazadoPor: null, operacion: operacion([pago("pago-1")]), ...extra,
});

beforeEach(() => vi.resetAllMocks());

describe("leerComprobante (vista completa)", () => {
  it("vigente sin marcas: copia fija, número visible y emitido_el con el offset del centro", async () => {
    db.comprobante.findUnique.mockResolvedValue(comprobante());

    await expect(leerComprobante(tx, "comp-1")).resolves.toEqual({
      id: "comp-1", numero: "0001-00000123", emitido_el: "2026-10-09T15:31:00-03:00",
      centro: { nombre: "Noctium", domicilio: "Av. Colón 1250", telefono: "351-4000000" },
      alumno: { nombre_completo: "Pérez, Ana", dni: "40100001" },
      fecha_pago: "2026-10-09", forma_pago: { nombre: "Transferencia" }, registrado_por: "Ruiz, Marta",
      clases: [{ materia: "Física I", fecha: "2026-10-12", hora_inicio: "18:00", monto: "22000.00" }],
      total: "22000.00",
      marcas: { anulado: null, reemplazado_por: null, reemplaza_a: null },
    });
    expect(db.comprobante.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { idComprobante: "comp-1" } }));
  });

  it("reemplazado: «Reemplazado por» con id y número del nuevo", async () => {
    db.comprobante.findUnique.mockResolvedValue(comprobante({ reemplazadoPor: { idComprobante: "comp-2", numero: 130 } }));
    const leido = await leerComprobante(tx, "comp-1");
    expect(leido?.marcas).toEqual({ anulado: null, reemplazado_por: { id: "comp-2", numero: "0001-00000130" }, reemplaza_a: null });
  });

  it("reemplazo de otro: «reemplaza a» con el número del anterior", async () => {
    db.comprobante.findUnique.mockResolvedValue(comprobante({ reemplazaA: { numero: 120 } }));
    const leido = await leerComprobante(tx, "comp-1");
    expect(leido?.marcas.reemplaza_a).toEqual({ numero: "0001-00000120" });
  });

  it("todos los pagos anulados: «ANULADO» con fecha (día del centro) y motivo de la última anulación", async () => {
    db.comprobante.findUnique.mockResolvedValue(comprobante({
      datos: datos(["pago-1", "pago-2"]),
      operacion: operacion([
        pago("pago-1", anulacion("2026-10-10T12:00:00.000Z", "Primero")),
        pago("pago-2", anulacion("2026-10-12T01:00:00.000Z", "Reintegro")),
      ]),
    }));
    const leido = await leerComprobante(tx, "comp-1");
    expect(leido?.marcas.anulado).toEqual({ fecha: "2026-10-11", motivo: "Reintegro" });
  });

  it("con algún pago vigente no hay «ANULADO»; un comprobante ya reemplazado tampoco lo lleva", async () => {
    db.comprobante.findUnique.mockResolvedValueOnce(comprobante({
      operacion: operacion([pago("pago-1", anulacion("2026-10-10T12:00:00.000Z", "x")), pago("pago-2")]),
    }));
    expect((await leerComprobante(tx, "comp-1"))?.marcas.anulado).toBeNull();

    db.comprobante.findUnique.mockResolvedValueOnce(comprobante({
      reemplazadoPor: { idComprobante: "comp-2", numero: 124 },
      operacion: operacion([pago("pago-1", anulacion("2026-10-10T12:00:00.000Z", "x"))]),
    }));
    expect((await leerComprobante(tx, "comp-1"))?.marcas.anulado).toBeNull();
  });

  it("registrado_por null si la cuenta no tiene ficha del personal", async () => {
    db.comprobante.findUnique.mockResolvedValue(comprobante({
      datos: { ...datos(), registrado_por: { usuario_id: "u-x", nombre_completo: null } },
    }));
    expect((await leerComprobante(tx, "comp-1"))?.registrado_por).toBeNull();
  });

  it("inexistente → null", async () => {
    db.comprobante.findUnique.mockResolvedValue(null);
    await expect(leerComprobante(tx, "nada")).resolves.toBeNull();
  });
});

describe("leerComprobanteDeAlumno (vista del alumno)", () => {
  it("sin registrado_por (sí registrado_en_el_centro) y sin el motivo de la anulación", async () => {
    db.comprobante.findUnique.mockResolvedValue(comprobante({
      operacion: operacion([pago("pago-1", anulacion("2026-10-10T12:00:00.000Z", "Reintegro"))]),
    }));
    const leido = await leerComprobanteDeAlumno(tx, "comp-1", "alumno-1");
    expect(leido).not.toHaveProperty("registrado_por");
    expect(leido?.registrado_en_el_centro).toBe(true);
    expect(leido?.marcas.anulado).toEqual({ fecha: "2026-10-10" });
    expect(JSON.stringify(leido)).not.toContain("Reintegro");
    expect(JSON.stringify(leido)).not.toContain("Ruiz, Marta");
  });

  it("comprobante de otro alumno → errores.pago.fueraDeAlcance", async () => {
    db.comprobante.findUnique.mockResolvedValue(comprobante({ operacion: operacion([pago("pago-1")], "alumno-otro") }));
    await expect(leerComprobanteDeAlumno(tx, "comp-1", "alumno-1")).rejects.toMatchObject({ code: "FUERA_DE_ALCANCE", status: 403 });
  });

  it("inexistente → null", async () => {
    db.comprobante.findUnique.mockResolvedValue(null);
    await expect(leerComprobanteDeAlumno(tx, "nada", "alumno-1")).resolves.toBeNull();
  });
});

describe("comprobanteDelPagoEnOperacion / comprobanteDelPago", () => {
  const leida = (comprobantes: unknown[]) => ({ ...operacion([]), comprobantes }) as unknown as OperacionLeida;
  // Más reciente primero, como lo ordena INCLUDE_LECTURA.
  const reemplazo = { idComprobante: "comp-2", numero: 124, datos: datos(["pago-2"]), reemplazadoPor: null };
  const original = { idComprobante: "comp-1", numero: 123, datos: datos(["pago-1", "pago-2"]), reemplazadoPor: { idComprobante: "comp-2" } };

  it("pago vigente → el comprobante que nadie reemplazó", () => {
    expect(comprobanteDelPagoEnOperacion(leida([reemplazo, original]), "pago-2", false)).toEqual({ id: "comp-2", numero: "0001-00000124" });
  });

  it("pago anulado con otros pagos vigentes → el ORIGINAL que lo incluyó (el reemplazo no lo incluye)", () => {
    expect(comprobanteDelPagoEnOperacion(leida([reemplazo, original]), "pago-1", true)).toEqual({ id: "comp-1", numero: "0001-00000123" });
  });

  it("pago anulado único de su operación → el comprobante que lo incluyó", () => {
    const unico = { idComprobante: "comp-9", numero: 9, datos: datos(["pago-1"]), reemplazadoPor: null };
    expect(comprobanteDelPagoEnOperacion(leida([unico]), "pago-1", true)).toEqual({ id: "comp-9", numero: "0001-00000009" });
  });

  it("comprobanteDelPago carga la operación del pago y delega", async () => {
    db.pago.findUnique.mockResolvedValue({ anulacion: { idAnulacionPago: "a-1" }, operacion: leida([reemplazo, original]) });
    await expect(comprobanteDelPago(tx, "pago-1")).resolves.toEqual({ id: "comp-1", numero: "0001-00000123" });
    expect(db.pago.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { idPago: "pago-1" } }));
  });

  it("pago inexistente → errores.pago.noEncontrado", async () => {
    db.pago.findUnique.mockResolvedValue(null);
    await expect(comprobanteDelPago(tx, "nada")).rejects.toMatchObject({ code: "PAGO_NO_ENCONTRADO", status: 404 });
  });

  it("pago sin comprobante → error de inconsistencia, no «no encontrado»", async () => {
    db.pago.findUnique.mockResolvedValue({ anulacion: null, operacion: leida([]) });
    const error = await comprobanteDelPago(tx, "pago-1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toHaveProperty("status");
  });
});
