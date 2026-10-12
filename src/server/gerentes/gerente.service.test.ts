import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

// Servicio de gerentes (spec_modulo_G.md §2.1, §2.2 y §2.4, HU-G-01) con la
// base y el módulo A simulados: orden de los pasos, errores, `esVos` y que la
// contraseña inicial nunca sale del servicio.

const m = vi.hoisted(() => {
  const tx = {
    fichaGerente: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx,
    pasos: [] as string[],
    crearCuenta: vi.fn(),
    cambiarEmail: vi.fn(),
    verificarEmail: vi.fn(),
    resumen: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: m.tx }));
vi.mock("@/server/shared/transaccion", () => ({ transaccion: (fn: (tx: unknown) => unknown) => fn(m.tx) }));
vi.mock("@/server/usuarios/cuenta.service", () => ({
  crearCuentaParaFicha: m.crearCuenta,
  cambiarEmailCuenta: m.cambiarEmail,
  verificarEmailNoAsociadoAOtraCuenta: m.verificarEmail,
  obtenerResumenCuenta: m.resumen,
}));

const { crearGerente, listarGerentes, modificarGerente, obtenerDetalleGerente, verificarDisponibilidadGerente } =
  await import("@/server/gerentes/gerente.service");

const SESION = "ckgerentesesion";
const FICHA = "ckficha";
const CUENTA = "ckcuenta";
const DNI = "27111222";
const RESUMEN = { estado: "ACTIVA", email: "marcos@mail.com", rol: "GERENTE", debe_cambiar_password: true } as const;
const ALTA = {
  nombre: "Marcos",
  apellido: "Ibarra",
  dni: DNI,
  fechaNacimiento: new Date(Date.UTC(1985, 2, 20)),
  email: "marcos@mail.com",
};
const ACTUAL = {
  usuarioId: CUENTA,
  nombreFichaGerente: "Marcos",
  apellidoFichaGerente: "Ibarra",
  dniFichaGerente: DNI,
  fechaNacimientoFichaGerente: new Date(Date.UTC(1985, 2, 20)),
  generoFichaGerente: null,
  telefonoFichaGerente: "01145551234",
  emailFichaGerente: "marcos@mail.com",
  version: 2,
};

function p2002(campo: string) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6",
    meta: { target: [campo] },
  });
}

async function capturar(promesa: Promise<unknown>): Promise<ErrorDeDominio> {
  try {
    await promesa;
  } catch (error) {
    return error as ErrorDeDominio;
  }
  throw new Error("Se esperaba un error");
}

beforeEach(() => {
  vi.resetAllMocks();
  m.pasos.length = 0;
  const { fichaGerente } = m.tx;
  fichaGerente.findFirst.mockImplementation(async () => {
    m.pasos.push("dni");
    return null;
  });
  m.crearCuenta.mockImplementation(async () => {
    m.pasos.push("cuenta");
    return { usuario_id: CUENTA };
  });
  fichaGerente.create.mockImplementation(async ({ data }) => {
    m.pasos.push("ficha");
    return { idFichaGerente: FICHA, ...data };
  });
  fichaGerente.findUnique.mockResolvedValue(ACTUAL);
  fichaGerente.updateMany.mockImplementation(async () => {
    m.pasos.push("updateMany");
    return { count: 1 };
  });
  m.cambiarEmail.mockImplementation(async () => {
    m.pasos.push("cambiarEmail");
    return { cambio: true };
  });
  m.resumen.mockResolvedValue(RESUMEN);
});

