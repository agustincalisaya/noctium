import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ServiceError } from "@/server/shared/service-error";

// Ajuste HU-D-01/HU-D-02 (alta con contacto): construirAltaProfesorSchema(),
// crearProfesor() transaccional y la verificación de email compartida con
// actualizarContactoProfesor(), con `prisma` mockeado.

const tx = {
  profesor: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  usuario: { findFirst: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((callback: (cliente: typeof tx) => unknown) => callback(tx)),
  },
}));

vi.mock("@/server/materias/materia.service", () => ({
  bloquearMateriasParaAsociar: vi.fn(),
}));

const { construirAltaProfesorSchema } = await import("@/server/profesores/profesor.schema");
const { crearProfesor, actualizarContactoProfesor } = await import("@/server/profesores/profesor.service");

const PROFESOR = "ckprofesor000000000000001";
const USUARIO = "ckusuario0000000000000001";
const OTRA_CUENTA = "ckusuario0000000000000002";

const schema = construirAltaProfesorSchema(7, 8);

const IDENTIDAD = {
  nombre: "Ana",
  apellido: "Gómez",
  dni: "28456789",
  fechaNacimiento: "1980-05-10",
};

function parsear(contacto: Record<string, unknown>) {
  return schema.safeParse({ ...IDENTIDAD, ...contacto });
}

function datosValidos(contacto: Record<string, unknown> = {}) {
  const parsed = parsear(contacto);
  if (!parsed.success) throw new Error("Se esperaban datos válidos");
  return parsed.data;
}

async function capturarError(promesa: Promise<unknown>): Promise<ServiceError> {
  try {
    await promesa;
  } catch (error) {
    return error as ServiceError;
  }
  throw new Error("Se esperaba un error");
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.profesor.findFirst.mockResolvedValue(null);
  tx.usuario.findFirst.mockResolvedValue(null);
  tx.profesor.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    idProfesor: PROFESOR,
    nombreProfesor: data.nombreProfesor,
    apellidoProfesor: data.apellidoProfesor,
    dniProfesor: data.dniProfesor,
    activoProfesor: data.activoProfesor,
    telefonoProfesor: data.telefonoProfesor,
    emailProfesor: data.emailProfesor,
  }));
});

