import { beforeEach, describe, expect, it, vi } from "vitest";

// HU-I-03 (delegación de B en el contrato público de Pagos): el service del
// alumno ya no lee `formas_pago` directo y conserva el comportamiento visible.

const { db, tx, catalogo } = vi.hoisted(() => {
  const tx = { alumno: { findUnique: vi.fn(), update: vi.fn() } };
  const db = {
    $transaction: vi.fn(async (callback: (cliente: typeof tx) => unknown) => callback(tx)),
    alumno: { findUnique: vi.fn() },
  };
  const catalogo = {
    verificarFormaPagoActiva: vi.fn(),
    obtenerFormaPago: vi.fn(),
    listarFormasPagoActivas: vi.fn(),
  };
  return { db, tx, catalogo };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/pagos/forma-pago.publico", () => catalogo);

const { actualizarFormaPagoPreferida, obtenerDetalleAlumno, listarFormasPagoActivas } = await import("./alumno.service");

const MENSAJE_NO_DISPONIBLE = "La forma de pago seleccionada ya no está disponible";

const filaAlumno = (formaPagoPreferidaId: string | null) => ({
  idAlumno: "a1",
  nombreAlumno: "Ana",
  apellidoAlumno: "Gómez",
  dniAlumno: "40123456",
  fechaNacimientoAlumno: new Date("2005-05-10T00:00:00.000Z"),
  generoAlumno: "FEMENINO",
  activoAlumno: true,
  telefonoAlumno: null,
  emailAlumno: null,
  formaPagoPreferidaId,
  createdAtAlumno: new Date("2026-01-01T12:00:00.000Z"),
  version: 3,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (callback: (cliente: typeof tx) => unknown) => callback(tx));
});

describe("actualizarFormaPagoPreferida (helper verificarFormaPagoActiva)", () => {
  beforeEach(() => {
    tx.alumno.findUnique.mockResolvedValue({ idAlumno: "a1" });
    tx.alumno.update.mockResolvedValue({ idAlumno: "a1", formaPagoPreferidaId: "fp1" });
  });

  it("consulta el contrato público de Pagos con el tx y guarda la preferida si está activa", async () => {
    catalogo.verificarFormaPagoActiva.mockResolvedValue({ id: "fp1", nombre: "Efectivo" });

    await expect(actualizarFormaPagoPreferida("a1", { forma_pago_id: "fp1" })).resolves.toEqual({
      id: "a1",
      forma_pago_preferida_id: "fp1",
    });

    expect(catalogo.verificarFormaPagoActiva).toHaveBeenCalledExactlyOnceWith("fp1", tx);
    expect(tx.alumno.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { formaPagoPreferidaId: "fp1" } }),
    );
  });

  it("lanza FORMA_PAGO_NO_DISPONIBLE con el mismo mensaje de siempre si es inexistente o inactiva", async () => {
    catalogo.verificarFormaPagoActiva.mockResolvedValue(null);

    await expect(actualizarFormaPagoPreferida("a1", { forma_pago_id: "fp-x" })).rejects.toMatchObject({
      code: "FORMA_PAGO_NO_DISPONIBLE",
      message: MENSAJE_NO_DISPONIBLE,
    });
    expect(tx.alumno.update).not.toHaveBeenCalled();
  });

  it("sin preferencia (null) no consulta el catálogo", async () => {
    tx.alumno.update.mockResolvedValue({ idAlumno: "a1", formaPagoPreferidaId: null });

    await actualizarFormaPagoPreferida("a1", { forma_pago_id: null });

    expect(catalogo.verificarFormaPagoActiva).not.toHaveBeenCalled();
  });
});

describe("obtenerDetalleAlumno (forma de pago preferida)", () => {
  it("muestra el nombre histórico de la preferida aunque esté inactiva", async () => {
    db.alumno.findUnique.mockResolvedValue(filaAlumno("fp-inactiva"));
    catalogo.obtenerFormaPago.mockResolvedValue({ id: "fp-inactiva", nombre: "Cheque", is_active: false });

    const detalle = await obtenerDetalleAlumno("a1");

    expect(catalogo.obtenerFormaPago).toHaveBeenCalledExactlyOnceWith("fp-inactiva");
    expect(detalle.forma_pago_preferida).toBe("Cheque");
    expect(detalle.forma_pago_preferida_activa).toBe(false);
    expect(detalle.forma_pago_preferida_id).toBe("fp-inactiva");
  });

  it("sin preferencia devuelve null y no consulta el catálogo", async () => {
    db.alumno.findUnique.mockResolvedValue(filaAlumno(null));

    const detalle = await obtenerDetalleAlumno("a1");

    expect(catalogo.obtenerFormaPago).not.toHaveBeenCalled();
    expect(detalle.forma_pago_preferida).toBeNull();
    expect(detalle.forma_pago_preferida_id).toBeNull();
  });

  it("ya no incluye la relación formaPagoPreferida en la consulta del alumno", async () => {
    db.alumno.findUnique.mockResolvedValue(filaAlumno(null));

    await obtenerDetalleAlumno("a1");

    const [args] = db.alumno.findUnique.mock.calls[0]!;
    expect(args).toEqual({ where: { idAlumno: "a1" } });
  });

  it("conserva el resto del shape del detalle", async () => {
    db.alumno.findUnique.mockResolvedValue(filaAlumno("fp1"));
    catalogo.obtenerFormaPago.mockResolvedValue({ id: "fp1", nombre: "Efectivo", is_active: true });

    await expect(obtenerDetalleAlumno("a1")).resolves.toEqual({
      id: "a1",
      nombre: "Ana",
      apellido: "Gómez",
      dni: "40123456",
      fecha_nacimiento: "2005-05-10",
      genero: "FEMENINO",
      is_active: true,
      telefono: null,
      email: null,
      forma_pago_preferida: "Efectivo",
      forma_pago_preferida_activa: true,
      forma_pago_preferida_id: "fp1",
      created_at: "2026-01-01T12:00:00.000Z",
      version: 3,
    });
  });

  it("un alumno inexistente sigue dando ALUMNO_NO_ENCONTRADO", async () => {
    db.alumno.findUnique.mockResolvedValue(null);

    await expect(obtenerDetalleAlumno("x")).rejects.toMatchObject({ code: "ALUMNO_NO_ENCONTRADO" });
    expect(catalogo.obtenerFormaPago).not.toHaveBeenCalled();
  });
});

describe("listarFormasPagoActivas de B", () => {
  it("conserva su nombre y delega en el contrato público de Pagos", async () => {
    const opciones = [{ id: "fp1", nombre: "Efectivo" }];
    catalogo.listarFormasPagoActivas.mockResolvedValue(opciones);

    await expect(listarFormasPagoActivas()).resolves.toBe(opciones);
    expect(catalogo.listarFormasPagoActivas).toHaveBeenCalledOnce();
  });
});
