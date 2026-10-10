import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import type { ServiceError } from "@/server/shared/service-error";

// HU-A-06 con HU-B-01, B-02 y B-06 (spec_modulo_B.md §2.9, §2.2 y §2.5):
// alta con cuenta y email de la ficha sincronizado con la cuenta, con la
// persistencia y el módulo A simulados. Los casos con PostgreSQL real están
// en alumno.cuenta.pg.test.ts.

const m = vi.hoisted(() => ({
  orden: [] as string[],
  tx: {
    alumno: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
  crearCuenta: vi.fn(),
  cambiarEmail: vi.fn(),
  verificarEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/shared/transaccion", () => ({
  transaccion: async (fn: (tx: unknown) => Promise<unknown>) => fn(m.tx),
}));
vi.mock("@/server/pagos/forma-pago.publico", () => ({
  verificarFormaPagoActiva: vi.fn(async () => true),
  obtenerFormaPago: vi.fn(),
  listarFormasPagoActivas: vi.fn(),
}));
vi.mock("@/server/usuarios/cuenta.service", () => ({
  crearCuentaParaFicha: (...a: unknown[]) => (m.orden.push("cuenta"), m.crearCuenta(...a)),
  cambiarEmailCuenta: (...a: unknown[]) => (m.orden.push("cambiarEmail"), m.cambiarEmail(...a)),
  verificarEmailNoAsociadoAOtraCuenta: (...a: unknown[]) => (m.orden.push("verificarEmail"), m.verificarEmail(...a)),
  obtenerResumenCuenta: vi.fn(),
}));

const { crearAlumno, actualizarContactoAlumno, modificarAlumno } = await import("@/server/alumnos/alumno.service");

const REGISTRANTE = "ckusuario0000000000000001";
const CUENTA = "ckusuario0000000000000009";
const ALUMNO = "ckalumno00000000000000001";
const IP = "10.0.0.5";
const IDENTIDAD = { nombre: "Ana", apellido: "Gómez", dni: "3011122", fecha_nacimiento: new Date("2005-05-10T00:00:00.000Z") };
const SIN_CAMBIOS = { nombre: false, apellido: false, dni: false, fecha_nacimiento: false, genero: false, telefono: false, email: false, forma_pago_id: false };

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
  m.tx.alumno.findFirst.mockResolvedValue(null);
  m.tx.alumno.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    m.orden.push("ficha");
    return { idAlumno: ALUMNO, nombreAlumno: data.nombreAlumno, apellidoAlumno: data.apellidoAlumno, dniAlumno: data.dniAlumno, activoAlumno: true, usuarioId: data.usuarioId ?? null };
  });
  m.crearCuenta.mockResolvedValue({ usuario_id: CUENTA });
  m.cambiarEmail.mockResolvedValue({ cambio: true });
  m.verificarEmail.mockResolvedValue(undefined);
  m.tx.alumno.update.mockImplementation(async () => ({ idAlumno: ALUMNO, telefonoAlumno: null, emailAlumno: "nuevo@noctium.local" }));
  m.tx.alumno.updateMany.mockResolvedValue({ count: 1 });
});

