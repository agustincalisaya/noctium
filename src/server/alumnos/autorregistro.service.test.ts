import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ServiceError } from "@/server/shared/service-error";

// CODIGO_OTP_SECRET real (no mockeado) — necesario para poder calcular acá
// mismo el HMAC-SHA256 esperado y ejercitar timingSafeEqual real, tal como
// pidió Adriel explícitamente (nada de mockear node:crypto).
process.env.CODIGO_OTP_SECRET = "secreto-de-test-no-usar-en-produccion";

const { tx, evento, crearCuenta, hashPassword, enviarEmail, getParametroNumerico, getParametroTexto } =
  vi.hoisted(() => ({
    tx: {
      alumno: { create: vi.fn(), update: vi.fn() },
      solicitudAutorregistro: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      codigoVerificacion: { create: vi.fn(), update: vi.fn() },
      reenvioCodigo: { create: vi.fn() },
    },
    evento: vi.fn(),
    crearCuenta: vi.fn(),
    hashPassword: vi.fn(),
    enviarEmail: vi.fn(),
    getParametroNumerico: vi.fn(),
    getParametroTexto: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    usuario: { findFirst: vi.fn() },
    alumno: { findFirst: vi.fn() },
    intentoRegistro: { count: vi.fn(), create: vi.fn() },
    eventoSeguridad: { create: evento },
    solicitudAutorregistro: { findUnique: vi.fn() },
    codigoVerificacion: { update: vi.fn() },
    reenvioCodigo: { count: vi.fn() },
    $transaction: vi.fn((callback: (cliente: typeof tx) => unknown) => callback(tx)),
  },
}));
vi.mock("@/lib/password", () => ({ hashPassword }));
vi.mock("@/lib/email", () => ({ emailSenderConsola: { enviar: enviarEmail } }));
vi.mock("@/server/usuarios/usuario.service", () => ({ crearCuentaConCredenciales: crearCuenta }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico, getParametroTexto }));

const { prisma } = await import("@/lib/prisma");
const { iniciarAutorregistro, confirmarCodigoAutorregistro, reenviarCodigoAutorregistro } = await import(
  "./autorregistro.service"
);

const IP = "190.190.1.1";
const ALUMNO = "ckalumno00000000000000001";
const USUARIO = "ckusuario0000000000000001";
const SOLICITUD = "cksolicitud000000000000001";
const CODIGO_ID = "ckcodigo00000000000000001";

/** HMAC real con el mismo secreto que lee el service — para simular un codigoHash almacenado válido. */
function hmac(codigo: string): string {
  return createHmac("sha256", process.env.CODIGO_OTP_SECRET!).update(codigo).digest("hex");
}

const inputBase = {
  nombre: "Ana",
  apellido: "Pérez",
  dni: "30123456",
  fecha_nacimiento: new Date("2000-01-01"),
  genero: undefined,
  telefono: undefined,
  email: "ana.perez@test.com",
  password: "Abcdefg1",
  confirmacion_password: "Abcdefg1",
  acepta_terminos: true as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  hashPassword.mockResolvedValue("hash-bcrypt-fake");
  crearCuenta.mockResolvedValue({ id: USUARIO });
  enviarEmail.mockResolvedValue(undefined);
  getParametroTexto.mockResolvedValue("1.0");
  getParametroNumerico.mockImplementation(async (clave: string, porDefecto: number) => {
    const valores: Record<string, number> = {
      registro_max_por_ip_hora: 5,
      codigo_verificacion_expiracion_minutos: 10,
      codigo_verificacion_max_intentos: 5,
      reenvio_codigo_espera_segundos: 60,
      reenvio_codigo_max_por_hora: 3,
    };
    return valores[clave] ?? porDefecto;
  });
  vi.mocked(prisma.intentoRegistro.count).mockResolvedValue(0);
  vi.mocked(prisma.intentoRegistro.create).mockResolvedValue({} as never);
  vi.mocked(prisma.usuario.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.alumno.findFirst).mockResolvedValue(null);
  tx.alumno.create.mockResolvedValue({});
  tx.alumno.update.mockResolvedValue({});
  tx.solicitudAutorregistro.findFirst.mockResolvedValue(null);
  tx.solicitudAutorregistro.create.mockResolvedValue({ idSolicitud: SOLICITUD });
  tx.solicitudAutorregistro.update.mockResolvedValue({});
  tx.codigoVerificacion.create.mockResolvedValue({ idCodigo: CODIGO_ID });
  tx.codigoVerificacion.update.mockResolvedValue({});
  tx.reenvioCodigo.create.mockResolvedValue({});
});

