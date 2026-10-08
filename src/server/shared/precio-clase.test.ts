import { describe, expect, it, vi } from "vitest";
import { precioClase } from "@/server/shared/precio-clase";
import { datosCentro, parametrosVigentes } from "@/server/shared/parametros-vigentes";
import { obtenerTarifasPorIds } from "@/server/materias/materia.publico";
import { ComprobanteDatosSchema, formatearNumeroComprobante } from "@/server/pagos/comprobante.schema";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

describe("precioClase (PR-0.md §2.4)", () => {
  it("tarifa por hora × duración / 60, entero para 60, 120 y 180 minutos", () => {
    expect(precioClase({ tarifaHora: 12000 }, 60)).toBe(12000);
    expect(precioClase({ tarifaHora: 12000 }, 120)).toBe(24000);
    expect(precioClase({ tarifaHora: 10500 }, 180)).toBe(31500);
  });

  it("sin tarifa lanza MATERIA_SIN_TARIFA (422) con el texto de quien opera", () => {
    expect(() => precioClase({ tarifaHora: null }, 60)).toThrow(expect.objectContaining({
      code: "MATERIA_SIN_TARIFA", status: 422, message: "Esta materia todavía no tiene tarifa. Pedile al gerente que la defina.",
    }));
    expect(() => precioClase({ tarifaHora: null }, 60, { paraAlumno: true })).toThrow(expect.objectContaining({
      code: "MATERIA_SIN_TARIFA", message: "Esta clase todavía no tiene precio. Comunicate con el centro.",
    }));
  });

  it("si el resultado no es entero, falla en vez de redondear", () => {
    expect(() => precioClase({ tarifaHora: 1001 }, 90)).toThrow(/no es un entero/);
  });
});

describe("parametrosVigentes (PR-0.md §2.6)", () => {
  it("entrega los tres parámetros como enteros, leyendo la base en cada llamada", async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ clave: "plazo_pago_horas", valor: " 48 " }, { clave: "umbral_presentismo", valor: "80" }])
      .mockResolvedValueOnce([{ clave: "plazo_pago_horas", valor: "12" }]);
    const db = { parametroSistema: { findMany } };
    await expect(parametrosVigentes(db as never)).resolves.toEqual({ plazoPagoHoras: 48, cancelacionAnticipacionHoras: 24, umbralPresentismo: 80 });
    await expect(parametrosVigentes(db as never)).resolves.toMatchObject({ plazoPagoHoras: 12 });
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("un valor ausente, no entero o no positivo cae al valor por defecto", async () => {
    const db = { parametroSistema: { findMany: vi.fn().mockResolvedValue([
      { clave: "plazo_pago_horas", valor: "abc" }, { clave: "cancelacion_anticipacion_horas", valor: "1.5" }, { clave: "umbral_presentismo", valor: "0" },
    ]) } };
    await expect(parametrosVigentes(db as never)).resolves.toEqual({ plazoPagoHoras: 24, cancelacionAnticipacionHoras: 24, umbralPresentismo: 75 });
  });

  it("datosCentro arma nombre, domicilio y teléfono", async () => {
    const db = { parametroSistema: { findMany: vi.fn().mockResolvedValue([
      { clave: "centro_nombre", valor: "Instituto" }, { clave: "centro_telefono", valor: "351" },
    ]) } };
    await expect(datosCentro(db as never)).resolves.toEqual({ nombre: "Instituto", domicilio: "", telefono: "351" });
  });
});

describe("obtenerTarifasPorIds (spec_modulo_L.md §2.10)", () => {
  it("devuelve la tarifa (o null) de las materias existentes, sin repetir y en el orden pedido", async () => {
    const findMany = vi.fn().mockResolvedValue([{ idMateria: "b", tarifaHoraMateria: null }, { idMateria: "a", tarifaHoraMateria: 9000 }]);
    const db = { materia: { findMany } };
    await expect(obtenerTarifasPorIds(["a", "x", "b", "a"], db as never)).resolves.toEqual([
      { id: "a", tarifaHora: 9000 }, { id: "b", tarifaHora: null },
    ]);
    expect(findMany).toHaveBeenCalledWith({ where: { idMateria: { in: ["a", "x", "b"] } }, select: { idMateria: true, tarifaHoraMateria: true } });
    await expect(obtenerTarifasPorIds([], db as never)).resolves.toEqual([]);
  });
});

describe("comprobante (spec_modulo_I.md §2.9)", () => {
  const datos = {
    version: 1,
    centro: { nombre: "Instituto Noctium", domicilio: "Av. Siempreviva 742", telefono: "351-4000000" },
    alumno: { id: "a1", nombre: "Ana", apellido: "Pérez", dni: "40100001" },
    fecha_pago: "2030-10-09",
    forma_pago: { id: "formapago-efectivo", nombre: "Efectivo" },
    registrado_por: { usuario_id: "u1", nombre_completo: "Ruiz, Marta" },
    clases: [{ pago_id: "p1", materia: { id: "m1", nombre: "Física I" }, fecha: "2030-10-12", hora_inicio: "18:00", precio: 24000, monto: "22000.00" }],
    total: "22000.00",
  };

  it("número visible 0001- y 8 dígitos", () => {
    expect(formatearNumeroComprobante(123)).toBe("0001-00000123");
    expect(formatearNumeroComprobante(1)).toBe("0001-00000001");
  });

  it("el contrato acepta el ejemplo de la spec y rechaza campos de más o montos sin decimales", () => {
    expect(ComprobanteDatosSchema.parse(datos)).toEqual(datos);
    expect(ComprobanteDatosSchema.safeParse({ ...datos, extra: 1 }).success).toBe(false);
    expect(ComprobanteDatosSchema.safeParse({ ...datos, total: "22000" }).success).toBe(false);
    expect(ComprobanteDatosSchema.safeParse({ ...datos, clases: [] }).success).toBe(false);
  });
});