describe("crearGerente", () => {
  it("DNI → cuenta GERENTE → ficha activa con creadoPor, version 0 y nombres normalizados", async () => {
    const r = await crearGerente({ ...ALTA, apellido: "Ibarra Núñez", genero: "MASCULINO", telefono: "01145551234" }, SESION, "10.0.0.1");

    expect(m.pasos).toEqual(["dni", "cuenta", "ficha"]);
    expect(m.tx.fichaGerente.findFirst).toHaveBeenCalledWith({
      where: { dniFichaGerente: DNI },
      select: { idFichaGerente: true },
    });
    expect(m.crearCuenta).toHaveBeenCalledWith(m.tx, { email: "marcos@mail.com", dni: DNI, rol: "GERENTE", ip: "10.0.0.1" });
    expect(m.tx.fichaGerente.create).toHaveBeenCalledWith({
      data: {
        usuarioId: CUENTA,
        activoFichaGerente: true,
        nombreFichaGerente: "Marcos",
        apellidoFichaGerente: "Ibarra Núñez",
        nombreNormalizadoFichaGerente: "marcos",
        apellidoNormalizadoFichaGerente: "ibarra nunez",
        dniFichaGerente: DNI,
        fechaNacimientoFichaGerente: ALTA.fechaNacimiento,
        generoFichaGerente: "MASCULINO",
        telefonoFichaGerente: "01145551234",
        emailFichaGerente: "marcos@mail.com",
        creadoPorUsuarioId: SESION,
        version: 0,
      },
    });
    expect(m.resumen).toHaveBeenCalledWith(CUENTA, m.tx);
    expect(r).toEqual({
      id: FICHA,
      nombre: "Marcos",
      apellido: "Ibarra Núñez",
      dni: DNI,
      email: "marcos@mail.com",
      telefono: "01145551234",
      activo: true,
      cuenta: RESUMEN,
    });
  });

  it("sin género ni teléfono: null en la ficha; sin ip, la cuenta recibe undefined", async () => {
    await crearGerente(ALTA, SESION);
    expect(m.crearCuenta).toHaveBeenCalledWith(m.tx, { email: "marcos@mail.com", dni: DNI, rol: "GERENTE", ip: undefined });
    expect(m.tx.fichaGerente.create.mock.calls[0]![0].data).toMatchObject({ generoFichaGerente: null, telefonoFichaGerente: null });
  });

  it("la respuesta nunca trae la contraseña inicial ni un hash", async () => {
    const r = await crearGerente(ALTA, SESION);
    expect(JSON.stringify(r.cuenta)).not.toContain(DNI);
    expect(Object.keys(r)).not.toEqual(expect.arrayContaining(["password", "passwordHash"]));
  });

  it("DNI en uso (activa o inactiva): DNI_DUPLICADO con el texto de gerente, sin crear la cuenta", async () => {
    m.tx.fichaGerente.findFirst.mockResolvedValue({ idFichaGerente: "otra" });
    const error = await capturar(crearGerente(ALTA, SESION));
    expect(error).toMatchObject({ code: "DNI_DUPLICADO", status: 409, message: "Ya existe un gerente registrado con ese DNI" });
    expect(m.crearCuenta).not.toHaveBeenCalled();
    expect(m.tx.fichaGerente.create).not.toHaveBeenCalled();
  });

  it("email de otra cuenta: EMAIL_YA_ASOCIADO de A, sin crear la ficha", async () => {
    m.crearCuenta.mockRejectedValue(new ErrorDeDominio("errores.cuenta.emailYaAsociado"));
    expect(await capturar(crearGerente(ALTA, SESION))).toMatchObject({ code: "EMAIL_YA_ASOCIADO", status: 409 });
    expect(m.tx.fichaGerente.create).not.toHaveBeenCalled();
  });

  it("P2002 del DNI (alta simultánea) → DNI_DUPLICADO; P2002 de emailUsuario → EMAIL_YA_ASOCIADO", async () => {
    m.tx.fichaGerente.create.mockRejectedValueOnce(p2002("dniFichaGerente"));
    expect(await capturar(crearGerente(ALTA, SESION))).toMatchObject({ code: "DNI_DUPLICADO" });
    m.tx.fichaGerente.create.mockRejectedValueOnce(p2002("emailUsuario"));
    expect(await capturar(crearGerente(ALTA, SESION))).toMatchObject({ code: "EMAIL_YA_ASOCIADO" });
  });

  it("un P2002 sobre el DNI de otra tabla u otro error se propaga sin traducir", async () => {
    const otro = p2002("dniFichaMesaEntrada");
    m.tx.fichaGerente.create.mockRejectedValueOnce(otro);
    expect(await capturar(crearGerente(ALTA, SESION))).toBe(otro);
    const usuario = p2002("usuarioId");
    m.tx.fichaGerente.create.mockRejectedValueOnce(usuario);
    expect(await capturar(crearGerente(ALTA, SESION))).toBe(usuario);
  });
});