// ------------------------------------------------------------
// iniciarAutorregistro — rama (a)
// ------------------------------------------------------------
describe("iniciarAutorregistro — rama (a): alta directa", () => {
  it("crea Alumno + Usuario en una sola transacción y responde DIRECTO sin paso de verificación", async () => {
    const resultado = await iniciarAutorregistro(inputBase, IP);

    expect(resultado).toEqual({ via: "DIRECTO", email: inputBase.email });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(crearCuenta).toHaveBeenCalledWith(
      { email: inputBase.email, passwordHash: "hash-bcrypt-fake", rol: "ALUMNO" },
      tx,
    );
    expect(tx.alumno.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nombreAlumno: "Ana",
        apellidoAlumno: "Pérez",
        dniAlumno: "30123456",
        emailAlumno: inputBase.email,
        usuarioId: USUARIO,
        activoAlumno: true,
        terminosAceptadosEn: expect.any(Date),
        versionTerminosAceptada: "1.0",
      }),
    });
  });

  it("emite REGISTRO_CUENTA después del commit, con el payload exacto (usuarioId/emailEvento/ipEvento, nunca alumno_id/via)", async () => {
    await iniciarAutorregistro(inputBase, IP);

    expect(evento).toHaveBeenCalledTimes(1);
    expect(evento).toHaveBeenCalledWith({
      data: { tipoEvento: "REGISTRO_CUENTA", usuarioId: USUARIO, emailEvento: inputBase.email, ipEvento: IP },
    });
    const payload = JSON.stringify(evento.mock.calls[0][0]);
    expect(payload).not.toContain("alumno_id");
    expect(payload).not.toContain("via");
    expect(payload).not.toContain(inputBase.dni);
  });

  it("P2002 con constraint de DNI → DNI_DUPLICADO, no un 500 crudo", async () => {
    vi.mocked(prisma.$transaction).mockImplementationOnce(() => {
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { target: ["dniAlumno"] },
      });
    });

    const error = await iniciarAutorregistro(inputBase, IP).catch((e) => e);
    expect(error).toBeInstanceOf(ServiceError);
    expect(error.code).toBe("DNI_DUPLICADO");
  });

  it("P2002 con constraint de email → CUENTA_YA_EXISTE, no un 500 crudo", async () => {
    vi.mocked(prisma.$transaction).mockImplementationOnce(() => {
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { target: ["emailUsuario"] },
      });
    });

    const error = await iniciarAutorregistro(inputBase, IP).catch((e) => e);
    expect(error).toBeInstanceOf(ServiceError);
    expect(error.code).toBe("CUENTA_YA_EXISTE");
  });
});

// ------------------------------------------------------------
// iniciarAutorregistro — rama (b)
// ------------------------------------------------------------
describe("iniciarAutorregistro — rama (b): ficha existente sin cuenta, email verificable", () => {
  beforeEach(() => {
    vi.mocked(prisma.alumno.findFirst).mockResolvedValue({
      idAlumno: ALUMNO,
      usuarioId: null,
      emailAlumno: "ANA.PEREZ@TEST.COM", // mismo email, distinta may/min — prueba case-insensitive
    } as never);
  });

  it("no duplica la ficha, crea SolicitudAutorregistro con emailDestino = email de CONTACTO (no el tipeado)", async () => {
    const resultado = await iniciarAutorregistro(inputBase, IP);

    expect(resultado).toEqual({
      via: "VERIFICACION_REQUERIDA",
      solicitud_id: SOLICITUD,
      email_enmascarado: expect.stringContaining("@TEST.COM"),
    });
    expect(tx.alumno.create).not.toHaveBeenCalled();
    expect(tx.solicitudAutorregistro.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        alumnoId: ALUMNO,
        emailDestino: "ANA.PEREZ@TEST.COM", // el de Alumno.emailAlumno, NO inputBase.email
      }),
    });
  });

  it("invalida cualquier solicitud anterior sin confirmar del mismo alumno", async () => {
    tx.solicitudAutorregistro.findFirst.mockResolvedValue({ codigoId: "ckcodigo-viejo-000000001" });

    await iniciarAutorregistro(inputBase, IP);

    expect(tx.codigoVerificacion.update).toHaveBeenCalledWith({
      where: { idCodigo: "ckcodigo-viejo-000000001" },
      data: { invalidadoEn: expect.any(Date) },
    });
  });

  it("no invalida nada si no hay solicitud anterior", async () => {
    await iniciarAutorregistro(inputBase, IP);
    expect(tx.codigoVerificacion.update).not.toHaveBeenCalled();
  });

  it("emite CODIGO_VERIFICACION_GENERADO con el email de contacto, sin alumno_id/solicitud_id", async () => {
    await iniciarAutorregistro(inputBase, IP);
    expect(evento).toHaveBeenCalledWith({
      data: {
        tipoEvento: "CODIGO_VERIFICACION_GENERADO",
        usuarioId: null,
        emailEvento: "ANA.PEREZ@TEST.COM",
        ipEvento: IP,
      },
    });
  });

  it("envía el email después del COMMIT, nunca dentro de la transacción", async () => {
    let commitResuelto = false;
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
      const resultado = await callback(tx);
      commitResuelto = true;
      return resultado;
    });
    enviarEmail.mockImplementation(async () => {
      expect(commitResuelto).toBe(true);
    });

    await iniciarAutorregistro(inputBase, IP);
    expect(enviarEmail).toHaveBeenCalledTimes(1);
  });
});

