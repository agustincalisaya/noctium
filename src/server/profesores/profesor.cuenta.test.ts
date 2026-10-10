import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import type { ServiceError } from "@/server/shared/service-error";

// HU-A-06 con HU-D-01, D-02 y D-06 (spec_modulo_D.md §2.9.1 y §2.9.2): alta
// con cuenta y email de la ficha sincronizado con la cuenta, con la
// persistencia y el módulo A simulados. Los casos con PostgreSQL real están
// en profesor.cuenta.pg.test.ts.

const m = vi.hoisted(() => ({
  orden: [] as string[],
  tx: {
    profesor: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
  crearCuenta: vi.fn(),
  cambiarEmail: vi.fn(),
  verificarEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/shared/transaccion", () => ({
  transaccion: async (fn: (tx: unknown) => Promise<unknown>) => fn(m.tx),
}));
vi.mock("@/server/materias/materia.service", () => ({ bloquearMateriasParaAsociar: vi.fn() }));
vi.mock("@/server/usuarios/cuenta.service", () => ({
  crearCuentaParaFicha: (...a: unknown[]) => (m.orden.push("cuenta"), m.crearCuenta(...a)),
  cambiarEmailCuenta: (...a: unknown[]) => (m.orden.push("cambiarEmail"), m.cambiarEmail(...a)),
  verificarEmailNoAsociadoAOtraCuenta: (...a: unknown[]) => (m.orden.push("verificarEmail"), m.verificarEmail(...a)),
  obtenerResumenCuenta: vi.fn(),
}));

const { crearProfesor, actualizarContactoProfesor, modificarProfesor } = await import("@/server/profesores/profesor.service");

const REGISTRANTE = "ckusuario0000000000000001";
const CUENTA = "ckusuario0000000000000009";
const PROFESOR = "ckprofesor000000000000001";
const IP = "10.0.0.6";
const IDENTIDAD = { nombre: "Ana", apellido: "Gómez", dni: "9011122", fechaNacimiento: new Date(Date.UTC(1980, 4, 10)) };

/** Ficha con cuenta, como la deja el alta de HU-A-06. */
const CON_CUENTA = {
  idProfesor: PROFESOR,
  usuarioId: CUENTA,
  nombreProfesor: "Ana",
  apellidoProfesor: "Gómez",
  dniProfesor: "9011122",
  fechaNacimientoProfesor: IDENTIDAD.fechaNacimiento,
  generoProfesor: null,
  telefonoProfesor: "0387154123456",
  emailProfesor: "ana@noctium.local",
  version: 2,
};

async function capturar(promesa: Promise<unknown>): Promise<ServiceError> {
  try {
    await promesa;
  } catch (error) {
    return error as ServiceError;
  }
  throw new Error("Se esperaba un error");
}

beforeEach(() => {
  vi.clearAllMocks();
  m.orden.length = 0;
  m.tx.profesor.findFirst.mockResolvedValue(null);
  m.tx.profesor.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    m.orden.push("ficha");
    return {
      idProfesor: PROFESOR, nombreProfesor: data.nombreProfesor, apellidoProfesor: data.apellidoProfesor, dniProfesor: data.dniProfesor,
      activoProfesor: true, telefonoProfesor: data.telefonoProfesor, emailProfesor: data.emailProfesor,
    };
  });
  m.tx.profesor.update.mockImplementation(async () => (m.orden.push("ficha"), { idProfesor: PROFESOR, telefonoProfesor: null, emailProfesor: "x" }));
  m.tx.profesor.updateMany.mockResolvedValue({ count: 1 });
  m.crearCuenta.mockResolvedValue({ usuario_id: CUENTA });
  m.cambiarEmail.mockResolvedValue({ cambio: true });
  m.verificarEmail.mockResolvedValue(undefined);
});

describe("crearProfesor: alta con cuenta (spec_modulo_D.md §2.9.1)", () => {
  it("sin email: contrato de Sprint 1 y 2, sin cuenta (usuarioId null) y cuenta.creada false", async () => {
    const creado = await crearProfesor(IDENTIDAD, REGISTRANTE, IP);
    expect(m.crearCuenta).not.toHaveBeenCalled();
    expect(m.tx.profesor.create.mock.calls[0]![0]).toMatchObject({ data: { usuarioId: null, emailProfesor: null } });
    expect(creado.cuenta).toEqual({ creada: false });
  });

  it("con email: la cuenta (rol PROFESOR, DNI como contraseña inicial) y después la ficha con usuarioId", async () => {
    const creado = await crearProfesor({ ...IDENTIDAD, email: "ana@noctium.local" }, REGISTRANTE, IP);
    expect(m.orden).toEqual(["cuenta", "ficha"]);
    expect(m.crearCuenta).toHaveBeenCalledWith(m.tx, { email: "ana@noctium.local", dni: "9011122", rol: "PROFESOR", ip: IP });
    expect(m.tx.profesor.create.mock.calls[0]![0]).toMatchObject({ data: { usuarioId: CUENTA, emailProfesor: "ana@noctium.local" } });
    expect(creado).toMatchObject({ email: "ana@noctium.local", cuenta: { creada: true, debe_cambiar_password: true } });
    expect(JSON.stringify(creado.cuenta)).not.toContain("9011122");
  });

  it("si la cuenta falla (EMAIL_YA_ASOCIADO), no se crea la ficha", async () => {
    m.crearCuenta.mockRejectedValue(new ErrorDeDominio("errores.cuenta.emailYaAsociado"));
    const error = await capturar(crearProfesor({ ...IDENTIDAD, email: "otra@noctium.local" }, REGISTRANTE, IP));
    expect(error).toMatchObject({ code: "EMAIL_YA_ASOCIADO", status: 409, message: "Ese email ya está asociado a otra cuenta" });
    expect(m.tx.profesor.create).not.toHaveBeenCalled();
  });

  it("DNI ya registrado: DNI_DUPLICADO antes de crear la cuenta", async () => {
    m.tx.profesor.findFirst.mockResolvedValue({ idProfesor: "otro" });
    const error = await capturar(crearProfesor({ ...IDENTIDAD, email: "ana@noctium.local" }, REGISTRANTE, IP));
    expect(error).toMatchObject({ code: "DNI_DUPLICADO" });
    expect(m.crearCuenta).not.toHaveBeenCalled();
  });

  it("P2002 del DNI (alta simultánea) sale de la transacción y se traduce a DNI_DUPLICADO", async () => {
    m.tx.profesor.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique", { code: "P2002", clientVersion: "x", meta: { target: ["dniProfesor"] } }));
    const error = await capturar(crearProfesor({ ...IDENTIDAD, email: "ana@noctium.local" }, REGISTRANTE, IP));
    expect(error).toMatchObject({ code: "DNI_DUPLICADO" });
  });
});

