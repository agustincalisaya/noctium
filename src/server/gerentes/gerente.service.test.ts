import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

// Servicio de gerentes (spec_modulo_G.md §2.1 a §2.6, HU-G-01 y HU-G-05) con
// la base y el módulo A simulados: orden de los pasos, errores, `esVos`, el
// detalle ampliado, la baja y la reactivación, y que la contraseña inicial
// nunca sale del servicio.

const m = vi.hoisted(() => {
  const tx = {
    fichaGerente: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx,
    pasos: [] as string[],
    crearCuenta: vi.fn(),
    cambiarEmail: vi.fn(),
    verificarEmail: vi.fn(),
    resumen: vi.fn(),
    desactivarCuenta: vi.fn(),
    reactivarCuenta: vi.fn(),
    filtrarActivas: vi.fn(),
    revocarSesiones: vi.fn(),
    bloquear: vi.fn(),
    registroOperaciones: vi.fn(),
    registrarCambio: vi.fn(),
    listarHistorial: vi.fn(),
    nombres: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: m.tx }));
vi.mock("@/server/shared/transaccion", () => ({ transaccion: (fn: (tx: unknown) => unknown) => fn(m.tx) }));
vi.mock("@/server/usuarios/cuenta.service", () => ({
  crearCuentaParaFicha: m.crearCuenta,
  cambiarEmailCuenta: m.cambiarEmail,
  verificarEmailNoAsociadoAOtraCuenta: m.verificarEmail,
  obtenerResumenCuenta: m.resumen,
  desactivarCuenta: m.desactivarCuenta,
  reactivarCuenta: m.reactivarCuenta,
  filtrarCuentasActivas: m.filtrarActivas,
  revocarSesiones: m.revocarSesiones,
}));
vi.mock("@/server/shared/bloquear", () => ({ bloquear: m.bloquear }));
vi.mock("@/server/shared/actividad-usuario", () => ({ usuarioRegistroOperaciones: m.registroOperaciones }));
vi.mock("@/server/shared/historial-estados", () => ({
  registrarCambioEstado: m.registrarCambio,
  listarHistorialEstados: m.listarHistorial,
}));
vi.mock("@/server/personal/personal.publico", () => ({ obtenerNombresPersonal: m.nombres }));