// ------------------------------------------------------------
// iniciarAutorregistro — rama (c)
// ------------------------------------------------------------
describe("iniciarAutorregistro — rama (c): ficha con cuenta ya vinculada", () => {
  it("409 CUENTA_YA_EXISTE, mismo mensaje que el del paso 2 (no distinguible)", async () => {
    vi.mocked(prisma.alumno.findFirst).mockResolvedValue({
      idAlumno: ALUMNO,
      usuarioId: "ckusuario-ya-existente-001",
      emailAlumno: "otro@test.com",
    } as never);

    const errorRamaC = await iniciarAutorregistro(inputBase, IP).catch((e) => e);

    vi.mocked(prisma.alumno.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.usuario.findFirst).mockResolvedValue({ idUsuario: "x" } as never);
    const errorPaso2 = await iniciarAutorregistro(inputBase, IP).catch((e) => e);

    expect(errorRamaC.code).toBe("CUENTA_YA_EXISTE");
    expect(errorRamaC.message).toBe(errorPaso2.message);
  });
});

// ------------------------------------------------------------
// iniciarAutorregistro — rama (d)
// ------------------------------------------------------------
describe("iniciarAutorregistro — rama (d): sin email verificable o no coincide", () => {
  it("email de contacto ausente (null) → deriva a mesa de entrada", async () => {
    vi.mocked(prisma.alumno.findFirst).mockResolvedValue({
      idAlumno: ALUMNO,
      usuarioId: null,
      emailAlumno: null,
    } as never);

    const resultado = await iniciarAutorregistro(inputBase, IP);
    expect(resultado).toEqual({ via: "DERIVADO_MESA_ENTRADA" });
  });

  it("email de contacto no coincide con el tipeado → deriva a mesa de entrada", async () => {
    vi.mocked(prisma.alumno.findFirst).mockResolvedValue({
      idAlumno: ALUMNO,
      usuarioId: null,
      emailAlumno: "otro.email@test.com",
    } as never);

    const resultado = await iniciarAutorregistro(inputBase, IP);
    expect(resultado).toEqual({ via: "DERIVADO_MESA_ENTRADA" });
  });

  it("emite AUTORREGISTRO_DERIVADO_MESA_ENTRADA sin usuarioId/emailEvento (nunca revela el dato)", async () => {
    vi.mocked(prisma.alumno.findFirst).mockResolvedValue({
      idAlumno: ALUMNO,
      usuarioId: null,
      emailAlumno: null,
    } as never);

    await iniciarAutorregistro(inputBase, IP);

    expect(evento).toHaveBeenCalledWith({
      data: { tipoEvento: "AUTORREGISTRO_DERIVADO_MESA_ENTRADA", usuarioId: null, emailEvento: null, ipEvento: IP },
    });
    const payload = JSON.stringify(evento.mock.calls[0][0]);
    expect(payload).not.toContain(inputBase.dni);
    expect(payload).not.toContain("otro.email");
  });

  it("no crea ninguna SolicitudAutorregistro ni CodigoVerificacion", async () => {
    vi.mocked(prisma.alumno.findFirst).mockResolvedValue({
      idAlumno: ALUMNO,
      usuarioId: null,
      emailAlumno: null,
    } as never);

    await iniciarAutorregistro(inputBase, IP);
    expect(tx.solicitudAutorregistro.create).not.toHaveBeenCalled();
    expect(tx.codigoVerificacion.create).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------
// Rate limiting de IntentoRegistro
// ------------------------------------------------------------
describe("iniciarAutorregistro — rate limit de IntentoRegistro", () => {
  it("el 6to intento desde la misma IP en la hora se rechaza (máximo 5)", async () => {
    vi.mocked(prisma.intentoRegistro.count).mockResolvedValue(5);

    const error = await iniciarAutorregistro(inputBase, IP).catch((e) => e);
    expect(error).toBeInstanceOf(ServiceError);
    expect(error.code).toBe("RATE_LIMIT_EXCEDIDO");
    expect(prisma.intentoRegistro.create).not.toHaveBeenCalled();
    expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
  });

  it("el 5to intento (justo en el límite anterior) pasa y se registra", async () => {
    vi.mocked(prisma.intentoRegistro.count).mockResolvedValue(4);
    await iniciarAutorregistro(inputBase, IP);
    expect(prisma.intentoRegistro.create).toHaveBeenCalledWith({ data: { ipIntentoRegistro: IP } });
  });
});

// ------------------------------------------------------------
// confirmarCodigoAutorregistro
// ------------------------------------------------------------
describe("confirmarCodigoAutorregistro", () => {
  const CODIGO = "123456";
  const EMAIL_DESTINO = "contacto.congelado@test.com";

  function solicitudBase(overrides: Record<string, unknown> = {}) {
    return {
      idSolicitud: SOLICITUD,
      alumnoId: ALUMNO,
      passwordHash: "hash-guardado",
      emailDestino: EMAIL_DESTINO,
      confirmadaEn: null,
      codigo: {
        idCodigo: CODIGO_ID,
        codigoHash: hmac(CODIGO),
        expiraEn: new Date(Date.now() + 5 * 60_000),
        intentos: 0,
        invalidadoEn: null,
      },
      ...overrides,
    };
  }

  it("éxito: usa emailDestino congelado (sin fetch fresco de Alumno), crea Usuario, vincula y marca todo consumido", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(solicitudBase() as never);

    const resultado = await confirmarCodigoAutorregistro(SOLICITUD, CODIGO, IP);

    expect(resultado).toEqual({ alumno_id: ALUMNO, usuario_id: USUARIO, email: EMAIL_DESTINO });
    expect(crearCuenta).toHaveBeenCalledWith(
      { email: EMAIL_DESTINO, passwordHash: "hash-guardado", rol: "ALUMNO" },
      tx,
    );
    expect(tx.alumno.update).toHaveBeenCalledWith({
      where: { idAlumno: ALUMNO },
      data: expect.objectContaining({ usuarioId: USUARIO, versionTerminosAceptada: "1.0" }),
    });
    expect(tx.solicitudAutorregistro.update).toHaveBeenCalledWith({
      where: { idSolicitud: SOLICITUD },
      data: { confirmadaEn: expect.any(Date) },
    });
    expect(tx.codigoVerificacion.update).toHaveBeenCalledWith({
      where: { idCodigo: CODIGO_ID },
      data: { invalidadoEn: expect.any(Date) },
    });
    expect(evento).toHaveBeenCalledWith({
      data: { tipoEvento: "REGISTRO_CUENTA", usuarioId: USUARIO, emailEvento: EMAIL_DESTINO, ipEvento: IP },
    });
  });

  it("no hace ningún fetch a Alumno para resolver el email (usa el congelado en la solicitud)", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(solicitudBase() as never);
    await confirmarCodigoAutorregistro(SOLICITUD, CODIGO, IP);
    // Si el código hiciera un fetch fresco de Alumno, no habría mock para
    // eso y el test fallaría con un TypeError — llegar acá ya lo prueba.
    expect(crearCuenta).toHaveBeenCalledTimes(1);
  });

  it("código vencido → CODIGO_VENCIDO, sin tocar la transacción", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(
      solicitudBase({ codigo: { ...solicitudBase().codigo, expiraEn: new Date(Date.now() - 1000) } }) as never,
    );

    const error = await confirmarCodigoAutorregistro(SOLICITUD, CODIGO, IP).catch((e) => e);
    expect(error.code).toBe("CODIGO_VENCIDO");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("intentos agotados → INTENTOS_AGOTADOS", async () => {
    getParametroNumerico.mockImplementation(async (clave: string) =>
      clave === "codigo_verificacion_max_intentos" ? 5 : 10,
    );
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(
      solicitudBase({ codigo: { ...solicitudBase().codigo, intentos: 5 } }) as never,
    );

    const error = await confirmarCodigoAutorregistro(SOLICITUD, CODIGO, IP).catch((e) => e);
    expect(error.code).toBe("INTENTOS_AGOTADOS");
  });

  it("código incorrecto (timingSafeEqual real, mismo largo de buffer) → CODIGO_INVALIDO y decrementa intentos", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(solicitudBase() as never);

    const error = await confirmarCodigoAutorregistro(SOLICITUD, "000000", IP).catch((e) => e);

    expect(error.code).toBe("CODIGO_INVALIDO");
    expect(prisma.codigoVerificacion.update).toHaveBeenCalledWith({
      where: { idCodigo: CODIGO_ID },
      data: { intentos: { increment: 1 } },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("hash almacenado de longitud distinta (corrupto) → CODIGO_INVALIDO, timingSafeEqual no revienta", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(
      solicitudBase({ codigo: { ...solicitudBase().codigo, codigoHash: "ab" } }) as never,
    );

    // Si timingSafeEqual explotara por buffers de distinta longitud, esto
    // rechazaría con un TypeError de Node en vez de un ServiceError limpio.
    const error = await confirmarCodigoAutorregistro(SOLICITUD, CODIGO, IP).catch((e) => e);
    expect(error).toBeInstanceOf(ServiceError);
    expect(error.code).toBe("CODIGO_INVALIDO");
  });

  it("solicitud ya confirmada → SOLICITUD_NO_ENCONTRADA (no CODIGO_INVALIDO ni otro)", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(
      solicitudBase({ confirmadaEn: new Date() }) as never,
    );

    const error = await confirmarCodigoAutorregistro(SOLICITUD, CODIGO, IP).catch((e) => e);
    expect(error.code).toBe("SOLICITUD_NO_ENCONTRADA");
  });

  it("código ya invalidado (ej. superseded por una solicitud nueva) → SOLICITUD_NO_ENCONTRADA", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(
      solicitudBase({ codigo: { ...solicitudBase().codigo, invalidadoEn: new Date() } }) as never,
    );

    const error = await confirmarCodigoAutorregistro(SOLICITUD, CODIGO, IP).catch((e) => e);
    expect(error.code).toBe("SOLICITUD_NO_ENCONTRADA");
  });

  it("solicitud inexistente → SOLICITUD_NO_ENCONTRADA", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(null);
    const error = await confirmarCodigoAutorregistro("no-existe", CODIGO, IP).catch((e) => e);
    expect(error.code).toBe("SOLICITUD_NO_ENCONTRADA");
  });
});

// ------------------------------------------------------------
// reenviarCodigoAutorregistro
// ------------------------------------------------------------
describe("reenviarCodigoAutorregistro", () => {
  const EMAIL_DESTINO = "contacto.congelado@test.com";

  function solicitudBase(overrides: Record<string, unknown> = {}) {
    return {
      idSolicitud: SOLICITUD,
      emailDestino: EMAIL_DESTINO,
      confirmadaEn: null,
      codigo: {
        idCodigo: CODIGO_ID,
        creadoEn: new Date(Date.now() - 120_000), // hace 2 minutos, más que los 60s de espera
        invalidadoEn: null,
        reenvios: [],
      },
      ...overrides,
    };
  }

  it("éxito: sobrescribe la MISMA fila de CodigoVerificacion, resetea intentos, registra el reenvío", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(solicitudBase() as never);
    vi.mocked(prisma.reenvioCodigo.count).mockResolvedValue(0);

    const resultado = await reenviarCodigoAutorregistro(SOLICITUD, IP);

    expect(resultado.email_enmascarado).toContain("@test.com");
    expect(tx.codigoVerificacion.update).toHaveBeenCalledWith({
      where: { idCodigo: CODIGO_ID },
      data: { codigoHash: expect.any(String), expiraEn: expect.any(Date), intentos: 0 },
    });
    expect(tx.codigoVerificacion.create).not.toHaveBeenCalled();
    expect(tx.reenvioCodigo.create).toHaveBeenCalledWith({ data: { codigoId: CODIGO_ID } });
    expect(enviarEmail).toHaveBeenCalledWith(EMAIL_DESTINO, expect.any(String), expect.any(String));
  });

  it("espera de 60s: rechaza un reenvío a los 10s del código/último reenvío", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(
      solicitudBase({
        codigo: { ...solicitudBase().codigo, creadoEn: new Date(Date.now() - 10_000) },
      }) as never,
    );

    const error = await reenviarCodigoAutorregistro(SOLICITUD, IP).catch((e) => e);
    expect(error.code).toBe("REENVIO_MUY_PRONTO");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("usa el último ReenvioCodigo (no la creación original) como referencia de espera", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(
      solicitudBase({
        codigo: {
          ...solicitudBase().codigo,
          creadoEn: new Date(Date.now() - 999_000), // viejo, no debería importar
          reenvios: [{ creadoEn: new Date(Date.now() - 5_000) }], // reenvío reciente
        },
      }) as never,
    );

    const error = await reenviarCodigoAutorregistro(SOLICITUD, IP).catch((e) => e);
    expect(error.code).toBe("REENVIO_MUY_PRONTO");
  });

  it("rate limit: 3 reenvíos en la última hora rechaza el 4to", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(solicitudBase() as never);
    vi.mocked(prisma.reenvioCodigo.count).mockResolvedValue(3);

    const error = await reenviarCodigoAutorregistro(SOLICITUD, IP).catch((e) => e);
    expect(error.code).toBe("RATE_LIMIT_EXCEDIDO");
  });

  it("solicitud con código ya invalidado → SOLICITUD_NO_ENCONTRADA (no resucita una solicitud muerta)", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(
      solicitudBase({ codigo: { ...solicitudBase().codigo, invalidadoEn: new Date() } }) as never,
    );

    const error = await reenviarCodigoAutorregistro(SOLICITUD, IP).catch((e) => e);
    expect(error.code).toBe("SOLICITUD_NO_ENCONTRADA");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("solicitud ya confirmada → SOLICITUD_NO_ENCONTRADA", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(
      solicitudBase({ confirmadaEn: new Date() }) as never,
    );
    const error = await reenviarCodigoAutorregistro(SOLICITUD, IP).catch((e) => e);
    expect(error.code).toBe("SOLICITUD_NO_ENCONTRADA");
  });

  it("emite CODIGO_VERIFICACION_GENERADO también en el reenvío", async () => {
    vi.mocked(prisma.solicitudAutorregistro.findUnique).mockResolvedValue(solicitudBase() as never);
    vi.mocked(prisma.reenvioCodigo.count).mockResolvedValue(0);

    await reenviarCodigoAutorregistro(SOLICITUD, IP);
    expect(evento).toHaveBeenCalledWith({
      data: { tipoEvento: "CODIGO_VERIFICACION_GENERADO", usuarioId: null, emailEvento: EMAIL_DESTINO, ipEvento: IP },
    });
  });
});

