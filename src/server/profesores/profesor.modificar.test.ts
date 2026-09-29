import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ServiceError } from "@/server/shared/service-error";

// HU-D-06: construirModificarProfesorSchema() y modificarProfesor()
// (spec_modulo_D.md §2.6), con `prisma` mockeado. Incluye el conflicto de
// versión provocado por un cambio de contacto hecho desde la pantalla de
// HU-D-02 (D-06-5).

const tx = {
  profesor: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  usuario: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  profesorMateria: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
  horarioProfesor: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((callback: (cliente: typeof tx) => unknown) => callback(tx)),
  },
}));

vi.mock("@/server/materias/materia.service", () => ({
  bloquearMateriasParaAsociar: vi.fn(),
}));

const { construirModificarProfesorSchema } = await import("@/server/profesores/profesor.schema");
const { modificarProfesor, actualizarContactoProfesor } = await import("@/server/profesores/profesor.service");

const ID = "ckprofesor000000000000001";
const USUARIO = "ckusuario0000000000000001";
const CUENTA_PROPIA = "ckusuario0000000000000009";

/** Rossi, Martín (seed): activo, con cuenta, teléfono y email. */
const ROSSI = {
  usuarioId: CUENTA_PROPIA,
  nombreProfesor: "Martín",
  apellidoProfesor: "Rossi",
  dniProfesor: "28100002",
  fechaNacimientoProfesor: new Date(Date.UTC(1982, 6, 25)),
  generoProfesor: "MASCULINO",
  telefonoProfesor: "+541155600002",
  emailProfesor: "profesor2@noctium.local",
  version: 3,
};

const schema = construirModificarProfesorSchema(7, 8);

async function capturarError(promesa: Promise<unknown>): Promise<ServiceError> {
  try {
    await promesa;
  } catch (error) {
    return error as ServiceError;
  }
  throw new Error("Se esperaba un error");
}

function errorDe(resultado: ReturnType<typeof schema.safeParse>, campo: string): string | undefined {
  return resultado.success ? undefined : resultado.error.issues.find((i) => i.path[0] === campo)?.message;
}

function sinEscrituraAjena() {
  expect(tx.usuario.update).not.toHaveBeenCalled();
  expect(tx.usuario.updateMany).not.toHaveBeenCalled();
  expect(tx.profesorMateria.createMany).not.toHaveBeenCalled();
  expect(tx.profesorMateria.deleteMany).not.toHaveBeenCalled();
  expect(tx.horarioProfesor.create).not.toHaveBeenCalled();
  expect(tx.horarioProfesor.deleteMany).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.profesor.findUnique.mockResolvedValue(ROSSI);
  tx.profesor.findFirst.mockResolvedValue(null);
  tx.profesor.updateMany.mockResolvedValue({ count: 1 });
  tx.usuario.findFirst.mockResolvedValue(null);
});

describe("construirModificarProfesorSchema (criterio 1: mismas validaciones que el alta)", () => {
  it("solo version es válido y los campos ausentes no aparecen en el output", () => {
    const r = schema.safeParse({ version: 0 });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ version: 0 });
  });

  it("normaliza nombre y apellido igual que el alta", () => {
    const r = schema.safeParse({ nombre: "  María   José ", apellido: "de la  Fuente", version: 1 });
    expect(r.data).toMatchObject({ nombre: "María José", apellido: "de la Fuente" });
  });

  it("rechaza nombre con números o de 1 carácter con los mensajes del alta", () => {
    expect(errorDe(schema.safeParse({ nombre: "Ana1", version: 1 }), "nombre")).toBe(
      "El nombre solo admite letras, espacios, acentos, apóstrofes y guiones",
    );
    expect(errorDe(schema.safeParse({ nombre: "A", version: 1 }), "nombre")).toBe(
      "El nombre debe tener al menos 2 caracteres",
    );
  });

  it.each(["12", "123456789", "12.345.678"])("rechaza el DNI %s", (dni) => {
    expect(schema.safeParse({ dni, version: 1 }).success).toBe(false);
  });

  it("rechaza fecha futura y menor de 18 años", () => {
    const hoy = new Date();
    const futura = `${hoy.getUTCFullYear() + 1}-01-01`;
    const menor = `${hoy.getUTCFullYear() - 10}-01-01`;
    expect(errorDe(schema.safeParse({ fechaNacimiento: futura, version: 1 }), "fechaNacimiento")).toBeDefined();
    expect(errorDe(schema.safeParse({ fechaNacimiento: menor, version: 1 }), "fechaNacimiento")).toBe(
      "El profesor debe ser mayor de edad (18 años cumplidos)",
    );
  });

  it("genero null vuelve a sin especificar; un valor ajeno se rechaza", () => {
    expect(schema.safeParse({ genero: null, version: 1 }).data).toEqual({ genero: null, version: 1 });
    expect(schema.safeParse({ genero: "X", version: 1 }).success).toBe(false);
  });

  it("teléfono: normaliza, admite null y rechaza vacío o corto", () => {
    expect(schema.safeParse({ telefono: "(0387) 15-412-3456", version: 1 }).data?.telefono).toBe("0387154123456");
    expect(schema.safeParse({ telefono: null, version: 1 }).data?.telefono).toBeNull();
    for (const telefono of ["", "   ", "1234567"]) {
      expect(schema.safeParse({ telefono, version: 1 }).success).toBe(false);
    }
  });

  it("email: trim + minúsculas, admite null y rechaza vacío", () => {
    expect(schema.safeParse({ email: "  Ana@Mail.COM ", version: 1 }).data?.email).toBe("ana@mail.com");
    expect(schema.safeParse({ email: null, version: 1 }).data?.email).toBeNull();
    expect(schema.safeParse({ email: "", version: 1 }).success).toBe(false);
  });

  it("exige version entera no negativa y rechaza campos fuera de alcance (criterio 5)", () => {
    expect(schema.safeParse({ nombre: "Ana" }).success).toBe(false);
    expect(schema.safeParse({ version: -1 }).success).toBe(false);
    for (const extra of [{ activo: false }, { usuarioId: "x" }, { materiaIds: [] }, { direccion: "Calle 1" }]) {
      expect(schema.safeParse({ version: 1, ...extra }).success).toBe(false);
    }
  });
});