describe("construirAltaProfesorSchema", () => {
  it.each([
    ["ausentes", {}],
    ["vacíos", { telefono: "", email: "" }],
    ["con solo espacios", { telefono: "   ", email: "  " }],
    ["null (ausentes del FormData)", { telefono: null, email: null }],
  ])("contacto %s → válido y sin contacto", (_caso, contacto) => {
    const parsed = parsear(contacto);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.telefono).toBeUndefined();
    expect(parsed.data?.email).toBeUndefined();
  });

  it("solo teléfono → normalizado, conserva el + inicial", () => {
    expect(parsear({ telefono: "(0387) 15-412-3456" }).data?.telefono).toBe("0387154123456");
    expect(parsear({ telefono: "+54 9 387 444-5566" }).data?.telefono).toBe("+5493874445566");
  });

  it("solo email → sin espacios y en minúsculas", () => {
    expect(parsear({ email: "  Ana.Gomez@Mail.COM  " }).data?.email).toBe("ana.gomez@mail.com");
  });

  it("ambos → los dos normalizados", () => {
    const parsed = parsear({ telefono: "1234-5678", email: "ANA@MAIL.COM" });
    expect(parsed.data).toMatchObject({ telefono: "12345678", email: "ana@mail.com" });
  });

  it.each([
    ["123-4567", "El teléfono debe tener entre 8 y 15 dígitos"],
    ["1234567890123456", "El teléfono debe tener entre 8 y 15 dígitos"],
    ["0387-ABC-123", "El teléfono solo admite dígitos, +, espacios, guiones y paréntesis"],
    ["0387+154123456", "El teléfono solo admite dígitos, +, espacios, guiones y paréntesis"],
  ])("teléfono %s → error de HU-D-02 en `telefono`", (telefono, mensaje) => {
    const parsed = parsear({ telefono });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.telefono).toEqual([mensaje]);
  });

  it("email inválido o de más de 254 caracteres → error en `email`", () => {
    expect(parsear({ email: "ana@" }).error?.flatten().fieldErrors.email).toEqual(["Ingresá un email válido"]);
    const largo = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}`;
    expect(largo).toHaveLength(255);
    expect(parsear({ email: largo }).error?.flatten().fieldErrors.email).toEqual([
      "El email no puede superar los 254 caracteres",
    ]);
  });

  it("identidad y contacto inválidos → errores en los dos campos a la vez", () => {
    const parsed = schema.safeParse({ ...IDENTIDAD, dni: "12", telefono: "123" });
    const campos = parsed.error?.flatten().fieldErrors;
    expect(campos?.dni).toBeDefined();
    expect(campos?.telefono).toBeDefined();
  });
});

describe("crearProfesor con contacto", () => {
  it("sin contacto → guarda null en los dos campos y no consulta cuentas", async () => {
    const creado = await crearProfesor(datosValidos(), USUARIO);

    expect(tx.usuario.findFirst).not.toHaveBeenCalled();
    expect(tx.profesor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        telefonoProfesor: null,
        emailProfesor: null,
        activoProfesor: true,
        usuarioId: null,
        creadoPorUsuarioId: USUARIO,
      }),
    });
    expect(creado).toMatchObject({ id: PROFESOR, telefono: null, email: null });
  });

  it("solo teléfono → guarda el teléfono normalizado, sin consultar cuentas", async () => {
    const creado = await crearProfesor(datosValidos({ telefono: "(0387) 15-412-3456" }), USUARIO);

    expect(tx.usuario.findFirst).not.toHaveBeenCalled();
    expect(creado).toMatchObject({ telefono: "0387154123456", email: null });
  });

  it("solo email → verifica contra cualquier cuenta (sin excluir ninguna) y lo guarda", async () => {
    const creado = await crearProfesor(datosValidos({ email: "Nuevo.Prof@Mail.com" }), USUARIO);

    expect(tx.usuario.findFirst).toHaveBeenCalledWith({
      where: { emailUsuario: { equals: "nuevo.prof@mail.com", mode: "insensitive" } },
      select: { idUsuario: true },
    });
    expect(creado).toMatchObject({ telefono: null, email: "nuevo.prof@mail.com" });
  });

  it("ambos → guarda los dos en el mismo INSERT", async () => {
    await crearProfesor(datosValidos({ telefono: "1234-5678", email: "ana@mail.com" }), USUARIO);

    expect(tx.profesor.create).toHaveBeenCalledTimes(1);
    expect(tx.profesor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ telefonoProfesor: "12345678", emailProfesor: "ana@mail.com" }),
    });
  });

  it("no setea modificadoPorUsuarioId: cargar contacto en el alta no es una modificación", async () => {
    await crearProfesor(datosValidos({ telefono: "1234-5678" }), USUARIO);

    const [{ data }] = tx.profesor.create.mock.calls[0]!;
    expect(data).not.toHaveProperty("modificadoPorUsuarioId");
  });

  it("email de una cuenta existente → EMAIL_YA_ASOCIADO y no se crea nada", async () => {
    tx.usuario.findFirst.mockResolvedValue({ idUsuario: OTRA_CUENTA });

    const error = await capturarError(crearProfesor(datosValidos({ email: "profesor2@noctium.local" }), USUARIO));

    expect(error).toBeInstanceOf(ServiceError);
    expect(error.code).toBe("EMAIL_YA_ASOCIADO");
    expect(tx.profesor.create).not.toHaveBeenCalled();
  });

  it("DNI existente → DNI_DUPLICADO, sin verificar email ni crear", async () => {
    tx.profesor.findFirst.mockResolvedValue({ idProfesor: "ckprofesor000000000000009" });

    const error = await capturarError(crearProfesor(datosValidos({ email: "ana@mail.com" }), USUARIO));

    expect(error.code).toBe("DNI_DUPLICADO");
    expect(tx.usuario.findFirst).not.toHaveBeenCalled();
    expect(tx.profesor.create).not.toHaveBeenCalled();
  });

  it("P2002 sobre dniProfesor en el INSERT (altas simultáneas) → DNI_DUPLICADO", async () => {
    tx.profesor.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["dniProfesor"] },
      }),
    );

    const error = await capturarError(crearProfesor(datosValidos({ telefono: "1234-5678" }), USUARIO));

    expect(error).toBeInstanceOf(ServiceError);
    expect(error.code).toBe("DNI_DUPLICADO");
  });

  it("un error inesperado se propaga sin traducir", async () => {
    const inesperado = new Error("conexión perdida");
    tx.profesor.create.mockRejectedValue(inesperado);

    await expect(crearProfesor(datosValidos(), USUARIO)).rejects.toBe(inesperado);
  });
});

describe("actualizarContactoProfesor con la verificación de email compartida (HU-D-02)", () => {
  beforeEach(() => {
    tx.profesor.update.mockResolvedValue({
      idProfesor: PROFESOR,
      telefonoProfesor: null,
      emailProfesor: "profesor1@noctium.local",
    });
  });

  it("excluye la cuenta propia del profesor de la búsqueda", async () => {
    tx.profesor.findUnique.mockResolvedValue({ idProfesor: PROFESOR, usuarioId: USUARIO });

    await actualizarContactoProfesor(PROFESOR, { email: "profesor1@noctium.local" }, USUARIO);

    expect(tx.usuario.findFirst).toHaveBeenCalledWith({
      where: {
        emailUsuario: { equals: "profesor1@noctium.local", mode: "insensitive" },
        NOT: { idUsuario: USUARIO },
      },
      select: { idUsuario: true },
    });
    expect(tx.profesor.update).toHaveBeenCalled();
  });

  it("email de otra cuenta → EMAIL_YA_ASOCIADO sin update", async () => {
    tx.profesor.findUnique.mockResolvedValue({ idProfesor: PROFESOR, usuarioId: USUARIO });
    tx.usuario.findFirst.mockResolvedValue({ idUsuario: OTRA_CUENTA });

    const error = await capturarError(
      actualizarContactoProfesor(PROFESOR, { email: "profesor2@noctium.local" }, USUARIO),
    );

    expect(error.code).toBe("EMAIL_YA_ASOCIADO");
    expect(tx.profesor.update).not.toHaveBeenCalled();
  });
});