// ------------------------------------------------------------
// Ningún dato sensible en logs/eventos/mocks de auditoría
// ------------------------------------------------------------
describe("Nada sensible en EventoSeguridad ni en el email enviado", () => {
  it("ningún payload de evento incluye password, passwordHash ni un código de 6 dígitos", async () => {
    vi.mocked(prisma.alumno.findFirst).mockResolvedValue({
      idAlumno: ALUMNO,
      usuarioId: null,
      emailAlumno: inputBase.email,
    } as never);

    await iniciarAutorregistro(inputBase, IP);

    for (const llamada of evento.mock.calls) {
      const payload = JSON.stringify(llamada[0]);
      expect(payload).not.toContain(inputBase.password);
      expect(payload).not.toContain("hash-bcrypt-fake");
      expect(payload).not.toMatch(/"\d{6}"/); // ningún código OTP de 6 dígitos en claro
    }
  });

  it("el email enviado incluye el código (es su propósito) pero nunca la contraseña ni su hash", async () => {
    vi.mocked(prisma.alumno.findFirst).mockResolvedValue({
      idAlumno: ALUMNO,
      usuarioId: null,
      emailAlumno: inputBase.email,
    } as never);

    await iniciarAutorregistro(inputBase, IP);

    expect(enviarEmail).toHaveBeenCalled();
    const cuerpo = enviarEmail.mock.calls[0][2] as string;
    expect(cuerpo).toMatch(/\d{6}/); // sí lleva el código — es el mecanismo de entrega
    expect(cuerpo).not.toContain(inputBase.password);
    expect(cuerpo).not.toContain("hash-bcrypt-fake");
  });
});