describe("modificarGerente", () => {
  it("sin cambios respecto de lo guardado: campos_modificados vacío, sin escribir", async () => {
    const r = await modificarGerente(FICHA, { nombre: "Marcos", email: "marcos@mail.com", telefono: "01145551234", version: 2 }, SESION);
    expect(r).toEqual({ id: FICHA, campos_modificados: [], version: 2 });
    expect(m.tx.fichaGerente.updateMany).not.toHaveBeenCalled();
    expect(m.cambiarEmail).not.toHaveBeenCalled();
    expect(m.verificarEmail).not.toHaveBeenCalled();
  });

  it("ficha inexistente: GERENTE_NO_ENCONTRADO 404", async () => {
    m.tx.fichaGerente.findUnique.mockResolvedValue(null);
    expect(await capturar(modificarGerente(FICHA, { version: 0 }, SESION))).toMatchObject({
      code: "GERENTE_NO_ENCONTRADO",
      status: 404,
      message: "El gerente no existe",
    });
  });

  it("solo los campos que cambian, con version + 1, modificadoPor y nombres normalizados", async () => {
    const r = await modificarGerente(FICHA, { apellido: "Álvarez", telefono: null, genero: "OTRO", version: 2 }, SESION);
    expect(m.tx.fichaGerente.updateMany).toHaveBeenCalledWith({
      where: { idFichaGerente: FICHA, version: 2 },
      data: {
        apellidoFichaGerente: "Álvarez",
        telefonoFichaGerente: null,
        generoFichaGerente: "OTRO",
        nombreNormalizadoFichaGerente: "marcos",
        apellidoNormalizadoFichaGerente: "alvarez",
        version: { increment: 1 },
        modificadoPorUsuarioId: SESION,
      },
    });
    expect(r).toEqual({ id: FICHA, campos_modificados: ["apellido", "genero", "telefono"], version: 3 });
  });

  it("sin cambios de nombre ni apellido no recalcula los normalizados", async () => {
    await modificarGerente(FICHA, { fechaNacimiento: new Date(Date.UTC(1984, 0, 1)), version: 2 }, SESION);
    const { data } = m.tx.fichaGerente.updateMany.mock.calls[0]![0];
    expect(data).not.toHaveProperty("nombreNormalizadoFichaGerente");
    expect(data).not.toHaveProperty("apellidoNormalizadoFichaGerente");
    expect(data.fechaNacimientoFichaGerente).toEqual(new Date(Date.UTC(1984, 0, 1)));
  });

  it("DNI nuevo: unicidad excluyendo la propia ficha", async () => {
    await modificarGerente(FICHA, { dni: "40111222", version: 2 }, SESION);
    expect(m.tx.fichaGerente.findFirst).toHaveBeenCalledWith({
      where: { dniFichaGerente: "40111222", NOT: { idFichaGerente: FICHA } },
      select: { idFichaGerente: true },
    });
    m.tx.fichaGerente.findFirst.mockResolvedValue({ idFichaGerente: "otra" });
    expect(await capturar(modificarGerente(FICHA, { dni: "40111222", version: 2 }, SESION))).toMatchObject({
      code: "DNI_DUPLICADO",
      message: "Ya existe un gerente registrado con ese DNI",
    });
  });

  it("version vieja: CONFLICTO_EDICION_CONCURRENTE 409, sin tocar la cuenta", async () => {
    m.tx.fichaGerente.updateMany.mockResolvedValue({ count: 0 });
    const error = await capturar(modificarGerente(FICHA, { email: "nuevo@mail.com", version: 1 }, SESION));
    expect(error).toMatchObject({
      code: "CONFLICTO_EDICION_CONCURRENTE",
      status: 409,
      message: "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales.",
    });
    expect(m.cambiarEmail).not.toHaveBeenCalled();
  });

  it("email nuevo con cuenta: primero la ficha y después cambiarEmailCuenta; no revoca sesiones ni verifica aparte", async () => {
    await modificarGerente(FICHA, { email: "nuevo@mail.com", version: 2 }, SESION);
    expect(m.pasos).toEqual(["updateMany", "cambiarEmail"]);
    expect(m.cambiarEmail).toHaveBeenCalledWith(m.tx, { usuarioId: CUENTA, email: "nuevo@mail.com" });
    expect(m.verificarEmail).not.toHaveBeenCalled();
  });

  it("DEC-44: el gerente cambia su propio email con el mismo camino, sin ninguna revocación", async () => {
    // La ficha es la de quien modifica: usuarioId de la ficha = sesión.
    m.tx.fichaGerente.findUnique.mockResolvedValue({ ...ACTUAL, usuarioId: SESION });
    const r = await modificarGerente(FICHA, { email: "propio@mail.com", version: 2 }, SESION);
    expect(r).toEqual({ id: FICHA, campos_modificados: ["email"], version: 3 });
    expect(m.cambiarEmail).toHaveBeenCalledWith(m.tx, { usuarioId: SESION, email: "propio@mail.com" });
    expect(m.tx.fichaGerente.updateMany.mock.calls[0]![0].data).toMatchObject({ modificadoPorUsuarioId: SESION });
  });

  it("email de otra cuenta: el EMAIL_YA_ASOCIADO de A se propaga (la transacción revierte la ficha)", async () => {
    m.cambiarEmail.mockRejectedValue(new ErrorDeDominio("errores.cuenta.emailYaAsociado"));
    expect(await capturar(modificarGerente(FICHA, { email: "ocupado@mail.com", version: 2 }, SESION))).toMatchObject({
      code: "EMAIL_YA_ASOCIADO",
    });
  });

  it("ficha sin cuenta: el email nuevo se verifica contra las cuentas y no se crea ninguna", async () => {
    m.tx.fichaGerente.findUnique.mockResolvedValue({ ...ACTUAL, usuarioId: null });
    await modificarGerente(FICHA, { email: "nuevo@mail.com", version: 2 }, SESION);
    expect(m.verificarEmail).toHaveBeenCalledWith("nuevo@mail.com", {}, m.tx);
    expect(m.cambiarEmail).not.toHaveBeenCalled();
    expect(m.crearCuenta).not.toHaveBeenCalled();
  });

  it("cambiar el DNI no toca la cuenta", async () => {
    await modificarGerente(FICHA, { dni: "40111222", version: 2 }, SESION);
    expect(m.cambiarEmail).not.toHaveBeenCalled();
    expect(m.crearCuenta).not.toHaveBeenCalled();
  });

  it("P2002 del DNI (modificación simultánea) → DNI_DUPLICADO", async () => {
    m.tx.fichaGerente.updateMany.mockRejectedValue(p2002("dniFichaGerente"));
    expect(await capturar(modificarGerente(FICHA, { dni: "40111222", version: 2 }, SESION))).toMatchObject({ code: "DNI_DUPLICADO" });
  });
});

