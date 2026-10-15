import { beforeEach, describe, expect, it, vi } from "vitest";

// Agregador de «registró operaciones» (DEC-39, spec_modulo_F.md §2.7) con las
// lecturas de cada módulo simuladas: cualquier línea verdadera alcanza, las
// cinco falsas dan false, y se corta en la primera verdadera.

const m = vi.hoisted(() => ({ pagos: vi.fn(), clases: vi.fn(), tarifas: vi.fn(), configuracion: vi.fn(), estados: vi.fn() }));

vi.mock("@/server/pagos/pago.publico", () => ({ usuarioRegistroOperaciones: m.pagos }));
vi.mock("@/server/turnos/turno.publico", () => ({ usuarioRegistroOperaciones: m.clases }));
vi.mock("@/server/materias/materia.publico", () => ({ usuarioRegistroOperaciones: m.tarifas }));
vi.mock("@/server/configuracion/configuracion.publico", () => ({ usuarioRegistroOperaciones: m.configuracion }));
vi.mock("@/server/shared/historial-estados", () => ({ usuarioRegistroCambiosDeEstado: m.estados }));

const { usuarioRegistroOperaciones } = await import("@/server/shared/actividad-usuario");

const TX = { soy: "tx" } as never;
const USUARIO = "ckusuario";

beforeEach(() => {
  vi.clearAllMocks();
  for (const lectura of Object.values(m)) lectura.mockResolvedValue(false);
});

describe("usuarioRegistroOperaciones (agregador)", () => {
  it("las cinco líneas en false: false, y cada una recibe la cuenta y el cliente del llamador", async () => {
    expect(await usuarioRegistroOperaciones(TX, USUARIO)).toBe(false);
    expect(m.pagos).toHaveBeenCalledWith(TX, USUARIO);
    expect(m.clases).toHaveBeenCalledWith(USUARIO, TX);
    expect(m.tarifas).toHaveBeenCalledWith(USUARIO, TX);
    expect(m.configuracion).toHaveBeenCalledWith(USUARIO, TX);
    expect(m.estados).toHaveBeenCalledWith(USUARIO, TX);
  });

  it.each([
    ["I (pagos y cajas)", "pagos"],
    ["C (clases e inscripciones)", "clases"],
    ["L (tarifas)", "tarifas"],
    ["N (parámetros del centro)", "configuracion"],
    ["historial de estados", "estados"],
  ] as const)("la línea de %s sola alcanza", async (_nombre, linea) => {
    m[linea].mockResolvedValue(true);
    expect(await usuarioRegistroOperaciones(TX, USUARIO)).toBe(true);
  });

  it("recorre I → C → L → N → estados y corta en la primera verdadera", async () => {
    const orden: string[] = [];
    for (const [nombre, lectura] of Object.entries(m)) {
      lectura.mockImplementation(async () => { orden.push(nombre); return nombre === "clases"; });
    }
    expect(await usuarioRegistroOperaciones(TX, USUARIO)).toBe(true);
    expect(orden).toEqual(["pagos", "clases"]);
    expect(m.tarifas).not.toHaveBeenCalled();
    expect(m.configuracion).not.toHaveBeenCalled();
    expect(m.estados).not.toHaveBeenCalled();
  });
});