const {
  crearGerente,
  desactivarGerente,
  listarGerentes,
  modificarGerente,
  obtenerDetalleGerente,
  reactivarGerente,
  verificarDisponibilidadGerente,
} = await import("@/server/gerentes/gerente.service");
const { actorUsuario, PROCESO_AUTOMATICO } = await import("@/server/shared/historial");

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
  m.listarHistorial.mockResolvedValue([]);
  m.nombres.mockResolvedValue([]);
  m.registroOperaciones.mockResolvedValue(false);
  m.filtrarActivas.mockImplementation(async (_db: unknown, ids: string[]) => ids);
  m.tx.fichaGerente.findMany.mockResolvedValue([]);
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
      historialEstados: [],
      motivoObligatorioAlDesactivar: false,
      esUltimoGerenteActivo: false,
    });
    expect(m.resumen).toHaveBeenCalledWith(CUENTA, m.tx);
    expect(m.listarHistorial).toHaveBeenCalledWith("FICHA_GERENTE", FICHA, m.tx);
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


  it("historial del más reciente al más antiguo, en camelCase y con el nombre de quien actuó", async () => {
    m.tx.fichaGerente.findUnique.mockResolvedValue(FILA);
    const reactivo = { id: "h2", accion: "REACTIVAR", motivo: null, fecha: new Date(2000), actor_tipo: "USUARIO", usuario_id: SESION };
    const dioBaja = { id: "h1", accion: "DESACTIVAR", motivo: "Licencia", fecha: new Date(1000), actor_tipo: "USUARIO", usuario_id: "ckotro" };
    const automatico = { id: "h0", accion: "DESACTIVAR", motivo: null, fecha: new Date(500), actor_tipo: "PROCESO_AUTOMATICO", usuario_id: null };
    m.listarHistorial.mockResolvedValue([reactivo, dioBaja, automatico]);
    m.nombres.mockResolvedValue([{ usuario_id: SESION, nombre_completo: "Paz, Carolina" }]);

    expect((await obtenerDetalleGerente(FICHA, SESION)).historialEstados).toEqual([
      { id: "h2", accion: "REACTIVAR", motivo: null, fecha: reactivo.fecha, usuarioId: SESION, usuarioNombre: "Paz, Carolina" },
      { id: "h1", accion: "DESACTIVAR", motivo: "Licencia", fecha: dioBaja.fecha, usuarioId: "ckotro", usuarioNombre: null },
      { id: "h0", accion: "DESACTIVAR", motivo: null, fecha: automatico.fecha, usuarioId: null, usuarioNombre: null },
    ]);
    expect(m.nombres).toHaveBeenCalledWith([SESION, "ckotro"], m.tx);
  });

  it("activa con cuenta: motivoObligatorioAlDesactivar sale del agregador de «registró operaciones»", async () => {
    m.tx.fichaGerente.findUnique.mockResolvedValue({ ...FILA, activoFichaGerente: true });
    m.tx.fichaGerente.findMany.mockResolvedValue([{ idFichaGerente: "ckotra", activoFichaGerente: true, usuarioId: "ckotracuenta" }]);
    m.registroOperaciones.mockResolvedValue(true);
    expect((await obtenerDetalleGerente(FICHA, SESION)).motivoObligatorioAlDesactivar).toBe(true);
    expect(m.registroOperaciones).toHaveBeenCalledWith(m.tx, CUENTA);

    m.registroOperaciones.mockResolvedValue(false);
    expect((await obtenerDetalleGerente(FICHA, SESION)).motivoObligatorioAlDesactivar).toBe(false);
  });

  it("esUltimoGerenteActivo: otras fichas activas con cuenta, sin la objetivo, pasadas por filtrarCuentasActivas (sin bloqueo)", async () => {
    m.tx.fichaGerente.findUnique.mockResolvedValue({ ...FILA, activoFichaGerente: true });
    m.tx.fichaGerente.findMany.mockResolvedValue([{ idFichaGerente: "ckotra", activoFichaGerente: true, usuarioId: "ckotracuenta" }]);
    expect((await obtenerDetalleGerente(FICHA, SESION)).esUltimoGerenteActivo).toBe(false);
    expect(m.tx.fichaGerente.findMany).toHaveBeenCalledWith({
      where: { activoFichaGerente: true, usuarioId: { not: null }, NOT: { idFichaGerente: FICHA } },
      select: { idFichaGerente: true, activoFichaGerente: true, usuarioId: true },
    });
    expect(m.filtrarActivas).toHaveBeenCalledWith(m.tx, ["ckotracuenta"]);
    expect(m.bloquear).not.toHaveBeenCalled();

    // La otra ficha tiene la cuenta inactiva: no cuenta.
    m.filtrarActivas.mockResolvedValue([]);
    expect((await obtenerDetalleGerente(FICHA, SESION)).esUltimoGerenteActivo).toBe(true);
    // No queda ninguna otra ficha activa con cuenta.
    m.tx.fichaGerente.findMany.mockResolvedValue([]);
    m.filtrarActivas.mockImplementation(async (_db: unknown, ids: string[]) => ids);
    expect((await obtenerDetalleGerente(FICHA, SESION)).esUltimoGerenteActivo).toBe(true);
    expect(m.filtrarActivas).toHaveBeenLastCalledWith(m.tx, []);
  });

  it("activa sin cuenta: motivo no obligatorio (no se consulta) y esUltimoGerenteActivo sí se calcula", async () => {
    m.tx.fichaGerente.findUnique.mockResolvedValue({ ...FILA, activoFichaGerente: true, usuarioId: null });
    m.registroOperaciones.mockResolvedValue(true);
    expect(await obtenerDetalleGerente(FICHA, SESION)).toMatchObject({
      motivoObligatorioAlDesactivar: false, esUltimoGerenteActivo: true, esVos: false,
    });
    expect(m.registroOperaciones).not.toHaveBeenCalled();
  });

  it("inactiva: los dos indicadores son false y no se consultan; esVos no cambia", async () => {
    m.tx.fichaGerente.findUnique.mockResolvedValue({ ...FILA, activoFichaGerente: false, usuarioId: SESION });
    m.registroOperaciones.mockResolvedValue(true);
    expect(await obtenerDetalleGerente(FICHA, SESION)).toMatchObject({
      motivoObligatorioAlDesactivar: false, esUltimoGerenteActivo: false, esVos: true,
    });
    expect(m.registroOperaciones).not.toHaveBeenCalled();
    expect(m.tx.fichaGerente.findMany).not.toHaveBeenCalled();
    expect(m.filtrarActivas).not.toHaveBeenCalled();
  });

  it("inexistente: GERENTE_NO_ENCONTRADO", async () => {
    m.tx.fichaGerente.findUnique.mockResolvedValue(null);
    expect(await capturar(obtenerDetalleGerente("nada", SESION))).toMatchObject({ code: "GERENTE_NO_ENCONTRADO", status: 404 });
  });
});