describe("obtenerDetalleGerente", () => {
  const FILA = {
    idFichaGerente: FICHA,
    usuarioId: CUENTA,
    activoFichaGerente: false,
    nombreFichaGerente: "Marcos",
    apellidoFichaGerente: "Ibarra",
    dniFichaGerente: DNI,
    fechaNacimientoFichaGerente: new Date(Date.UTC(1985, 2, 20)),
    generoFichaGerente: "MASCULINO",
    telefonoFichaGerente: null,
    emailFichaGerente: "marcos@mail.com",
    creadoPorUsuarioId: SESION,
    modificadoPorUsuarioId: null,
    createdAtFichaGerente: new Date("2026-10-01T12:00:00.000Z"),
    updatedAtFichaGerente: new Date("2026-10-01T12:00:00.000Z"),
    version: 0,
  };

  it("datos, version, fechas y la cuenta de A; sin modificación, modificadoEl null; ficha ajena: esVos false", async () => {
    m.tx.fichaGerente.findUnique.mockResolvedValue(FILA);
    expect(await obtenerDetalleGerente(FICHA, SESION)).toEqual({
      id: FICHA,
      version: 0,
      activo: false,
      nombre: "Marcos",
      apellido: "Ibarra",
      dni: DNI,
      fechaNacimiento: "1985-03-20",
      genero: "MASCULINO",
      telefono: null,
      email: "marcos@mail.com",
      creadoEl: FILA.createdAtFichaGerente,
      modificadoEl: null,
      cuenta: RESUMEN,
      esVos: false,
    });
    expect(m.resumen).toHaveBeenCalledWith(CUENTA, m.tx);
  });

  it("esVos es true solo con la ficha propia", async () => {
    m.tx.fichaGerente.findUnique.mockResolvedValue({ ...FILA, usuarioId: SESION });
    expect((await obtenerDetalleGerente(FICHA, SESION)).esVos).toBe(true);
    m.tx.fichaGerente.findUnique.mockResolvedValue({ ...FILA, usuarioId: null });
    expect((await obtenerDetalleGerente(FICHA, SESION)).esVos).toBe(false);
  });

  it("modificada: modificadoEl es la última modificación", async () => {
    const updatedAt = new Date("2026-10-05T09:00:00.000Z");
    m.tx.fichaGerente.findUnique.mockResolvedValue({ ...FILA, modificadoPorUsuarioId: SESION, updatedAtFichaGerente: updatedAt, version: 1 });
    expect((await obtenerDetalleGerente(FICHA, SESION)).modificadoEl).toBe(updatedAt);
  });

  it("inexistente: GERENTE_NO_ENCONTRADO", async () => {
    m.tx.fichaGerente.findUnique.mockResolvedValue(null);
    expect(await capturar(obtenerDetalleGerente("nada", SESION))).toMatchObject({ code: "GERENTE_NO_ENCONTRADO", status: 404 });
  });
});

