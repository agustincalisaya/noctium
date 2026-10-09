import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import type { CodigoErrorDominio } from "@/server/shared/errores-dominio";

// Rutas de turnos que llaman a los servicios del PR 0 (PR-0.md §2.0 y 5.5):
// un ErrorDeDominio con un code nuevo responde el HTTP de su catálogo; los
// code que ya existían en los Sprints 1 y 2 conservan la respuesta de hoy (1.1).
const { servicios } = vi.hoisted(() => ({
  servicios: { agregar: vi.fn(), quitar: vi.fn(), solicitar: vi.fn(), asignar: vi.fn(), cancelar: vi.fn(), reprogramar: vi.fn() },
}));
vi.mock("@/server/turnos/turno.service", () => ({
  agregarAlumnoTurno: servicios.agregar, quitarAlumnoTurno: servicios.quitar,
  solicitarTurnoPropio: servicios.solicitar, asignarParticipantesTurno: servicios.asignar,
}));
vi.mock("@/server/turnos/turno.cancelacion.service", () => ({ cancelarTurno: servicios.cancelar }));
vi.mock("@/server/turnos/turno.reprogramacion.service", () => ({ reprogramarTurno: servicios.reprogramar }));
vi.mock("@/server/shared/with-permission", () => ({
  withPermission: (_permiso: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    (req: NextRequest, ctx: unknown) => handler(Object.assign(req, { auth: { user: { id: "usuario-1", rol: "MESA_ENTRADA" } } }), ctx),
}));

const alumnos = await import("./alumnos/route");
const quitar = await import("./alumnos/[alumnoId]/route");
const inscripcion = await import("./inscripcion/route");
const participantes = await import("./participantes/route");
const cancelacion = await import("./cancelacion/route");
const reprogramacion = await import("./reprogramacion/route");

const TURNO = "ckturno00000000000000001";
const ALUMNO = "ckalumno00000000000000001";
const pedido = (metodo: string, ruta: string, body?: unknown) =>
  new NextRequest(`http://localhost/api/turnos/${TURNO}${ruta}`, {
    method: metodo, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
  });
const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve({ id: TURNO, ...params }) });

const RUTAS = [
  { nombre: "POST /alumnos", servicio: servicios.agregar, llamar: () => alumnos.POST(pedido("POST", "/alumnos", { alumno_id: ALUMNO }), ctx()) },
  { nombre: "DELETE /alumnos/[alumnoId]", servicio: servicios.quitar, llamar: () => quitar.DELETE(pedido("DELETE", `/alumnos/${ALUMNO}`), ctx({ alumnoId: ALUMNO })) },
  { nombre: "POST /inscripcion", servicio: servicios.solicitar, llamar: () => inscripcion.POST(pedido("POST", "/inscripcion"), ctx()) },
  { nombre: "PATCH /participantes", servicio: servicios.asignar, llamar: () => participantes.PATCH(pedido("PATCH", "/participantes", { alumno_ids: [ALUMNO] }), ctx()) },
  { nombre: "POST /cancelacion", servicio: servicios.cancelar, llamar: () => cancelacion.POST(pedido("POST", "/cancelacion"), ctx()) },
  { nombre: "PATCH /reprogramacion", servicio: servicios.reprogramar, llamar: () => reprogramacion.PATCH(pedido("PATCH", "/reprogramacion", { fecha: "2030-10-07", hora_inicio: "17:00" }), ctx()) },
];

beforeEach(() => vi.clearAllMocks());

describe("rutas de turnos: códigos nuevos del PR 0 con el HTTP de su catálogo", () => {
  it.each(RUTAS.flatMap((ruta) => ([
    ["errores.inscripcion.materiaSinTarifaCentro", 422],
    ["errores.transaccion.ocupada", 409],
    ["errores.inscripcion.noVigente", 409],
    ["errores.inscripcion.noEncontrada", 404],
  ] as const).map(([codigo, status]) => [ruta.nombre, codigo, status, ruta] as const)))("%s responde %s con %i", async (_nombre, codigo, status, ruta) => {
    const error = new ErrorDeDominio(codigo as CodigoErrorDominio);
    ruta.servicio.mockRejectedValue(error);
    const respuesta = await ruta.llamar();
    expect(respuesta.status).toBe(status);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: error.code, message: error.message } });
  });
});

describe("rutas de turnos: los códigos de los Sprints 1 y 2 conservan su respuesta de hoy", () => {
  // Por ErrorDeDominio, con un HTTP de catálogo distinto del que daba la ruta: manda la ruta.
  it.each([
    ["POST /alumnos", "errores.alumno.noEncontrado", 409],
    ["POST /alumnos", "errores.turno.noEncontrado", 404],
    ["POST /alumnos", "errores.turno.cupoInsuficiente", 409],
    ["POST /inscripcion", "errores.alumno.noEncontrado", 409],
    ["PATCH /participantes", "errores.inscripcion.alumnoNoAsignado", 409],
    ["PATCH /participantes", "errores.alumno.noEncontrado", 404],
    ["DELETE /alumnos/[alumnoId]", "errores.inscripcion.alumnoNoAsignado", 404],
    ["POST /cancelacion", "errores.alumno.noEncontrado", 409],
    ["PATCH /reprogramacion", "errores.turno.noEncontrado", 404],
  ] as const)("%s responde %s con %i, como hoy", async (nombre, codigo, status) => {
    const ruta = RUTAS.find((r) => r.nombre === nombre)!;
    const error = new ErrorDeDominio(codigo);
    ruta.servicio.mockRejectedValue(error);
    const respuesta = await ruta.llamar();
    expect(respuesta.status).toBe(status);
    expect((await respuesta.json()).error).toMatchObject({ code: error.code, message: error.message });
  });
});