describe("modificarProfesor (spec_modulo_D.md §2.6)", () => {
  it("modifica solo el teléfono: updateMany con version, auditoría y nada más", async () => {
    const r = await modificarProfesor(ID, { telefono: "0387154123456", version: 3 }, USUARIO);

    expect(r).toEqual({ id: ID, campos_modificados: ["telefono"], version: 4 });
    const { where, data } = tx.profesor.updateMany.mock.calls[0]![0];
    expect(where).toEqual({ idProfesor: ID, version: 3 });
    expect(data).toEqual({
      telefonoProfesor: "0387154123456",
      version: { increment: 1 },
      modificadoPorUsuarioId: USUARIO,
    });
    sinEscrituraAjena();
  });

  it("modifica solo el apellido: recalcula las dos claves de orden", async () => {
    const r = await modificarProfesor(ID, { apellido: "Álvarez", version: 3 }, USUARIO);

    expect(r.campos_modificados).toEqual(["apellido"]);
    expect(tx.profesor.updateMany.mock.calls[0]![0].data).toMatchObject({
      apellidoProfesor: "Álvarez",
      apellidoNormalizadoProfesor: "alvarez",
      nombreNormalizadoProfesor: "martin",
    });
  });

  it("un cambio solo de acento es un cambio", async () => {
    const r = await modificarProfesor(ID, { nombre: "Martin", version: 3 }, USUARIO);
    expect(r.campos_modificados).toEqual(["nombre"]);
  });

  it("sin cambios reales no escribe ni sube la version", async () => {
    const r = await modificarProfesor(
      ID,
      {
        nombre: "Martín",
        dni: "28100002",
        fechaNacimiento: new Date(Date.UTC(1982, 6, 25)),
        genero: "MASCULINO",
        email: "profesor2@noctium.local",
        version: 3,
      },
      USUARIO,
    );

    expect(r).toEqual({ id: ID, campos_modificados: [], version: 3 });
    expect(tx.profesor.updateMany).not.toHaveBeenCalled();
    expect(tx.profesor.findFirst).not.toHaveBeenCalled();
    expect(tx.usuario.findFirst).not.toHaveBeenCalled();
  });

  it("DNI de otro profesor (activo o inactivo) → DNI_DUPLICADO, excluyendo la propia ficha", async () => {
    tx.profesor.findFirst.mockResolvedValue({ idProfesor: "ckprofesor000000000000005" });

    const error = await capturarError(modificarProfesor(ID, { dni: "31100005", version: 3 }, USUARIO));

    expect(error.code).toBe("DNI_DUPLICADO");
    expect(error.message).toBe("Ya existe un profesor registrado con ese DNI");
    expect(tx.profesor.findFirst).toHaveBeenCalledWith({
      where: { dniProfesor: "31100005", NOT: { idProfesor: ID } },
      select: { idProfesor: true },
    });
    // Sin filtro de activoProfesor: cubre activos e inactivos.
    expect(tx.profesor.findFirst.mock.calls[0]![0].where).not.toHaveProperty("activoProfesor");
    expect(tx.profesor.updateMany).not.toHaveBeenCalled();
  });

  it("DNI igual al propio no consulta duplicados", async () => {
    await modificarProfesor(ID, { dni: "28100002", version: 3 }, USUARIO);
    expect(tx.profesor.findFirst).not.toHaveBeenCalled();
  });

  it("DNI nuevo libre se guarda", async () => {
    const r = await modificarProfesor(ID, { dni: "28100099", version: 3 }, USUARIO);
    expect(r.campos_modificados).toEqual(["dni"]);
    expect(tx.profesor.updateMany.mock.calls[0]![0].data.dniProfesor).toBe("28100099");
  });

  it("P2002 sobre dniProfesor → DNI_DUPLICADO; sobre otro campo se propaga", async () => {
    const p2002 = (target: string[]) =>
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target },
      });

    tx.profesor.updateMany.mockRejectedValueOnce(p2002(["dniProfesor"]));
    expect((await capturarError(modificarProfesor(ID, { dni: "28100099", version: 3 }, USUARIO))).code).toBe(
      "DNI_DUPLICADO",
    );

    const otro = p2002(["usuarioId"]);
    tx.profesor.updateMany.mockRejectedValueOnce(otro);
    await expect(modificarProfesor(ID, { dni: "28100099", version: 3 }, USUARIO)).rejects.toBe(otro);
  });

  it("quitar el único medio de contacto → CONTACTO_REQUERIDO sin escribir (N-2)", async () => {
    tx.profesor.findUnique.mockResolvedValue({ ...ROSSI, telefonoProfesor: null }); // Vega: solo email

    const error = await capturarError(modificarProfesor(ID, { email: null, version: 3 }, USUARIO));

    expect(error.code).toBe("CONTACTO_REQUERIDO");
    expect(error.message).toBe("Ingresá al menos un teléfono o un email de contacto");
    expect(tx.profesor.updateMany).not.toHaveBeenCalled();
  });

  it("reemplazar un medio por otro en el mismo guardado es válido", async () => {
    tx.profesor.findUnique.mockResolvedValue({ ...ROSSI, emailProfesor: null }); // Acuña: solo teléfono

    const r = await modificarProfesor(ID, { telefono: null, email: "sergio.acuna@example.com", version: 3 }, USUARIO);

    expect(r.campos_modificados).toEqual(["telefono", "email"]);
    expect(tx.profesor.updateMany.mock.calls[0]![0].data).toMatchObject({
      telefonoProfesor: null,
      emailProfesor: "sergio.acuna@example.com",
    });
  });

  it("profesor sin contacto: corrige identidad sin exigir contacto; email null no es cambio", async () => {
    tx.profesor.findUnique.mockResolvedValue({ ...ROSSI, usuarioId: null, telefonoProfesor: null, emailProfesor: null });

    expect((await modificarProfesor(ID, { nombre: "Rocio", version: 3 }, USUARIO)).campos_modificados).toEqual([
      "nombre",
    ]);
    vi.clearAllMocks();
    tx.profesor.findUnique.mockResolvedValue({ ...ROSSI, usuarioId: null, telefonoProfesor: null, emailProfesor: null });
    expect(await modificarProfesor(ID, { email: null, version: 3 }, USUARIO)).toEqual({
      id: ID,
      campos_modificados: [],
      version: 3,
    });
    expect(tx.profesor.updateMany).not.toHaveBeenCalled();
  });

  it("email nuevo de otra cuenta → EMAIL_YA_ASOCIADO, excluyendo la cuenta propia", async () => {
    tx.usuario.findFirst.mockResolvedValue({ idUsuario: "ckusuario0000000000000002" });

    const error = await capturarError(modificarProfesor(ID, { email: "profesor1@noctium.local", version: 3 }, USUARIO));

    expect(error.code).toBe("EMAIL_YA_ASOCIADO");
    expect(tx.usuario.findFirst).toHaveBeenCalledWith({
      where: {
        emailUsuario: { equals: "profesor1@noctium.local", mode: "insensitive" },
        NOT: { idUsuario: CUENTA_PROPIA },
      },
      select: { idUsuario: true },
    });
    expect(tx.profesor.updateMany).not.toHaveBeenCalled();
  });

  it("profesor sin cuenta: la verificación de email no excluye ninguna cuenta", async () => {
    tx.profesor.findUnique.mockResolvedValue({ ...ROSSI, usuarioId: null });

    await modificarProfesor(ID, { email: "nuevo@example.com", version: 3 }, USUARIO);

    expect(tx.usuario.findFirst.mock.calls[0]![0].where).not.toHaveProperty("NOT");
  });

  it("cambiar el email de contacto no toca la cuenta (spec §2.6 paso 7)", async () => {
    const r = await modificarProfesor(ID, { email: "martin.rossi@example.com", version: 3 }, USUARIO);

    expect(r.campos_modificados).toEqual(["email"]);
    sinEscrituraAjena();
  });

  it("genero null vuelve a sin especificar", async () => {
    const r = await modificarProfesor(ID, { genero: null, version: 3 }, USUARIO);
    expect(r.campos_modificados).toEqual(["genero"]);
    expect(tx.profesor.updateMany.mock.calls[0]![0].data.generoProfesor).toBeNull();
  });

  it("updateMany con count 0 → CONFLICTO_EDICION_CONCURRENTE", async () => {
    tx.profesor.updateMany.mockResolvedValue({ count: 0 });

    const error = await capturarError(modificarProfesor(ID, { nombre: "Ana", version: 2 }, USUARIO));

    expect(error.code).toBe("CONFLICTO_EDICION_CONCURRENTE");
  });

  it("profesor inexistente → PROFESOR_NO_ENCONTRADO", async () => {
    tx.profesor.findUnique.mockResolvedValue(null);
    expect((await capturarError(modificarProfesor(ID, { nombre: "Ana", version: 0 }, USUARIO))).code).toBe(
      "PROFESOR_NO_ENCONTRADO",
    );
  });

  it("un profesor inactivo se puede editar (no se filtra por activoProfesor)", async () => {
    const r = await modificarProfesor(ID, { telefono: "+541155609999", version: 3 }, USUARIO);
    expect(r.campos_modificados).toEqual(["telefono"]);
    expect(tx.profesor.findUnique.mock.calls[0]![0].where).toEqual({ idProfesor: ID });
    expect(tx.profesor.updateMany.mock.calls[0]![0].data).not.toHaveProperty("activoProfesor");
  });
});