describe("crearAlumno: alta con cuenta (spec_modulo_B.md §2.9)", () => {
  it("sin email: contrato de Sprint 1, sin cuenta ni usuarioId, cuenta.creada false", async () => {
    const alumno = await crearAlumno(IDENTIDAD, REGISTRANTE, IP);
    expect(m.crearCuenta).not.toHaveBeenCalled();
    const { data } = m.tx.alumno.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data).not.toHaveProperty("usuarioId");
    expect(data).not.toHaveProperty("emailAlumno");
    expect(data).toMatchObject({ dniAlumno: "3011122", activoAlumno: true, creadoPorUsuarioId: REGISTRANTE });
    expect(alumno.cuenta).toEqual({ creada: false });
  });

  it("con email: la cuenta (rol ALUMNO, DNI como contraseña inicial) y después la ficha con usuarioId, email y teléfono", async () => {
    const alumno = await crearAlumno({ ...IDENTIDAD, email: "ana@noctium.local", telefono: "0387154123456" }, REGISTRANTE, IP);
    expect(m.orden).toEqual(["cuenta", "ficha"]);
    expect(m.crearCuenta).toHaveBeenCalledWith(m.tx, { email: "ana@noctium.local", dni: "3011122", rol: "ALUMNO", ip: IP });
    expect(m.tx.alumno.create.mock.calls[0]![0]).toMatchObject({
      data: { usuarioId: CUENTA, emailAlumno: "ana@noctium.local", telefonoAlumno: "0387154123456" },
    });
    expect(alumno.cuenta).toEqual({ creada: true, debe_cambiar_password: true });
    // La respuesta nunca trae la contraseña inicial (el DNI solo como dato de la ficha).
    expect(JSON.stringify(alumno.cuenta)).not.toContain("3011122");
  });

  it("con email y sin teléfono: teléfono null", async () => {
    await crearAlumno({ ...IDENTIDAD, email: "ana@noctium.local" }, REGISTRANTE, IP);
    expect(m.tx.alumno.create.mock.calls[0]![0]).toMatchObject({ data: { telefonoAlumno: null } });
  });

  it("si la cuenta falla (EMAIL_YA_ASOCIADO), no se crea la ficha", async () => {
    m.crearCuenta.mockRejectedValue(new ErrorDeDominio("errores.cuenta.emailYaAsociado"));
    const error = await capturar(crearAlumno({ ...IDENTIDAD, email: "otra@noctium.local" }, REGISTRANTE, IP));
    expect(error).toMatchObject({ code: "EMAIL_YA_ASOCIADO", status: 409, message: "Ese email ya está asociado a otra cuenta" });
    expect(m.tx.alumno.create).not.toHaveBeenCalled();
  });

  it("DNI ya registrado: DNI_DUPLICADO antes de crear la cuenta", async () => {
    m.tx.alumno.findFirst.mockResolvedValue({ activoAlumno: true });
    const error = await capturar(crearAlumno({ ...IDENTIDAD, email: "ana@noctium.local" }, REGISTRANTE, IP));
    expect(error).toMatchObject({ code: "DNI_DUPLICADO", message: "Ya existe un alumno registrado con ese DNI" });
    expect(m.crearCuenta).not.toHaveBeenCalled();
  });

  it("P2002 del DNI (alta simultánea) sale de la transacción y se traduce a DNI_DUPLICADO", async () => {
    m.tx.alumno.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Unique", { code: "P2002", clientVersion: "x", meta: { target: ["dniAlumno"] } }));
    const error = await capturar(crearAlumno({ ...IDENTIDAD, email: "ana@noctium.local" }, REGISTRANTE, IP));
    expect(error).toMatchObject({ code: "DNI_DUPLICADO" });
  });
});

describe("actualizarContactoAlumno (B-02): email de una ficha con cuenta", () => {
  const conCuenta = { idAlumno: ALUMNO, usuarioId: CUENTA, emailAlumno: "ana@noctium.local" };
  const sinCuenta = { idAlumno: ALUMNO, usuarioId: null, emailAlumno: null };

  it("email nuevo: cambia también el de la cuenta, en la misma transacción y antes de la ficha", async () => {
    m.tx.alumno.findUnique.mockResolvedValue(conCuenta);
    m.tx.alumno.update.mockImplementation(async () => (m.orden.push("ficha"), { idAlumno: ALUMNO, telefonoAlumno: null, emailAlumno: "nuevo@noctium.local" }));
    await actualizarContactoAlumno(ALUMNO, { email: "nuevo@noctium.local" }, { telefono: true, email: true }, REGISTRANTE);
    expect(m.cambiarEmail).toHaveBeenCalledWith(m.tx, { usuarioId: CUENTA, email: "nuevo@noctium.local" });
    expect(m.orden).toEqual(["cambiarEmail", "ficha"]);
  });

  it("mismo email: no se revalida ni se llama a A", async () => {
    m.tx.alumno.findUnique.mockResolvedValue(conCuenta);
    await actualizarContactoAlumno(ALUMNO, { email: "ana@noctium.local", telefono: "0387154123456" }, { telefono: true, email: true }, REGISTRANTE);
    expect(m.cambiarEmail).not.toHaveBeenCalled();
    expect(m.verificarEmail).not.toHaveBeenCalled();
    expect(m.tx.alumno.update).toHaveBeenCalled();
  });

  it("una ficha con cuenta no puede quedarse sin email: EMAIL_REQUERIDO (400) sin guardar", async () => {
    m.tx.alumno.findUnique.mockResolvedValue(conCuenta);
    const error = await capturar(actualizarContactoAlumno(ALUMNO, { telefono: "0387154123456" }, { telefono: true, email: true }, REGISTRANTE));
    expect(error).toMatchObject({ code: "EMAIL_REQUERIDO", status: 400 });
    expect(m.tx.alumno.update).not.toHaveBeenCalled();
  });

  it("email de otra cuenta (lo rechaza A): no se guarda la ficha", async () => {
    m.tx.alumno.findUnique.mockResolvedValue(conCuenta);
    m.cambiarEmail.mockRejectedValue(new ErrorDeDominio("errores.cuenta.emailYaAsociado"));
    const error = await capturar(actualizarContactoAlumno(ALUMNO, { email: "otra@noctium.local" }, { telefono: true, email: true }, REGISTRANTE));
    expect(error).toMatchObject({ code: "EMAIL_YA_ASOCIADO", status: 409 });
    expect(m.tx.alumno.update).not.toHaveBeenCalled();
  });

  it("ficha sin cuenta: verifica con A contra cualquier cuenta y nunca crea una (criterio 8)", async () => {
    m.tx.alumno.findUnique.mockResolvedValue(sinCuenta);
    await actualizarContactoAlumno(ALUMNO, { email: "nuevo@noctium.local" }, { telefono: true, email: true }, REGISTRANTE);
    expect(m.verificarEmail).toHaveBeenCalledWith("nuevo@noctium.local", {}, m.tx);
    expect(m.cambiarEmail).not.toHaveBeenCalled();
    expect(m.crearCuenta).not.toHaveBeenCalled();
  });

  it("ficha sin cuenta: quitar el email sigue permitido (Sprint 1)", async () => {
    m.tx.alumno.findUnique.mockResolvedValue({ ...sinCuenta, emailAlumno: "viejo@noctium.local" });
    await actualizarContactoAlumno(ALUMNO, { telefono: "0387154123456" }, { telefono: true, email: true }, REGISTRANTE);
    expect(m.tx.alumno.update.mock.calls[0]![0]).toMatchObject({ data: { emailAlumno: null } });
  });
});

