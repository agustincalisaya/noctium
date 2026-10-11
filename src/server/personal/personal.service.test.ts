import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

// Servicio del personal de mesa de entrada (spec_modulo_F.md §2.1 a §2.4,
// HU-F-01) con la base y el módulo A simulados: orden de los pasos, errores y
// que la contraseña inicial nunca sale del servicio.

const m = vi.hoisted(() => {
  const tx = {
    fichaMesaEntrada: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
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

const { crearIntegrante, listarPersonal, modificarIntegrante, obtenerDetalleIntegrante, verificarDisponibilidadIntegrante } =
  await import("@/server/personal/personal.service");

const GERENTE = "ckgerente";
const FICHA = "ckficha";
const CUENTA = "ckcuenta";
const DNI = "30123456";
const RESUMEN = { estado: "ACTIVA", email: "lucia@mail.com", rol: "MESA_ENTRADA", debe_cambiar_password: true } as const;
const ALTA = {
  nombre: "Lucía",
  apellido: "Fernández",
  dni: DNI,
  fechaNacimiento: new Date(Date.UTC(1990, 3, 12)),
  email: "lucia@mail.com",
};
const ACTUAL = {
  usuarioId: CUENTA,
  nombreFichaMesaEntrada: "Lucía",
  apellidoFichaMesaEntrada: "Fernández",
  dniFichaMesaEntrada: DNI,
  fechaNacimientoFichaMesaEntrada: new Date(Date.UTC(1990, 3, 12)),
  generoFichaMesaEntrada: null,
  telefonoFichaMesaEntrada: "01145551234",
  emailFichaMesaEntrada: "lucia@mail.com",
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
  const { fichaMesaEntrada } = m.tx;
  fichaMesaEntrada.findFirst.mockImplementation(async () => {
    m.pasos.push("dni");
    return null;
  });
  m.crearCuenta.mockImplementation(async () => {
    m.pasos.push("cuenta");
    return { usuario_id: CUENTA };
  });
  fichaMesaEntrada.create.mockImplementation(async ({ data }) => {
    m.pasos.push("ficha");
    return { idFichaMesaEntrada: FICHA, ...data };
  });
  fichaMesaEntrada.findUnique.mockResolvedValue(ACTUAL);
  fichaMesaEntrada.updateMany.mockImplementation(async () => {
    m.pasos.push("updateMany");
    return { count: 1 };
  });
  m.cambiarEmail.mockImplementation(async () => {
    m.pasos.push("cambiarEmail");
    return { cambio: true };
  });
  m.resumen.mockResolvedValue(RESUMEN);
});

describe("crearIntegrante", () => {
  it("DNI → cuenta MESA_ENTRADA → ficha activa con creadoPor, version 0 y nombres normalizados", async () => {
    const r = await crearIntegrante({ ...ALTA, genero: "FEMENINO", telefono: "01145551234" }, GERENTE, "10.0.0.1");

    expect(m.pasos).toEqual(["dni", "cuenta", "ficha"]);
    expect(m.tx.fichaMesaEntrada.findFirst).toHaveBeenCalledWith({
      where: { dniFichaMesaEntrada: DNI },
      select: { idFichaMesaEntrada: true },
    });
    expect(m.crearCuenta).toHaveBeenCalledWith(m.tx, { email: "lucia@mail.com", dni: DNI, rol: "MESA_ENTRADA", ip: "10.0.0.1" });
    expect(m.tx.fichaMesaEntrada.create).toHaveBeenCalledWith({
      data: {
        usuarioId: CUENTA,
        activoFichaMesaEntrada: true,
        nombreFichaMesaEntrada: "Lucía",
        apellidoFichaMesaEntrada: "Fernández",
        nombreNormalizadoFichaMesaEntrada: "lucia",
        apellidoNormalizadoFichaMesaEntrada: "fernandez",
        dniFichaMesaEntrada: DNI,
        fechaNacimientoFichaMesaEntrada: ALTA.fechaNacimiento,
        generoFichaMesaEntrada: "FEMENINO",
        telefonoFichaMesaEntrada: "01145551234",
        emailFichaMesaEntrada: "lucia@mail.com",
        creadoPorUsuarioId: GERENTE,
        version: 0,
      },
    });
    expect(m.resumen).toHaveBeenCalledWith(CUENTA, m.tx);
    expect(r).toEqual({
      id: FICHA,
      nombre: "Lucía",
      apellido: "Fernández",
      dni: DNI,
      email: "lucia@mail.com",
      telefono: "01145551234",
      activo: true,
      cuenta: RESUMEN,
    });
  });

  it("la respuesta nunca trae la contraseña inicial ni un hash", async () => {
    const r = await crearIntegrante(ALTA, GERENTE);
    expect(JSON.stringify(r.cuenta)).not.toContain(DNI);
    expect(Object.keys(r)).not.toEqual(expect.arrayContaining(["password", "passwordHash"]));
  });

  it("DNI en uso (activa o inactiva): DNI_DUPLICADO sin crear la cuenta", async () => {
    m.tx.fichaMesaEntrada.findFirst.mockResolvedValue({ idFichaMesaEntrada: "otra" });
    const error = await capturar(crearIntegrante(ALTA, GERENTE));
    expect(error).toMatchObject({ code: "DNI_DUPLICADO", status: 409, message: "Ya existe un integrante de mesa de entrada con ese DNI" });
    expect(m.crearCuenta).not.toHaveBeenCalled();
    expect(m.tx.fichaMesaEntrada.create).not.toHaveBeenCalled();
  });

  it("email de otra cuenta: EMAIL_YA_ASOCIADO de A, sin crear la ficha", async () => {
    m.crearCuenta.mockRejectedValue(new ErrorDeDominio("errores.cuenta.emailYaAsociado"));
    expect(await capturar(crearIntegrante(ALTA, GERENTE))).toMatchObject({ code: "EMAIL_YA_ASOCIADO", status: 409 });
    expect(m.tx.fichaMesaEntrada.create).not.toHaveBeenCalled();
  });

  it("P2002 del DNI (alta simultánea) → DNI_DUPLICADO; P2002 de emailUsuario → EMAIL_YA_ASOCIADO", async () => {
    m.tx.fichaMesaEntrada.create.mockRejectedValueOnce(p2002("dniFichaMesaEntrada"));
    expect(await capturar(crearIntegrante(ALTA, GERENTE))).toMatchObject({ code: "DNI_DUPLICADO" });
    m.tx.fichaMesaEntrada.create.mockRejectedValueOnce(p2002("emailUsuario"));
    expect(await capturar(crearIntegrante(ALTA, GERENTE))).toMatchObject({ code: "EMAIL_YA_ASOCIADO" });
  });

  it("otro P2002 u otro error se propaga sin traducir", async () => {
    const otro = p2002("usuarioId");
    m.tx.fichaMesaEntrada.create.mockRejectedValueOnce(otro);
    expect(await capturar(crearIntegrante(ALTA, GERENTE))).toBe(otro);
  });
});

describe("modificarIntegrante", () => {
  it("sin cambios respecto de lo guardado: campos_modificados vacío, sin escribir", async () => {
    const r = await modificarIntegrante(FICHA, { nombre: "Lucía", email: "lucia@mail.com", telefono: "01145551234", version: 2 }, GERENTE);
    expect(r).toEqual({ id: FICHA, campos_modificados: [], version: 2 });
    expect(m.tx.fichaMesaEntrada.updateMany).not.toHaveBeenCalled();
    expect(m.cambiarEmail).not.toHaveBeenCalled();
    expect(m.verificarEmail).not.toHaveBeenCalled();
  });

  it("ficha inexistente: INTEGRANTE_NO_ENCONTRADO 404", async () => {
    m.tx.fichaMesaEntrada.findUnique.mockResolvedValue(null);
    expect(await capturar(modificarIntegrante(FICHA, { version: 0 }, GERENTE))).toMatchObject({
      code: "INTEGRANTE_NO_ENCONTRADO",
      status: 404,
      message: "El integrante no existe",
    });
  });

  it("solo los campos que cambian, con version + 1, modificadoPor y nombres normalizados", async () => {
    const r = await modificarIntegrante(FICHA, { apellido: "Álvarez", telefono: null, genero: "OTRO", version: 2 }, GERENTE);
    expect(m.tx.fichaMesaEntrada.updateMany).toHaveBeenCalledWith({
      where: { idFichaMesaEntrada: FICHA, version: 2 },
      data: {
        apellidoFichaMesaEntrada: "Álvarez",
        telefonoFichaMesaEntrada: null,
        generoFichaMesaEntrada: "OTRO",
        nombreNormalizadoFichaMesaEntrada: "lucia",
        apellidoNormalizadoFichaMesaEntrada: "alvarez",
        version: { increment: 1 },
        modificadoPorUsuarioId: GERENTE,
      },
    });
    expect(r).toEqual({ id: FICHA, campos_modificados: ["apellido", "genero", "telefono"], version: 3 });
  });

  it("DNI nuevo: unicidad excluyendo la propia ficha", async () => {
    await modificarIntegrante(FICHA, { dni: "40111222", version: 2 }, GERENTE);
    expect(m.tx.fichaMesaEntrada.findFirst).toHaveBeenCalledWith({
      where: { dniFichaMesaEntrada: "40111222", NOT: { idFichaMesaEntrada: FICHA } },
      select: { idFichaMesaEntrada: true },
    });
    m.tx.fichaMesaEntrada.findFirst.mockResolvedValue({ idFichaMesaEntrada: "otra" });
    expect(await capturar(modificarIntegrante(FICHA, { dni: "40111222", version: 2 }, GERENTE))).toMatchObject({ code: "DNI_DUPLICADO" });
  });

  it("version vieja: CONFLICTO_EDICION_CONCURRENTE 409, sin tocar la cuenta", async () => {
    m.tx.fichaMesaEntrada.updateMany.mockResolvedValue({ count: 0 });
    const error = await capturar(modificarIntegrante(FICHA, { email: "nuevo@mail.com", version: 1 }, GERENTE));
    expect(error).toMatchObject({
      code: "CONFLICTO_EDICION_CONCURRENTE",
      status: 409,
      message: "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales.",
    });
    expect(m.cambiarEmail).not.toHaveBeenCalled();
  });

  it("email nuevo con cuenta: primero la ficha y después cambiarEmailCuenta; no revoca sesiones ni verifica aparte", async () => {
    await modificarIntegrante(FICHA, { email: "nuevo@mail.com", version: 2 }, GERENTE);
    expect(m.pasos).toEqual(["updateMany", "cambiarEmail"]);
    expect(m.cambiarEmail).toHaveBeenCalledWith(m.tx, { usuarioId: CUENTA, email: "nuevo@mail.com" });
    expect(m.verificarEmail).not.toHaveBeenCalled();
  });

  it("email de otra cuenta: el EMAIL_YA_ASOCIADO de A se propaga (la transacción revierte la ficha)", async () => {
    m.cambiarEmail.mockRejectedValue(new ErrorDeDominio("errores.cuenta.emailYaAsociado"));
    expect(await capturar(modificarIntegrante(FICHA, { email: "ocupado@mail.com", version: 2 }, GERENTE))).toMatchObject({
      code: "EMAIL_YA_ASOCIADO",
    });
  });

  it("ficha sin cuenta: el email nuevo se verifica contra las cuentas y no se crea ninguna", async () => {
    m.tx.fichaMesaEntrada.findUnique.mockResolvedValue({ ...ACTUAL, usuarioId: null });
    await modificarIntegrante(FICHA, { email: "nuevo@mail.com", version: 2 }, GERENTE);
    expect(m.verificarEmail).toHaveBeenCalledWith("nuevo@mail.com", {}, m.tx);
    expect(m.cambiarEmail).not.toHaveBeenCalled();
    expect(m.crearCuenta).not.toHaveBeenCalled();
  });

  it("cambiar el DNI no toca la cuenta", async () => {
    await modificarIntegrante(FICHA, { dni: "40111222", version: 2 }, GERENTE);
    expect(m.cambiarEmail).not.toHaveBeenCalled();
    expect(m.crearCuenta).not.toHaveBeenCalled();
  });

  it("P2002 del DNI (modificación simultánea) → DNI_DUPLICADO", async () => {
    m.tx.fichaMesaEntrada.updateMany.mockRejectedValue(p2002("dniFichaMesaEntrada"));
    expect(await capturar(modificarIntegrante(FICHA, { dni: "40111222", version: 2 }, GERENTE))).toMatchObject({ code: "DNI_DUPLICADO" });
  });
});

describe("obtenerDetalleIntegrante", () => {
  const FILA = {
    idFichaMesaEntrada: FICHA,
    usuarioId: CUENTA,
    activoFichaMesaEntrada: false,
    nombreFichaMesaEntrada: "Lucía",
    apellidoFichaMesaEntrada: "Fernández",
    dniFichaMesaEntrada: DNI,
    fechaNacimientoFichaMesaEntrada: new Date(Date.UTC(1986, 8, 3)),
    generoFichaMesaEntrada: "FEMENINO",
    telefonoFichaMesaEntrada: null,
    emailFichaMesaEntrada: "lucia@mail.com",
    creadoPorUsuarioId: GERENTE,
    modificadoPorUsuarioId: null,
    createdAtFichaMesaEntrada: new Date("2026-10-01T12:00:00.000Z"),
    updatedAtFichaMesaEntrada: new Date("2026-10-01T12:00:00.000Z"),
    version: 0,
  };

  it("datos, version, fechas y la cuenta de A; sin modificación, modificadoEl null", async () => {
    m.tx.fichaMesaEntrada.findUnique.mockResolvedValue(FILA);
    expect(await obtenerDetalleIntegrante(FICHA)).toEqual({
      id: FICHA,
      version: 0,
      activo: false,
      nombre: "Lucía",
      apellido: "Fernández",
      dni: DNI,
      fechaNacimiento: "1986-09-03",
      genero: "FEMENINO",
      telefono: null,
      email: "lucia@mail.com",
      creadoEl: FILA.createdAtFichaMesaEntrada,
      modificadoEl: null,
      cuenta: RESUMEN,
    });
    expect(m.resumen).toHaveBeenCalledWith(CUENTA, m.tx);
  });

  it("modificada: modificadoEl es la última modificación", async () => {
    const updatedAt = new Date("2026-10-05T09:00:00.000Z");
    m.tx.fichaMesaEntrada.findUnique.mockResolvedValue({ ...FILA, modificadoPorUsuarioId: GERENTE, updatedAtFichaMesaEntrada: updatedAt, version: 1 });
    expect((await obtenerDetalleIntegrante(FICHA)).modificadoEl).toBe(updatedAt);
  });

  it("inexistente: INTEGRANTE_NO_ENCONTRADO", async () => {
    m.tx.fichaMesaEntrada.findUnique.mockResolvedValue(null);
    expect(await capturar(obtenerDetalleIntegrante("nada"))).toMatchObject({ code: "INTEGRANTE_NO_ENCONTRADO" });
  });
});

describe("listarPersonal", () => {
  const FILA = {
    idFichaMesaEntrada: FICHA,
    apellidoFichaMesaEntrada: "Fernández",
    nombreFichaMesaEntrada: "Lucía",
    dniFichaMesaEntrada: DNI,
    telefonoFichaMesaEntrada: null,
    emailFichaMesaEntrada: "lucia@mail.com",
    activoFichaMesaEntrada: false,
  };

  // HU-F-01 dejaba el listado completo sin paginar; HU-F-03 suma la query
  // ({ pagina, q }) y la paginación. Se conservan las aserciones de F-01
  // (activos e inactivos, orden y forma de cada fila) y se suman las nuevas.
  it("activos e inactivos, por apellido, nombre y DNI, sin filtro y en la página 1", async () => {
    m.tx.fichaMesaEntrada.count.mockResolvedValue(1);
    m.tx.fichaMesaEntrada.findMany.mockResolvedValue([FILA]);
    expect(await listarPersonal({ pagina: 1 })).toEqual({
      items: [{ id: FICHA, apellido: "Fernández", nombre: "Lucía", dni: DNI, telefono: null, email: "lucia@mail.com", activo: false }],
      pagina: 1,
      por_pagina: 10,
      total: 1,
      total_paginas: 1,
    });
    const consulta = m.tx.fichaMesaEntrada.findMany.mock.calls[0]![0];
    expect(consulta.where).toBeUndefined();
    expect(m.tx.fichaMesaEntrada.count).toHaveBeenCalledWith({ where: undefined });
    expect(consulta.orderBy).toEqual([
      { apellidoNormalizadoFichaMesaEntrada: "asc" },
      { nombreNormalizadoFichaMesaEntrada: "asc" },
      { dniFichaMesaEntrada: "asc" },
    ]);
    expect(consulta).toMatchObject({ skip: 0, take: 10 });
  });

  it("pagina de a 10 con skip/take y el total del resultado filtrado", async () => {
    m.tx.fichaMesaEntrada.count.mockResolvedValue(23);
    m.tx.fichaMesaEntrada.findMany.mockResolvedValue([]);
    const r = await listarPersonal({ pagina: 2, q: "garc 8806" });
    expect(r).toMatchObject({ pagina: 2, por_pagina: 10, total: 23, total_paginas: 3 });
    const consulta = m.tx.fichaMesaEntrada.findMany.mock.calls[0]![0];
    expect(consulta).toMatchObject({ skip: 10, take: 10 });
    // El mismo filtro para contar y para traer las filas.
    expect(m.tx.fichaMesaEntrada.count).toHaveBeenCalledWith({ where: consulta.where });
    expect(consulta.where).toEqual({
      AND: [
        { OR: [{ apellidoNormalizadoFichaMesaEntrada: { contains: "garc" } }, { nombreNormalizadoFichaMesaEntrada: { contains: "garc" } }] },
        {
          OR: [
            { apellidoNormalizadoFichaMesaEntrada: { contains: "8806" } },
            { nombreNormalizadoFichaMesaEntrada: { contains: "8806" } },
            { dniFichaMesaEntrada: { contains: "8806" } },
          ],
        },
      ],
    });
  });

  it("una página fuera de rango se lleva a la última, como en alumnos", async () => {
    m.tx.fichaMesaEntrada.count.mockResolvedValue(23);
    m.tx.fichaMesaEntrada.findMany.mockResolvedValue([]);
    expect(await listarPersonal({ pagina: 9 })).toMatchObject({ pagina: 3, total_paginas: 3 });
    expect(m.tx.fichaMesaEntrada.findMany.mock.calls[0]![0]).toMatchObject({ skip: 20, take: 10 });
  });

  it("sin resultados: página 1, total_paginas 0 e items vacío", async () => {
    m.tx.fichaMesaEntrada.count.mockResolvedValue(0);
    m.tx.fichaMesaEntrada.findMany.mockResolvedValue([]);
    expect(await listarPersonal({ pagina: 4, q: "zzz" })).toEqual({ items: [], pagina: 1, por_pagina: 10, total: 0, total_paginas: 0 });
    expect(m.tx.fichaMesaEntrada.findMany.mock.calls[0]![0]).toMatchObject({ skip: 0 });
  });

  it("un q de menos de 2 caracteres no filtra", async () => {
    m.tx.fichaMesaEntrada.count.mockResolvedValue(0);
    m.tx.fichaMesaEntrada.findMany.mockResolvedValue([]);
    await listarPersonal({ pagina: 1, q: "a" });
    expect(m.tx.fichaMesaEntrada.findMany.mock.calls[0]![0].where).toBeUndefined();
  });

  it("solo lee: no escribe nada", async () => {
    m.tx.fichaMesaEntrada.count.mockResolvedValue(0);
    m.tx.fichaMesaEntrada.findMany.mockResolvedValue([]);
    await listarPersonal({ pagina: 1, q: "lucia" });
    expect(m.tx.fichaMesaEntrada.create).not.toHaveBeenCalled();
    expect(m.tx.fichaMesaEntrada.updateMany).not.toHaveBeenCalled();
  });
});

describe("verificarDisponibilidadIntegrante", () => {
  it("DNI y email libres", async () => {
    expect(await verificarDisponibilidadIntegrante({ dni: DNI, email: "libre@mail.com" })).toEqual({
      dni_disponible: true,
      email_disponible: true,
    });
    expect(m.verificarEmail).toHaveBeenCalledWith("libre@mail.com", { excluirUsuarioId: null }, m.tx);
  });

  it("en uso: solo dice que no está disponible, nunca de quién es", async () => {
    m.tx.fichaMesaEntrada.findFirst.mockResolvedValue({ idFichaMesaEntrada: "otra" });
    m.verificarEmail.mockRejectedValue(new ErrorDeDominio("errores.cuenta.emailYaAsociado"));
    expect(await verificarDisponibilidadIntegrante({ dni: DNI, email: "ocupado@mail.com" })).toEqual({
      dni_disponible: false,
      email_disponible: false,
    });
  });

  it("al editar excluye la propia ficha y su cuenta", async () => {
    m.tx.fichaMesaEntrada.findUnique.mockResolvedValue({ usuarioId: CUENTA });
    await verificarDisponibilidadIntegrante({ dni: DNI, email: "lucia@mail.com", excluirId: FICHA });
    expect(m.tx.fichaMesaEntrada.findFirst).toHaveBeenCalledWith({
      where: { dniFichaMesaEntrada: DNI, NOT: { idFichaMesaEntrada: FICHA } },
      select: { idFichaMesaEntrada: true },
    });
    expect(m.verificarEmail).toHaveBeenCalledWith("lucia@mail.com", { excluirUsuarioId: CUENTA }, m.tx);
  });

  it("excluirId de una ficha que no existe: INTEGRANTE_NO_ENCONTRADO, sin consultar el DNI ni el email", async () => {
    m.tx.fichaMesaEntrada.findUnique.mockResolvedValue(null);
    expect(await capturar(verificarDisponibilidadIntegrante({ dni: DNI, email: "x@mail.com", excluirId: "no-existe" }))).toMatchObject({
      code: "INTEGRANTE_NO_ENCONTRADO",
      status: 404,
    });
    expect(m.tx.fichaMesaEntrada.findFirst).not.toHaveBeenCalled();
    expect(m.verificarEmail).not.toHaveBeenCalled();
  });

  it("un campo ausente cuenta como disponible y no se consulta", async () => {
    expect(await verificarDisponibilidadIntegrante({})).toEqual({ dni_disponible: true, email_disponible: true });
    expect(m.tx.fichaMesaEntrada.findFirst).not.toHaveBeenCalled();
    expect(m.verificarEmail).not.toHaveBeenCalled();
  });

  it("otro error de la verificación se propaga", async () => {
    m.verificarEmail.mockRejectedValue(new Error("base caída"));
    await expect(verificarDisponibilidadIntegrante({ email: "x@mail.com" })).rejects.toThrow("base caída");
  });
});
