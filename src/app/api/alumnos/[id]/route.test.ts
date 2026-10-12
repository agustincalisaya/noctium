import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

// GET /api/alumnos/[id] (spec_modulo_B.md 2.12): el detalle con `cuenta` e
// `historial_estados`. El permiso y los servicios están simulados.

const m = vi.hoisted(() => ({ detalle: vi.fn(), cuenta: vi.fn(), historial: vi.fn(), permiso: vi.fn() }));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission:
    (accion: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    (req: NextRequest, ctx: unknown) => {
      m.permiso(accion);
      return handler(Object.assign(req, { auth: { user: { id: "mesa", rol: "MESA_ENTRADA" } } }), ctx);
    },
}));
vi.mock("@/server/alumnos/alumno.service", () => ({
  obtenerDetalleAlumno: m.detalle,
  obtenerCuentaDeAlumno: m.cuenta,
  modificarAlumno: vi.fn(),
}));
vi.mock("@/server/alumnos/alumno.estado.service", () => ({ obtenerHistorialEstadosAlumno: m.historial }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: async (_c: string, porDefecto: number) => porDefecto }));

const { GET } = await import("./route");
const ALUMNO = "ckalumno00000000000000001";

async function detalle() {
  const respuesta = await (GET as unknown as (req: NextRequest, ctx: unknown) => Promise<Response>)(
    new NextRequest(`http://localhost/api/alumnos/${ALUMNO}`),
    { params: Promise.resolve({ id: ALUMNO }) },
  );
  return { status: respuesta.status, cuerpo: await respuesta.json() };
}

const FICHA = { id: ALUMNO, nombre: "Ana", apellido: "Pérez", is_active: true, forma_pago_preferida_activa: false, version: 2 };
const CUENTA = { estado: "INACTIVA", email: "ana@mail.com", rol: "ALUMNO", debe_cambiar_password: false };
// Del más reciente al más antiguo: una reactivación después de una baja.
const HISTORIAL = [
  { fecha: "2026-10-12T14:03:00-03:00", accion: "REACTIVAR", usuario: { id: "u1", nombre_para_mostrar: "Ruiz, Marta" }, motivo: null },
  { fecha: "2026-10-05T09:00:00-03:00", accion: "DESACTIVAR", usuario: { id: "u1", nombre_para_mostrar: "Ruiz, Marta" }, motivo: "Se mudó" },
];

beforeEach(() => {
  vi.resetAllMocks();
  m.detalle.mockResolvedValue(FICHA);
  m.cuenta.mockResolvedValue(CUENTA);
  m.historial.mockResolvedValue(HISTORIAL);
});

describe("GET /api/alumnos/[id]", () => {
  it("pide alumnos:leer y devuelve los campos del detalle más cuenta e historial_estados, en el orden del servicio", async () => {
    const { status, cuerpo } = await detalle();
    expect(m.permiso).toHaveBeenCalledWith("alumnos:leer");
    expect(status).toBe(200);
    expect(cuerpo).toEqual({ data: { ...FICHA, cuenta: CUENTA, historial_estados: HISTORIAL }, error: null });
    expect(cuerpo.data.historial_estados.map((e: { accion: string }) => e.accion)).toEqual(["REACTIVAR", "DESACTIVAR"]);
    expect(m.historial).toHaveBeenCalledWith(ALUMNO);
  });

  it("ficha sin bajas: historial_estados es una lista vacía, no se omite", async () => {
    m.historial.mockResolvedValue([]);
    const { cuerpo } = await detalle();
    expect(cuerpo.data.historial_estados).toEqual([]);
  });

  it("alumno inexistente: 404 y ni cuenta ni historial en la respuesta", async () => {
    m.detalle.mockRejectedValue(new ServiceError("ALUMNO_NO_ENCONTRADO", "El alumno no existe"));
    const { status, cuerpo } = await detalle();
    expect(status).toBe(404);
    expect(cuerpo).toEqual({ data: null, error: { code: "ALUMNO_NO_ENCONTRADO", message: "El alumno no existe" } });
    expect(m.historial).not.toHaveBeenCalled();
  });
});