describe("modificarAlumno (B-06): reemplaza el rechazo de Sprint 1 por la sincronización", () => {
  const conCuenta = { idAlumno: ALUMNO, usuarioId: CUENTA, emailAlumno: "ana@noctium.local" };

  it("ficha con cuenta y email nuevo: cambia la cuenta y guarda la ficha (antes: EMAIL_CUENTA_VINCULADA_NO_MODIFICABLE)", async () => {
    m.tx.alumno.findUnique.mockResolvedValue(conCuenta);
    const r = await modificarAlumno(ALUMNO, { email: "nuevo@noctium.local", version: 2 }, { ...SIN_CAMBIOS, email: true }, REGISTRANTE);
    expect(m.cambiarEmail).toHaveBeenCalledWith(m.tx, { usuarioId: CUENTA, email: "nuevo@noctium.local" });
    expect(r).toEqual({ id: ALUMNO, campos_modificados: ["email"], version: 3 });
  });

  it("edición concurrente: el error deshace también el cambio de la cuenta (misma transacción)", async () => {
    m.tx.alumno.findUnique.mockResolvedValue(conCuenta);
    m.tx.alumno.updateMany.mockResolvedValue({ count: 0 });
    const error = await capturar(modificarAlumno(ALUMNO, { email: "nuevo@noctium.local", version: 2 }, { ...SIN_CAMBIOS, email: true }, REGISTRANTE));
    expect(error).toMatchObject({ code: "CONFLICTO_EDICION_CONCURRENTE" });
    expect(m.cambiarEmail).toHaveBeenCalled();
  });

  it("sin el campo email en el pedido no toca la cuenta", async () => {
    m.tx.alumno.findUnique.mockResolvedValue(conCuenta);
    await modificarAlumno(ALUMNO, { nombre: "Ana María", version: 2 }, { ...SIN_CAMBIOS, nombre: true }, REGISTRANTE);
    expect(m.cambiarEmail).not.toHaveBeenCalled();
    expect(m.verificarEmail).not.toHaveBeenCalled();
  });

  it("ficha con cuenta: quitar el email → EMAIL_REQUERIDO sin guardar", async () => {
    m.tx.alumno.findUnique.mockResolvedValue(conCuenta);
    const error = await capturar(modificarAlumno(ALUMNO, { version: 2 }, { ...SIN_CAMBIOS, email: true }, REGISTRANTE));
    expect(error).toMatchObject({ code: "EMAIL_REQUERIDO" });
    expect(m.tx.alumno.updateMany).not.toHaveBeenCalled();
  });
});