describe("actualizarContactoProfesor (D-02): email de una ficha con cuenta", () => {
  it("email nuevo: cambia también el de la cuenta, antes de la ficha y en la misma transacción", async () => {
    m.tx.profesor.findUnique.mockResolvedValue(CON_CUENTA);
    await actualizarContactoProfesor(PROFESOR, { telefono: "0387154123456", email: "nuevo@noctium.local" }, REGISTRANTE);
    expect(m.cambiarEmail).toHaveBeenCalledWith(m.tx, { usuarioId: CUENTA, email: "nuevo@noctium.local" });
    expect(m.orden).toEqual(["cambiarEmail", "ficha"]);
  });

  it("mismo email: no se revalida ni se llama a A", async () => {
    m.tx.profesor.findUnique.mockResolvedValue(CON_CUENTA);
    await actualizarContactoProfesor(PROFESOR, { telefono: "0387154123456", email: "ana@noctium.local" }, REGISTRANTE);
    expect(m.cambiarEmail).not.toHaveBeenCalled();
    expect(m.verificarEmail).not.toHaveBeenCalled();
  });

  it("una ficha con cuenta no puede quedarse sin email: CONTACTO_REQUERIDO en el campo email, sin guardar", async () => {
    m.tx.profesor.findUnique.mockResolvedValue(CON_CUENTA);
    const error = await capturar(actualizarContactoProfesor(PROFESOR, { telefono: "0387154123456" }, REGISTRANTE));
    expect(error).toMatchObject({ code: "CONTACTO_REQUERIDO", detalles: { campo: "email" } });
    expect(m.tx.profesor.update).not.toHaveBeenCalled();
  });

  it("ficha sin cuenta: verifica con A y nunca crea una cuenta (criterio 8); quitar el email sigue permitido", async () => {
    m.tx.profesor.findUnique.mockResolvedValue({ ...CON_CUENTA, usuarioId: null });
    await actualizarContactoProfesor(PROFESOR, { email: "nuevo@noctium.local" }, REGISTRANTE);
    expect(m.verificarEmail).toHaveBeenCalledWith("nuevo@noctium.local", {}, m.tx);
    expect(m.crearCuenta).not.toHaveBeenCalled();
    expect(m.cambiarEmail).not.toHaveBeenCalled();

    m.verificarEmail.mockClear();
    await actualizarContactoProfesor(PROFESOR, { telefono: "0387154123456" }, REGISTRANTE);
    expect(m.verificarEmail).not.toHaveBeenCalled();
  });
});

describe("modificarProfesor (D-06): el email de la ficha con cuenta es el de la cuenta", () => {
  it("email nuevo: cambia la cuenta y guarda la ficha", async () => {
    m.tx.profesor.findUnique.mockResolvedValue(CON_CUENTA);
    const r = await modificarProfesor(PROFESOR, { email: "nuevo@noctium.local", version: 2 }, REGISTRANTE);
    expect(m.cambiarEmail).toHaveBeenCalledWith(m.tx, { usuarioId: CUENTA, email: "nuevo@noctium.local" });
    expect(r).toEqual({ id: PROFESOR, campos_modificados: ["email"], version: 3 });
  });

  it("quitar el email con el teléfono cargado: CONTACTO_REQUERIDO en el campo email (P-D13)", async () => {
    m.tx.profesor.findUnique.mockResolvedValue(CON_CUENTA);
    const error = await capturar(modificarProfesor(PROFESOR, { email: null, version: 2 }, REGISTRANTE));
    expect(error).toMatchObject({ code: "CONTACTO_REQUERIDO", detalles: { campo: "email" } });
    expect(m.tx.profesor.updateMany).not.toHaveBeenCalled();
  });

  it("ficha inactiva con cuenta: también cambia la cuenta (P-D10)", async () => {
    m.tx.profesor.findUnique.mockResolvedValue({ ...CON_CUENTA, activoProfesor: false });
    await modificarProfesor(PROFESOR, { email: "inactiva@noctium.local", version: 2 }, REGISTRANTE);
    expect(m.cambiarEmail).toHaveBeenCalled();
  });

  it("ficha sin cuenta: email nuevo se verifica con A y no crea cuenta", async () => {
    m.tx.profesor.findUnique.mockResolvedValue({ ...CON_CUENTA, usuarioId: null });
    await modificarProfesor(PROFESOR, { email: "nuevo@noctium.local", version: 2 }, REGISTRANTE);
    expect(m.verificarEmail).toHaveBeenCalledWith("nuevo@noctium.local", {}, m.tx);
    expect(m.crearCuenta).not.toHaveBeenCalled();
    expect(m.cambiarEmail).not.toHaveBeenCalled();
  });
});