describe("listarGerentes", () => {
  it("todas las fichas, activas e inactivas, en orden apellido, nombre y DNI; total = cantidad", async () => {
    m.tx.fichaGerente.findMany.mockResolvedValue([
      {
        idFichaGerente: "a",
        apellidoFichaGerente: "Ibarra",
        nombreFichaGerente: "Marcos",
        dniFichaGerente: DNI,
        telefonoFichaGerente: null,
        emailFichaGerente: "marcos@mail.com",
        activoFichaGerente: false,
      },
    ]);
    expect(await listarGerentes()).toEqual({
      items: [{ id: "a", apellido: "Ibarra", nombre: "Marcos", dni: DNI, telefono: null, email: "marcos@mail.com", activo: false }],
      total: 1,
    });
    const args = m.tx.fichaGerente.findMany.mock.calls[0]![0];
    expect(args.where).toBeUndefined();
    expect(args.orderBy).toEqual([
      { apellidoNormalizadoFichaGerente: "asc" },
      { nombreNormalizadoFichaGerente: "asc" },
      { dniFichaGerente: "asc" },
    ]);
    expect(args.skip).toBeUndefined();
    expect(args.take).toBeUndefined();
  });
});

describe("verificarDisponibilidadGerente", () => {
  it("DNI y email libres", async () => {
    expect(await verificarDisponibilidadGerente({ dni: DNI, email: "libre@mail.com" })).toEqual({
      dni_disponible: true,
      email_disponible: true,
    });
    expect(m.verificarEmail).toHaveBeenCalledWith("libre@mail.com", { excluirUsuarioId: null }, m.tx);
  });

  it("en uso: solo dice que no está disponible, nunca de quién es", async () => {
    m.tx.fichaGerente.findFirst.mockResolvedValue({ idFichaGerente: "otra" });
    m.verificarEmail.mockRejectedValue(new ErrorDeDominio("errores.cuenta.emailYaAsociado"));
    expect(await verificarDisponibilidadGerente({ dni: DNI, email: "ocupado@mail.com" })).toEqual({
      dni_disponible: false,
      email_disponible: false,
    });
  });

  it("al editar excluye la propia ficha y su cuenta", async () => {
    m.tx.fichaGerente.findUnique.mockResolvedValue({ usuarioId: CUENTA });
    await verificarDisponibilidadGerente({ dni: DNI, email: "marcos@mail.com", excluirId: FICHA });
    expect(m.tx.fichaGerente.findFirst).toHaveBeenCalledWith({
      where: { dniFichaGerente: DNI, NOT: { idFichaGerente: FICHA } },
      select: { idFichaGerente: true },
    });
    expect(m.verificarEmail).toHaveBeenCalledWith("marcos@mail.com", { excluirUsuarioId: CUENTA }, m.tx);
  });

  it("excluirId de una ficha que no existe: GERENTE_NO_ENCONTRADO, sin consultar el DNI ni el email", async () => {
    m.tx.fichaGerente.findUnique.mockResolvedValue(null);
    expect(await capturar(verificarDisponibilidadGerente({ dni: DNI, email: "x@mail.com", excluirId: "no-existe" }))).toMatchObject({
      code: "GERENTE_NO_ENCONTRADO",
      status: 404,
    });
    expect(m.tx.fichaGerente.findFirst).not.toHaveBeenCalled();
    expect(m.verificarEmail).not.toHaveBeenCalled();
  });

  it("un campo ausente cuenta como disponible y no se consulta", async () => {
    expect(await verificarDisponibilidadGerente({})).toEqual({ dni_disponible: true, email_disponible: true });
    expect(m.tx.fichaGerente.findFirst).not.toHaveBeenCalled();
    expect(m.verificarEmail).not.toHaveBeenCalled();
  });

  it("otro error de la verificación se propaga", async () => {
    m.verificarEmail.mockRejectedValue(new Error("base caída"));
    await expect(verificarDisponibilidadGerente({ email: "x@mail.com" })).rejects.toThrow("base caída");
  });
});
