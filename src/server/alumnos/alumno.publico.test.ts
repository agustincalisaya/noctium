import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, tx } = vi.hoisted(() => {
  const crear = () => ({
    $queryRaw: vi.fn(),
    alumno: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  });
  return { db: crear(), tx: crear() };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const publico = await import("./alumno.publico");
const servicio = await import("./alumno.service");
const {
  obtenerAlumnoDeUsuario,
  listarIdsAlumnosActivos,
  obtenerAlumnosBasicos,
  obtenerAlumnoBasico,
  verificarAlumnoActivo,
} = publico;

const conTx = tx as never;

const fila = (id: string, activo = true, formaPago: string | null = null) => ({
  idAlumno: id, nombreAlumno: `Nombre ${id}`, apellidoAlumno: `Apellido ${id}`,
  dniAlumno: `dni-${id}`, activoAlumno: activo, formaPagoPreferidaId: formaPago,
});

beforeEach(() => vi.clearAllMocks());

describe("listarIdsAlumnosActivos", () => {
  it("enumera únicamente IDs activos por la frontera pública y respeta el db recibido", async () => {
    tx.alumno.findMany.mockResolvedValue([{ idAlumno: "a1" }, { idAlumno: "a2" }]);
    await expect(listarIdsAlumnosActivos(conTx)).resolves.toEqual(["a1", "a2"]);
    expect(tx.alumno.findMany).toHaveBeenCalledWith({ where: { activoAlumno: true }, select: { idAlumno: true }, orderBy: { idAlumno: "asc" } });
    expect(db.alumno.findMany).not.toHaveBeenCalled();
  });
});

describe("obtenerAlumnoDeUsuario", () => {
  it("devuelve id y activo de la ficha vinculada, o null", async () => {
    db.alumno.findUnique.mockResolvedValueOnce({ idAlumno: "a1", activoAlumno: false }).mockResolvedValueOnce(null);
    await expect(obtenerAlumnoDeUsuario("u1")).resolves.toEqual({ id: "a1", activo: false });
    await expect(obtenerAlumnoDeUsuario("u2")).resolves.toBeNull();
    expect(db.alumno.findUnique).toHaveBeenCalledWith({
      where: { usuarioId: "u1" }, select: { idAlumno: true, activoAlumno: true },
    });
  });

  it("usa el db recibido", async () => {
    tx.alumno.findUnique.mockResolvedValue(null);
    await obtenerAlumnoDeUsuario("u1", conTx);
    expect(tx.alumno.findUnique).toHaveBeenCalledOnce();
    expect(db.alumno.findUnique).not.toHaveBeenCalled();
  });
});

describe("obtenerAlumnosBasicos", () => {
  it("devuelve activos e inactivos en el orden de entrada, sin inexistentes ni repetidos", async () => {
    db.alumno.findMany.mockResolvedValue([fila("a2", false, "fp1"), fila("a1")]);
    await expect(obtenerAlumnosBasicos(["a1", "x", "a2", "a1"])).resolves.toEqual([
      { id: "a1", nombre: "Nombre a1", apellido: "Apellido a1", dni: "dni-a1", activo: true, forma_pago_preferida_id: null },
      { id: "a2", nombre: "Nombre a2", apellido: "Apellido a2", dni: "dni-a2", activo: false, forma_pago_preferida_id: "fp1" },
    ]);
    expect(db.alumno.findMany).toHaveBeenCalledOnce();
    const [{ where }] = db.alumno.findMany.mock.calls[0]!;
    expect(where).toEqual({ idAlumno: { in: ["a1", "x", "a2"] } });
  });

  it("con lista vacía no consulta", async () => {
    await expect(obtenerAlumnosBasicos([])).resolves.toEqual([]);
    expect(db.alumno.findMany).not.toHaveBeenCalled();
  });

  it("con ids inexistentes devuelve []", async () => {
    db.alumno.findMany.mockResolvedValue([]);
    await expect(obtenerAlumnosBasicos(["x", "y"])).resolves.toEqual([]);
  });

  it("usa el db recibido", async () => {
    tx.alumno.findMany.mockResolvedValue([fila("a1")]);
    await obtenerAlumnosBasicos(["a1"], conTx);
    expect(tx.alumno.findMany).toHaveBeenCalledOnce();
    expect(db.alumno.findMany).not.toHaveBeenCalled();
  });
});

describe("obtenerAlumnoBasico", () => {
  it("devuelve activo o inactivo, y null si no existe", async () => {
    db.alumno.findUnique.mockResolvedValueOnce(fila("a1", false)).mockResolvedValueOnce(null);
    await expect(obtenerAlumnoBasico("a1")).resolves.toEqual({
      id: "a1", nombre: "Nombre a1", apellido: "Apellido a1", activo: false,
    });
    await expect(obtenerAlumnoBasico("x")).resolves.toBeNull();
    expect(db.alumno.findUnique.mock.calls[0]![0]).toMatchObject({ where: { idAlumno: "a1" } });
  });

  it("usa el db recibido", async () => {
    tx.alumno.findUnique.mockResolvedValue(null);
    await obtenerAlumnoBasico("a1", conTx);
    expect(tx.alumno.findUnique).toHaveBeenCalledOnce();
    expect(db.alumno.findUnique).not.toHaveBeenCalled();
  });
});

describe("verificarAlumnoActivo", () => {
  it("resuelve sin error si la ficha está activa", async () => {
    db.alumno.findUnique.mockResolvedValue({ activoAlumno: true });
    await expect(verificarAlumnoActivo("a1")).resolves.toBeUndefined();
  });

  it("lanza ALUMNO_NO_ENCONTRADO si la ficha no existe", async () => {
    db.alumno.findUnique.mockResolvedValue(null);
    await expect(verificarAlumnoActivo("x")).rejects.toMatchObject({
      name: "ServiceError", code: "ALUMNO_NO_ENCONTRADO", message: "El alumno ya no existe",
    });
  });

  it("lanza ALUMNO_INACTIVO si la ficha existe inactiva", async () => {
    db.alumno.findUnique.mockResolvedValue({ activoAlumno: false });
    await expect(verificarAlumnoActivo("a1")).rejects.toMatchObject({
      name: "ServiceError", code: "ALUMNO_INACTIVO", message: "El alumno está inactivo",
    });
  });

  it("usa el db recibido y no es la versión booleana del service", async () => {
    tx.alumno.findUnique.mockResolvedValue({ activoAlumno: true });
    await verificarAlumnoActivo("a1", conTx);
    expect(tx.alumno.findUnique).toHaveBeenCalledOnce();
    expect(db.alumno.findUnique).not.toHaveBeenCalled();
    expect(verificarAlumnoActivo).not.toBe(servicio.verificarAlumnoActivo);
  });
});

describe("buscarAlumnosActivos", () => {
  it("es la misma función que la del service", () => {
    expect(publico.buscarAlumnosActivos).toBe(servicio.buscarAlumnosActivos);
  });
});