describe("concurrencia con el cambio de contacto de HU-D-02 (D-06-5)", () => {
  /**
   * Fila de profesor en memoria: `update` (HU-D-02) y `updateMany` (HU-D-06)
   * aplican sus `data` sobre la misma fila y respetan `version`, así el test
   * reproduce dos pestañas sin depender de cómo se mockeó cada llamada.
   */
  function filaEnMemoria() {
    const fila = { ...ROSSI, idProfesor: ID };
    const aplicar = (data: Record<string, unknown>) => {
      for (const [columna, valor] of Object.entries(data)) {
        if (columna === "version") fila.version += (valor as { increment: number }).increment;
        else (fila as Record<string, unknown>)[columna] = valor;
      }
    };
    tx.profesor.findUnique.mockImplementation(async () => ({ ...fila }));
    tx.profesor.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      aplicar(data);
      return { ...fila };
    });
    tx.profesor.updateMany.mockImplementation(
      async ({ where, data }: { where: { version: number }; data: Record<string, unknown> }) => {
        if (where.version !== fila.version) return { count: 0 };
        aplicar(data);
        return { count: 1 };
      },
    );
    return fila;
  }

  it("actualizarContactoProfesor incrementa version en el mismo UPDATE", async () => {
    filaEnMemoria();

    await actualizarContactoProfesor(ID, { telefono: "0387154123456", email: undefined }, USUARIO);

    expect(tx.profesor.update.mock.calls[0]![0].data).toMatchObject({ version: { increment: 1 } });
  });

  it("la pestaña en modo edición no pisa un contacto cambiado desde /contacto: CONFLICTO_EDICION_CONCURRENTE", async () => {
    const fila = filaEnMemoria();
    const versionAlAbrirLaEdicion = fila.version; // pestaña 1 abre ?modo=edicion

    // Pestaña 2: cambia el contacto desde la pantalla de HU-D-02.
    await actualizarContactoProfesor(
      ID,
      { telefono: "0387154123456", email: "profesor2@noctium.local" },
      USUARIO,
    );
    expect(fila.version).toBe(versionAlAbrirLaEdicion + 1);

    // Pestaña 1: guarda con la version vieja.
    const error = await capturarError(
      modificarProfesor(ID, { telefono: "+541155601111", version: versionAlAbrirLaEdicion }, USUARIO),
    );

    expect(error.code).toBe("CONFLICTO_EDICION_CONCURRENTE");
    expect(fila.telefonoProfesor).toBe("0387154123456");
  });
});