describe("desactivarGerente", () => {
  const OTRA = "ckotraficha";
  const OTRA_CUENTA = "ckotracuenta";
  const ACTIVA = { idFichaGerente: FICHA, activoFichaGerente: true, version: 2, usuarioId: CUENTA };
  const OTRA_ACTIVA = { idFichaGerente: OTRA, activoFichaGerente: true, version: 0, usuarioId: OTRA_CUENTA };

  /**
   * Registra el orden de los pasos de la baja: la lectura simple
   * (`findUnique`), los ids de las activas y la relectura (`findMany`, en ese
   * orden), el conteo, el motivo, la escritura, la cuenta y el historial.
   */
  function registrarPasos(opciones: { objetivo?: { usuarioId: string | null } | null; releidas?: object[] } = {}) {
    const objetivo = opciones.objetivo === undefined ? { usuarioId: CUENTA } : opciones.objetivo;
    const releidas = opciones.releidas ?? [ACTIVA, OTRA_ACTIVA];
    m.tx.fichaGerente.findUnique.mockImplementation(async () => { m.pasos.push("leer"); return objetivo; });
    m.tx.fichaGerente.findMany
      .mockImplementationOnce(async () => { m.pasos.push("activas"); return [{ idFichaGerente: OTRA }, { idFichaGerente: FICHA }]; })
      .mockImplementationOnce(async () => { m.pasos.push("releer"); return releidas; });
    m.bloquear.mockImplementation(async () => { m.pasos.push("bloquear"); });
    m.filtrarActivas.mockImplementation(async (_tx: unknown, ids: string[]) => { m.pasos.push("ultimo"); return ids; });
    m.registroOperaciones.mockImplementation(async () => { m.pasos.push("motivo"); return false; });
    m.desactivarCuenta.mockImplementation(async () => { m.pasos.push("cuenta"); return { cambio: true }; });
    m.registrarCambio.mockImplementation(() => { m.pasos.push("historial"); return { id: "h1" }; });
  }

  /** Nada se escribió: ni la ficha, ni la cuenta, ni el historial. */
  function sinEscrituras() {
    expect(m.tx.fichaGerente.updateMany).not.toHaveBeenCalled();
    expect(m.desactivarCuenta).not.toHaveBeenCalled();
    expect(m.revocarSesiones).not.toHaveBeenCalled();
    expect(m.registrarCambio).not.toHaveBeenCalled();
  }

  it("orden: lectura → no a sí mismo → activas + objetivo en un solo bloqueo → relectura → último gerente → motivo → updateMany → cuenta → historial", async () => {
    registrarPasos();
    expect(await desactivarGerente(FICHA, { version: 2 }, actorUsuario(SESION))).toEqual({ id: FICHA, activo: false, version: 3 });
    expect(m.pasos).toEqual(["leer", "activas", "bloquear", "releer", "ultimo", "motivo", "updateMany", "cuenta", "historial"]);
    expect(m.tx.fichaGerente.findUnique).toHaveBeenCalledWith({ where: { idFichaGerente: FICHA }, select: { usuarioId: true } });
    expect(m.tx.fichaGerente.findMany).toHaveBeenNthCalledWith(1, {
      where: { activoFichaGerente: true },
      select: { idFichaGerente: true },
    });
    expect(m.bloquear).toHaveBeenCalledTimes(1);
    expect(m.bloquear).toHaveBeenCalledWith(m.tx, { recursos: { fichasGerente: [OTRA, FICHA] } });
    expect(m.tx.fichaGerente.findMany).toHaveBeenNthCalledWith(2, {
      where: { idFichaGerente: { in: [OTRA, FICHA] } },
      select: { idFichaGerente: true, activoFichaGerente: true, version: true, usuarioId: true },
    });
    // El objetivo no se cuenta.
    expect(m.filtrarActivas).toHaveBeenCalledWith(m.tx, [OTRA_CUENTA]);
    expect(m.registroOperaciones).toHaveBeenCalledWith(m.tx, CUENTA);
    expect(m.tx.fichaGerente.updateMany).toHaveBeenCalledWith({
      where: { idFichaGerente: FICHA, activoFichaGerente: true, version: 2 },
      data: { activoFichaGerente: false, version: { increment: 1 }, modificadoPorUsuarioId: SESION },
    });
    expect(m.desactivarCuenta).toHaveBeenCalledWith(m.tx, CUENTA);
    // desactivarCuenta ya revoca las sesiones: no se llama aparte.
    expect(m.revocarSesiones).not.toHaveBeenCalled();
    expect(m.registrarCambio).toHaveBeenCalledWith(m.tx, {
      entidad: "FICHA_GERENTE", id: FICHA, accion: "DESACTIVAR", motivo: null, actor: actorUsuario(SESION),
    });
  });

  it("el objetivo siempre entra en el bloqueo, aunque no figure entre las activas", async () => {
    registrarPasos();
    m.tx.fichaGerente.findMany.mockReset();
    m.tx.fichaGerente.findMany
      .mockResolvedValueOnce([{ idFichaGerente: OTRA }])
      .mockResolvedValueOnce([ACTIVA, OTRA_ACTIVA]);
    await desactivarGerente(FICHA, { version: 2 }, actorUsuario(SESION));
    expect(m.bloquear).toHaveBeenCalledWith(m.tx, { recursos: { fichasGerente: [OTRA, FICHA] } });
  });

  it("autodesactivación: NO_PUEDE_DESACTIVARSE_A_SI_MISMO (422) antes de bloquear nada, aun con versión vieja", async () => {
    registrarPasos();
    expect(await capturar(desactivarGerente(FICHA, { version: 0 }, actorUsuario(CUENTA)))).toMatchObject({
      code: "NO_PUEDE_DESACTIVARSE_A_SI_MISMO", status: 422,
    });
    expect(m.pasos).toEqual(["leer"]);
    expect(m.bloquear).not.toHaveBeenCalled();
    sinEscrituras();
  });

  it("ficha ajena: sí bloquea", async () => {
    registrarPasos();
    await desactivarGerente(FICHA, { version: 2 }, actorUsuario(SESION));
    expect(m.bloquear).toHaveBeenCalled();
  });

  it("ficha sin cuenta y actor usuario: no es la propia", async () => {
    registrarPasos({ objetivo: { usuarioId: null }, releidas: [{ ...ACTIVA, usuarioId: null }, OTRA_ACTIVA] });
    expect(await desactivarGerente(FICHA, { version: 2 }, actorUsuario(SESION))).toMatchObject({ activo: false });
  });

  it("actor proceso automático: no se compara con la cuenta y modificadoPorUsuarioId queda null", async () => {
    registrarPasos();
    await desactivarGerente(FICHA, { version: 2 }, PROCESO_AUTOMATICO);
    expect(m.tx.fichaGerente.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ modificadoPorUsuarioId: null }) }),
    );
    expect(m.registrarCambio).toHaveBeenCalledWith(m.tx, expect.objectContaining({ actor: PROCESO_AUTOMATICO }));
  });

  it("inexistente en la lectura simple: GERENTE_NO_ENCONTRADO sin bloquear", async () => {
    registrarPasos({ objetivo: null });
    expect(await capturar(desactivarGerente("nada", { version: 0 }, actorUsuario(SESION)))).toMatchObject({
      code: "GERENTE_NO_ENCONTRADO", status: 404,
    });
    expect(m.pasos).toEqual(["leer"]);
    sinEscrituras();
  });

  it.each([
    ["inexistente al releer", [OTRA_ACTIVA], 2, "GERENTE_NO_ENCONTRADO", 404],
    ["ya inactivo", [{ ...ACTIVA, activoFichaGerente: false }, OTRA_ACTIVA], 2, "GERENTE_YA_INACTIVO", 409],
    ["versión vieja", [ACTIVA, OTRA_ACTIVA], 1, "CONFLICTO_EDICION_CONCURRENTE", 409],
  ])("%s: %s, después del bloqueo y sin contar gerentes", async (_caso, releidas, version, code, status) => {
    registrarPasos({ releidas });
    expect(await capturar(desactivarGerente(FICHA, { version }, actorUsuario(SESION)))).toMatchObject({ code, status });
    expect(m.pasos).toEqual(["leer", "activas", "bloquear", "releer"]);
    sinEscrituras();
  });

  it("el estado releído manda: la lectura previa decía activa, la relectura inactiva", async () => {
    registrarPasos({ releidas: [{ ...ACTIVA, activoFichaGerente: false }, OTRA_ACTIVA] });
    expect(await capturar(desactivarGerente(FICHA, { version: 2 }, actorUsuario(SESION)))).toMatchObject({ code: "GERENTE_YA_INACTIVO" });
  });

  it("último gerente activo: sin otra ficha activa con cuenta activa → ULTIMO_GERENTE_ACTIVO, sin escribir ni mirar el motivo", async () => {
    registrarPasos({ releidas: [ACTIVA] });
    expect(await capturar(desactivarGerente(FICHA, { version: 2, motivo: "x" }, actorUsuario(SESION)))).toMatchObject({
      code: "ULTIMO_GERENTE_ACTIVO", status: 409, message: "Debe quedar al menos un gerente activo",
    });
    expect(m.pasos).toEqual(["leer", "activas", "bloquear", "releer", "ultimo"]);
    expect(m.filtrarActivas).toHaveBeenCalledWith(m.tx, []);
    sinEscrituras();
  });

  it("una ficha activa sin cuenta no cuenta como gerente activo", async () => {
    registrarPasos({ releidas: [ACTIVA, { ...OTRA_ACTIVA, usuarioId: null }] });
    expect(await capturar(desactivarGerente(FICHA, { version: 2 }, actorUsuario(SESION)))).toMatchObject({ code: "ULTIMO_GERENTE_ACTIVO" });
    expect(m.filtrarActivas).toHaveBeenCalledWith(m.tx, []);
  });

  it("una ficha activa con la cuenta inactiva no cuenta como gerente activo", async () => {
    registrarPasos();
    m.filtrarActivas.mockImplementation(async () => { m.pasos.push("ultimo"); return []; });
    expect(await capturar(desactivarGerente(FICHA, { version: 2 }, actorUsuario(SESION)))).toMatchObject({ code: "ULTIMO_GERENTE_ACTIVO" });
    expect(m.filtrarActivas).toHaveBeenCalledWith(m.tx, [OTRA_CUENTA]);
    sinEscrituras();
  });

  it("una ficha inactiva releída no cuenta (otra baja confirmó mientras se esperaba el bloqueo)", async () => {
    registrarPasos({ releidas: [ACTIVA, { ...OTRA_ACTIVA, activoFichaGerente: false }] });
    expect(await capturar(desactivarGerente(FICHA, { version: 2 }, actorUsuario(SESION)))).toMatchObject({ code: "ULTIMO_GERENTE_ACTIVO" });
  });

  it("queda al menos otro gerente activo con cuenta activa: no se dispara", async () => {
    registrarPasos({ releidas: [ACTIVA, OTRA_ACTIVA, { ...OTRA_ACTIVA, idFichaGerente: "cksincuenta", usuarioId: null }] });
    expect(await desactivarGerente(FICHA, { version: 2 }, actorUsuario(SESION))).toMatchObject({ activo: false });
    expect(m.filtrarActivas).toHaveBeenCalledWith(m.tx, [OTRA_CUENTA]);
  });

  it("con motivo: se recorta y se guarda aunque no sea obligatorio; no consulta «registró operaciones»", async () => {
    registrarPasos();
    await desactivarGerente(FICHA, { version: 2, motivo: "  Dejó el centro " }, actorUsuario(SESION));
    expect(m.registroOperaciones).not.toHaveBeenCalled();
    expect(m.registrarCambio).toHaveBeenCalledWith(m.tx, expect.objectContaining({ motivo: "Dejó el centro" }));
  });

  it("sin motivo y con operaciones: MOTIVO_REQUERIDO (400), sin escribir nada", async () => {
    registrarPasos();
    m.registroOperaciones.mockImplementation(async () => { m.pasos.push("motivo"); return true; });
    expect(await capturar(desactivarGerente(FICHA, { version: 2 }, actorUsuario(SESION)))).toMatchObject({
      code: "MOTIVO_REQUERIDO", status: 400,
    });
    expect(m.pasos).toEqual(["leer", "activas", "bloquear", "releer", "ultimo", "motivo"]);
    sinEscrituras();
  });

  it("con operaciones y motivo: procede", async () => {
    registrarPasos();
    m.registroOperaciones.mockResolvedValue(true);
    expect(await desactivarGerente(FICHA, { version: 2, motivo: "Renuncia" }, actorUsuario(SESION))).toMatchObject({ activo: false });
  });

  it("ficha sin cuenta: no consulta las operaciones ni toca ninguna cuenta; motivo opcional", async () => {
    registrarPasos({ objetivo: { usuarioId: null }, releidas: [{ ...ACTIVA, usuarioId: null }, OTRA_ACTIVA] });
    expect(await desactivarGerente(FICHA, { version: 2 }, actorUsuario(SESION))).toEqual({ id: FICHA, activo: false, version: 3 });
    expect(m.pasos).toEqual(["leer", "activas", "bloquear", "releer", "ultimo", "updateMany", "historial"]);
    expect(m.registroOperaciones).not.toHaveBeenCalled();
    expect(m.desactivarCuenta).not.toHaveBeenCalled();
  });

  it("updateMany sin filas: conflicto, sin cuenta ni historial", async () => {
    registrarPasos();
    m.tx.fichaGerente.updateMany.mockResolvedValue({ count: 0 });
    expect(await capturar(desactivarGerente(FICHA, { version: 2 }, actorUsuario(SESION)))).toMatchObject({
      code: "CONFLICTO_EDICION_CONCURRENTE",
    });
    expect(m.desactivarCuenta).not.toHaveBeenCalled();
    expect(m.registrarCambio).not.toHaveBeenCalled();
  });

  it("si la cuenta falla, la transacción revierte y el historial no se encola", async () => {
    registrarPasos();
    m.desactivarCuenta.mockRejectedValue(new Error("fallo de A"));
    await expect(desactivarGerente(FICHA, { version: 2 }, actorUsuario(SESION))).rejects.toThrow("fallo de A");
    expect(m.registrarCambio).not.toHaveBeenCalled();
  });
});

