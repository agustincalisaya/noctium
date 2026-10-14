import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// HU-E-02 criterio 8 (spec_modulo_B.md §2.12 y §3.17 punto 6): el Gerente lee
// alumnos (listado, búsqueda, ficha y clases) y corrige o anula pagos
// (HU-I-06), pero toda escritura sobre alumnos le responde 403 SIN_PERMISO sin
// llegar al servicio. `withPermission`/`verificarPermiso` son los reales; la
// sesión, la cookie y `prisma` están simulados, y `roles_permisos` responde con
// los grants que el seed le da al Gerente.

const PERMISOS_GERENTE = new Set(["alumnos:leer", "historial:leer", "pagos:leer", "pagos:corregir"]);

const m = vi.hoisted(() => ({
  servicio: {
    listarAlumnos: vi.fn(), obtenerDetalleAlumno: vi.fn(), obtenerCuentaDeAlumno: vi.fn(),
    crearAlumno: vi.fn(), modificarAlumno: vi.fn(), actualizarContactoAlumno: vi.fn(), actualizarFormaPagoPreferida: vi.fn(),
  },
  estado: { desactivarAlumno: vi.fn(), reactivarAlumno: vi.fn(), obtenerImpactoBajaAlumno: vi.fn(), obtenerHistorialEstadosAlumno: vi.fn() },
  clases: vi.fn(),
  corregir: vi.fn(),
  anular: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (nombre: string) => (nombre === "authjs.session-token" ? { value: "token" } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/auth", () => {
  const sesion = { user: { id: "gerente-1", rol: "GERENTE" } };
  return {
    auth: (arg?: unknown) =>
      typeof arg === "function"
        ? (req: NextRequest, ctx: unknown) => (arg as (r: unknown, c: unknown) => unknown)(Object.assign(req, { auth: sesion }), ctx)
        : Promise.resolve(sesion),
    decodificarToken: async () => ({ jti: "jti-1", iat_sesion: 1_800_000_000 }),
    obtenerIp: () => "127.0.0.1",
  };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tokenRevocado: { findUnique: async () => null },
    usuario: { findUnique: async () => ({ activoUsuario: true, sesionesValidasDesdeUsuario: null, debeCambiarPasswordUsuario: false }) },
    rolPermiso: {
      findUnique: async ({ where }: { where: { rolPermiso_accionPermiso: { rolPermiso: string; accionPermiso: string } } }) => {
        const { rolPermiso, accionPermiso } = where.rolPermiso_accionPermiso;
        return rolPermiso === "GERENTE" && PERMISOS_GERENTE.has(accionPermiso) ? { rolPermiso, accionPermiso } : null;
      },
    },
  },
}));
vi.mock("@/server/alumnos/alumno.service", () => m.servicio);
vi.mock("@/server/alumnos/alumno.estado.service", () => m.estado);
vi.mock("@/server/historial/clases-alumno.service", () => ({ listarClasesDelAlumno: m.clases }));
vi.mock("@/server/pagos/correccion.flujos", () => ({ corregirPagoFlujo: m.corregir, anularPagoFlujo: m.anular }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: async (_c: string, porDefecto: number) => porDefecto }));

type Handler = (req: NextRequest, ctx: unknown) => Promise<Response>;
const ALUMNO = "ckalumno00000000000000001";
const PAGO = "ckpago0000000000000000001";

const listado = await import("./route");
const ficha = await import("./[id]/route");
const contacto = await import("./[id]/contacto/route");
const formaPago = await import("./[id]/forma-pago/route");
const desactivar = await import("./[id]/desactivar/route");
const reactivar = await import("./[id]/reactivar/route");
const impactoBaja = await import("./[id]/impacto-baja/route");
const clases = await import("./[id]/clases/route");
const correccion = await import("@/app/api/pagos/[id]/correccion/route");
const anulacion = await import("@/app/api/pagos/[id]/anulacion/route");
const acciones = await import("@/server/alumnos/actions");

async function llamar(handler: unknown, url: string, metodo = "GET", cuerpo?: unknown, id = ALUMNO) {
  const req = new NextRequest(`http://localhost${url}`, {
    method: metodo,
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo), headers: { "Content-Type": "application/json" } }),
  });
  const respuesta = await (handler as Handler)(req, { params: Promise.resolve({ id }) });
  return { status: respuesta.status, cuerpo: await respuesta.json() };
}

const SIN_PERMISO = { code: "SIN_PERMISO", message: "No tenés permisos para acceder a esta sección" };

beforeEach(() => {
  vi.clearAllMocks();
  m.servicio.listarAlumnos.mockResolvedValue({ items: [], paginacion: { total: 0, pagina_actual: 1, total_paginas: 0, por_pagina: 20 } });
  m.servicio.obtenerDetalleAlumno.mockResolvedValue({ id: ALUMNO, nombre: "Ana", apellido: "Pérez", is_active: true, version: 1 });
  m.servicio.obtenerCuentaDeAlumno.mockResolvedValue({ estado: "SIN_CUENTA" });
  m.estado.obtenerHistorialEstadosAlumno.mockResolvedValue([]);
  m.clases.mockResolvedValue({ items: [] });
  m.corregir.mockResolvedValue({ pago_id: PAGO });
  m.anular.mockResolvedValue({ pago_id: PAGO });
});