describe("reactivarGerente", () => {
  const INACTIVA = { activoFichaGerente: false, version: 3, usuarioId: CUENTA };

  function registrarPasos(ficha: object | null = INACTIVA) {
    m.bloquear.mockImplementation(async () => { m.pasos.push("bloquear"); });
    m.tx.fichaGerente.findUnique.mockImplementation(async () => { m.pasos.push("releer"); return ficha; });
    m.reactivarCuenta.mockImplementation(async () => { m.pasos.push("cuenta"); return { cambio: true }; });
    m.registrarCambio.mockImplementation(() => { m.pasos.push("historial"); return { id: "h2" }; });
  }

  it("bloqueo de la ficha → relectura → updateMany → cuenta → historial REACTIVAR sin motivo, sin regla de último gerente", async () => {
    registrarPasos();
    expect(await reactivarGerente(FICHA, { version: 3 }, actorUsuario(SESION))).toEqual({ id: FICHA, activo: true, version: 4 });
    expect(m.pasos).toEqual(["bloquear", "releer", "updateMany", "cuenta", "historial"]);
    expect(m.bloquear).toHaveBeenCalledWith(m.tx, { recursos: { fichasGerente: [FICHA] } });
    expect(m.tx.fichaGerente.updateMany).toHaveBeenCalledWith({
      where: { idFichaGerente: FICHA, activoFichaGerente: false, version: 3 },
      data: { activoFichaGerente: true, version: { increment: 1 }, modificadoPorUsuarioId: SESION },
    });
    expect(m.reactivarCuenta).toHaveBeenCalledWith(m.tx, CUENTA);
    expect(m.registrarCambio).toHaveBeenCalledWith(m.tx, {
      entidad: "FICHA_GERENTE", id: FICHA, accion: "REACTIVAR", actor: actorUsuario(SESION),
    });
    expect(m.registroOperaciones).not.toHaveBeenCalled();
    expect(m.filtrarActivas).not.toHaveBeenCalled();
    expect(m.tx.fichaGerente.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ["inexistente", null, 3, "GERENTE_NO_ENCONTRADO", 404],
    ["ya activo", { ...INACTIVA, activoFichaGerente: true }, 3, "GERENTE_YA_ACTIVO", 409],
    ["versión vieja", INACTIVA, 2, "CONFLICTO_EDICION_CONCURRENTE", 409],
  ])("%s: %s, sin escribir", async (_caso, ficha, version, code, status) => {
    registrarPasos(ficha);
    expect(await capturar(reactivarGerente(FICHA, { version }, actorUsuario(SESION)))).toMatchObject({ code, status });
    expect(m.pasos).toEqual(["bloquear", "releer"]);
  });

  it("updateMany sin filas: conflicto, sin cuenta ni historial", async () => {
    registrarPasos();
    m.tx.fichaGerente.updateMany.mockResolvedValue({ count: 0 });
    expect(await capturar(reactivarGerente(FICHA, { version: 3 }, actorUsuario(SESION)))).toMatchObject({
      code: "CONFLICTO_EDICION_CONCURRENTE",
    });
    expect(m.reactivarCuenta).not.toHaveBeenCalled();
    expect(m.registrarCambio).not.toHaveBeenCalled();
  });

  it("ficha sin cuenta: reactiva sin tocar ninguna cuenta", async () => {
    registrarPasos({ ...INACTIVA, usuarioId: null });
    await reactivarGerente(FICHA, { version: 3 }, actorUsuario(SESION));
    expect(m.pasos).toEqual(["bloquear", "releer", "updateMany", "historial"]);
  });

  it("actor proceso automático: modificadoPorUsuarioId null", async () => {
    registrarPasos();
    await reactivarGerente(FICHA, { version: 3 }, PROCESO_AUTOMATICO);
    expect(m.tx.fichaGerente.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ modificadoPorUsuarioId: null }) }),
    );
  });
});