describe("Gerente: lecturas de alumnos permitidas", () => {
  it("GET /api/alumnos con búsqueda → 200", async () => {
    const r = await llamar(listado.GET, "/api/alumnos?q=perez&pagina=1");
    expect(r.status).toBe(200);
    expect(m.servicio.listarAlumnos).toHaveBeenCalledWith(expect.objectContaining({ q: "perez" }));
  });

  it("GET /api/alumnos/[id] → 200", async () => {
    const r = await llamar(ficha.GET, `/api/alumnos/${ALUMNO}`);
    expect(r.status).toBe(200);
    expect(r.cuerpo.data).toMatchObject({ id: ALUMNO });
  });

  it("GET /api/alumnos/[id]/clases → 200", async () => {
    const r = await llamar(clases.GET, `/api/alumnos/${ALUMNO}/clases`);
    expect(r.status).toBe(200);
    expect(m.clases).toHaveBeenCalled();
  });
});

describe("Gerente: toda escritura sobre alumnos → 403 SIN_PERMISO sin llegar al servicio", () => {
  const CASOS: [string, () => Promise<{ status: number; cuerpo: { error: unknown } }>][] = [
    ["POST /api/alumnos", () => llamar(listado.POST, "/api/alumnos", "POST", { nombre: "Ana", apellido: "Pérez", dni: "30111222" })],
    ["PATCH /api/alumnos/[id]", () => llamar(ficha.PATCH, `/api/alumnos/${ALUMNO}`, "PATCH", { version: 1, nombre: "Ana María" })],
    ["PATCH /api/alumnos/[id]/contacto", () => llamar(contacto.PATCH, `/api/alumnos/${ALUMNO}/contacto`, "PATCH", { telefono: "1155550000" })],
    ["PATCH /api/alumnos/[id]/forma-pago", () => llamar(formaPago.PATCH, `/api/alumnos/${ALUMNO}/forma-pago`, "PATCH", { forma_pago_id: null })],
    ["POST /api/alumnos/[id]/desactivar", () => llamar(desactivar.POST, `/api/alumnos/${ALUMNO}/desactivar`, "POST", { version: 1 })],
    ["POST /api/alumnos/[id]/reactivar", () => llamar(reactivar.POST, `/api/alumnos/${ALUMNO}/reactivar`, "POST", { version: 1 })],
    ["GET /api/alumnos/[id]/impacto-baja", () => llamar(impactoBaja.GET, `/api/alumnos/${ALUMNO}/impacto-baja`)],
  ];

  it.each(CASOS)("%s", async (_ruta, ejecutar) => {
    const r = await ejecutar();
    expect(r).toEqual({ status: 403, cuerpo: { data: null, error: SIN_PERMISO } });
    for (const fn of [...Object.values(m.servicio), ...Object.values(m.estado)]) {
      if (fn !== m.servicio.obtenerDetalleAlumno) expect(fn).not.toHaveBeenCalled();
    }
  });

  it.each([
    ["desactivarAlumno", () => acciones.desactivarAlumno(ALUMNO, { version: 1 })],
    ["reactivarAlumno", () => acciones.reactivarAlumno(ALUMNO, { version: 1 })],
  ])("Server Action %s → SIN_PERMISO", async (_accion, ejecutar) => {
    expect(await ejecutar()).toEqual({ data: null, error: SIN_PERMISO });
    expect(m.estado.desactivarAlumno).not.toHaveBeenCalled();
    expect(m.estado.reactivarAlumno).not.toHaveBeenCalled();
  });
});

describe("Gerente: corrige y anula pagos (HU-I-06, pagos:corregir)", () => {
  it("POST /api/pagos/[id]/correccion llega al servicio con el rol del Gerente", async () => {
    const r = await llamar(correccion.POST, `/api/pagos/${PAGO}/correccion`, "POST", { monto: "11000", motivo: "Se cargó mal" }, PAGO);
    expect(r.status).toBe(200);
    expect(m.corregir).toHaveBeenCalledWith(PAGO, expect.objectContaining({ monto: "11000", motivo: "Se cargó mal" }), { id: "gerente-1", rol: "GERENTE" });
  });

  it("POST /api/pagos/[id]/anulacion llega al servicio con el rol del Gerente", async () => {
    const r = await llamar(anulacion.POST, `/api/pagos/${PAGO}/anulacion`, "POST", { motivo: "Reintegro" }, PAGO);
    expect(r.status).toBe(200);
    expect(m.anular).toHaveBeenCalledWith(PAGO, expect.objectContaining({ motivo: "Reintegro" }), { id: "gerente-1", rol: "GERENTE" });
  });
});