describe("listarGerentes", () => {
  const FILA = {
    idFichaGerente: "a",
    usuarioId: "ckotracuenta",
    apellidoFichaGerente: "Ibarra",
    nombreFichaGerente: "Marcos",
    dniFichaGerente: DNI,
    telefonoFichaGerente: null,
    emailFichaGerente: "marcos@mail.com",
    activoFichaGerente: false,
  };

  // HU-G-01 dejaba el listado completo sin parámetros (DEC-38); HU-G-03 suma
  // la query ({ pagina, q }), la sesión, la paginación y `esVos`. Se conservan
  // las aserciones de G-01 (activas e inactivas, orden y forma de cada fila)
  // y se suman las nuevas.
  it("activas e inactivas, por apellido, nombre y DNI, sin filtro y en la página 1", async () => {
    m.tx.fichaGerente.count.mockResolvedValue(1);
    m.tx.fichaGerente.findMany.mockResolvedValue([FILA]);
    expect(await listarGerentes({ pagina: 1 }, SESION)).toEqual({
      items: [{ id: "a", apellido: "Ibarra", nombre: "Marcos", dni: DNI, telefono: null, email: "marcos@mail.com", activo: false, esVos: false }],
      pagina: 1,
      por_pagina: 10,
      total: 1,
      total_paginas: 1,
    });
    const args = m.tx.fichaGerente.findMany.mock.calls[0]![0];
    expect(args.where).toBeUndefined();
    expect(m.tx.fichaGerente.count).toHaveBeenCalledWith({ where: undefined });
    expect(args.orderBy).toEqual([
      { apellidoNormalizadoFichaGerente: "asc" },
      { nombreNormalizadoFichaGerente: "asc" },
      { dniFichaGerente: "asc" },
    ]);
    expect(args).toMatchObject({ skip: 0, take: 10 });
  });

  it("pagina de a 10 con skip/take y el total del resultado filtrado", async () => {
    m.tx.fichaGerente.count.mockResolvedValue(23);
    m.tx.fichaGerente.findMany.mockResolvedValue([]);
    const r = await listarGerentes({ pagina: 2, q: "ferr 8806" }, SESION);
    expect(r).toMatchObject({ pagina: 2, por_pagina: 10, total: 23, total_paginas: 3 });
    const args = m.tx.fichaGerente.findMany.mock.calls[0]![0];
    expect(args).toMatchObject({ skip: 10, take: 10 });
    // El mismo filtro para contar y para traer las filas.
    expect(m.tx.fichaGerente.count).toHaveBeenCalledWith({ where: args.where });
    expect(args.where).toEqual({
      AND: [
        { OR: [{ apellidoNormalizadoFichaGerente: { contains: "ferr" } }, { nombreNormalizadoFichaGerente: { contains: "ferr" } }] },
        {
          OR: [
            { apellidoNormalizadoFichaGerente: { contains: "8806" } },
            { nombreNormalizadoFichaGerente: { contains: "8806" } },
            { dniFichaGerente: { contains: "8806" } },
          ],
        },
      ],
    });
  });

  it("una página fuera de rango se lleva a la última, como en el personal", async () => {
    m.tx.fichaGerente.count.mockResolvedValue(23);
    m.tx.fichaGerente.findMany.mockResolvedValue([]);
    expect(await listarGerentes({ pagina: 9 }, SESION)).toMatchObject({ pagina: 3, total_paginas: 3 });
    expect(m.tx.fichaGerente.findMany.mock.calls[0]![0]).toMatchObject({ skip: 20, take: 10 });
  });

  it("sin resultados: página 1, total_paginas 0 e items vacío", async () => {
    m.tx.fichaGerente.count.mockResolvedValue(0);
    m.tx.fichaGerente.findMany.mockResolvedValue([]);
    expect(await listarGerentes({ pagina: 4, q: "zzz" }, SESION)).toEqual({ items: [], pagina: 1, por_pagina: 10, total: 0, total_paginas: 0 });
    expect(m.tx.fichaGerente.findMany.mock.calls[0]![0]).toMatchObject({ skip: 0 });
  });

  it("un q de menos de 2 caracteres no filtra", async () => {
    m.tx.fichaGerente.count.mockResolvedValue(0);
    m.tx.fichaGerente.findMany.mockResolvedValue([]);
    await listarGerentes({ pagina: 1, q: "a" }, SESION);
    expect(m.tx.fichaGerente.findMany.mock.calls[0]![0].where).toBeUndefined();
  });

  it("esVos solo en la ficha de la cuenta de la sesión; una ficha sin cuenta nunca; el ítem no trae usuarioId", async () => {
    m.tx.fichaGerente.count.mockResolvedValue(3);
    m.tx.fichaGerente.findMany.mockResolvedValue([
      { ...FILA, idFichaGerente: "otra" },
      { ...FILA, idFichaGerente: "propia", usuarioId: SESION },
      { ...FILA, idFichaGerente: "sincuenta", usuarioId: null },
    ]);
    const { items } = await listarGerentes({ pagina: 1 }, SESION);
    expect(items.map((i) => [i.id, i.esVos])).toEqual([
      ["otra", false],
      ["propia", true],
      ["sincuenta", false],
    ]);
    for (const item of items) expect(item).not.toHaveProperty("usuarioId");
    expect(m.tx.fichaGerente.findMany.mock.calls[0]![0].select).toMatchObject({ usuarioId: true });
  });

  it("una ficha sin cuenta no es «(vos)» aunque la sesión no tenga id", async () => {
    m.tx.fichaGerente.count.mockResolvedValue(1);
    m.tx.fichaGerente.findMany.mockResolvedValue([{ ...FILA, usuarioId: null }]);
    expect((await listarGerentes({ pagina: 1 }, null as unknown as string)).items[0]!.esVos).toBe(false);
  });

  it("solo lee: no escribe nada", async () => {
    m.tx.fichaGerente.count.mockResolvedValue(0);
    m.tx.fichaGerente.findMany.mockResolvedValue([]);
    await listarGerentes({ pagina: 1, q: "marcos" }, SESION);
    expect(m.tx.fichaGerente.create).not.toHaveBeenCalled();
    expect(m.tx.fichaGerente.updateMany).not.toHaveBeenCalled();
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
