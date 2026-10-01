import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ServiceError } from "@/server/shared/service-error";

const { permiso, cookie, calcular, generar } = vi.hoisted(() => ({ permiso: vi.fn(), cookie: vi.fn(), calcular: vi.fn(), generar: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { rolPermiso: { findUnique: permiso } } }));
vi.mock("@/server/turnos/turno.generacion.service", () => ({ vistaPreviaGeneracion: calcular, confirmarGeneracion: generar }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock("@/auth", () => ({
  auth: (handler: (req: NextRequest) => Promise<Response>) => (req: NextRequest) =>
    handler(Object.assign(req, { auth: { user: { id: "usuario", rol: "MESA_ENTRADAS" } } })),
  decodificarToken: vi.fn(),
}));

const { POST: confirmar } = await import("./route");
const { POST: vistaPrevia } = await import("./vista-previa/route");
const valido = {
  materia_id: "materia-1", profesor_id: "ckprofesor000000000000001", horario_id: "ckhorario000000000000001",
  duracion_min: 120, hora_inicio: "15:30", aula_id: "ckaula00000000000000001",
  fecha_desde: "2026-10-01", fecha_hasta: "2026-10-31",
};
const rutas = [
  ["vista previa", vistaPrevia, "vista-previa"],
  ["confirmación", confirmar, ""],
] as const;
const enviar = (post: typeof confirmar, segmento: string, body: unknown) => post(new NextRequest(`http://localhost/api/turnos/generacion/${segmento}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}), { params: Promise.resolve({}) });

beforeEach(() => {
  vi.clearAllMocks(); permiso.mockResolvedValue({});
  calcular.mockResolvedValue({ cantidad: 1, fechas: [{ fecha: "2026-10-01", estado: "OK", motivos: [] }], hay_conflictos: false, fechas_omitidas_vencidas: 0 });
  generar.mockResolvedValue({ generacion_id: "lote-1", cantidad: 1, turno_ids: ["turno-1"] });
});

describe.each(rutas)("POST %s de generación: contrato compartido", (_nombre, post, segmento) => {
  it("exige turnos:crear", async () => {
    await enviar(post, segmento, valido);
    expect(permiso).toHaveBeenCalledWith({ where: { rolPermiso_accionPermiso: { rolPermiso: "MESA_ENTRADAS", accionPermiso: "turnos:crear" } } });
  });

  it.each([
    { duracion_min: 90 },
    { fecha_desde: "2026-02-30" },
    { fecha_desde: "2026-11-01" },
    { campo_inesperado: true },
  ])("rechaza payload inválido con {data,error}", async (cambio) => {
    const respuesta = await enviar(post, segmento, { ...valido, ...cambio });
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "VALIDATION_ERROR", message: "Datos inválidos" } });
  });

  it("rechaza JSON malformado", async () => {
    const respuesta = await post(new NextRequest(`http://localhost/api/turnos/generacion/${segmento}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{",
    }), { params: Promise.resolve({}) });
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "VALIDATION_ERROR" } });
  });

  it("rechaza falta de permiso antes de parsear", async () => {
    permiso.mockResolvedValueOnce(null);
    const respuesta = await enviar(post, segmento, valido);
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toMatchObject({ data: null, error: { code: "SIN_PERMISO" } });
    expect(calcular).not.toHaveBeenCalled();
    expect(generar).not.toHaveBeenCalled();
  });
});

describe("POST vista previa", () => {
  it("devuelve {data,error} y delega el cálculo sin persistir", async () => {
    const respuesta = await enviar(vistaPrevia, "vista-previa", valido);
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ data: { cantidad: 1, fechas: [{ fecha: "2026-10-01", estado: "OK", motivos: [] }], hay_conflictos: false, fechas_omitidas_vencidas: 0 }, error: null });
    expect(calcular).toHaveBeenCalledOnce();
    expect(calcular.mock.calls[0]?.[0]).toMatchObject({ materia_id: valido.materia_id, fecha_desde: new Date("2026-10-01T00:00:00.000Z") });
  });

  it.each([
    ["FUERA_DE_FRANJA", 400], ["RANGO_EXCEDIDO", 400], ["SIN_FECHAS_EN_RANGO", 400],
    ["PROFESOR_NO_ENCONTRADO", 404], ["HORARIO_NO_ENCONTRADO", 404], ["SIN_AULAS_ACTIVAS", 404], ["AULA_NO_ENCONTRADA", 404],
    ["MATERIA_NO_DISPONIBLE", 409], ["PROFESOR_NO_DICTA_MATERIA", 409], ["AULA_INACTIVA", 409],
    ["CONFIGURACION_GENERACION_INCOMPLETA", 503],
  ] as const)("traduce %s a HTTP %i", async (codigo, status) => {
    calcular.mockRejectedValueOnce(new ServiceError(codigo, "Mensaje"));
    const respuesta = await enviar(vistaPrevia, "vista-previa", valido);
    expect(respuesta.status).toBe(status);
    expect(await respuesta.json()).toEqual({ data: null, error: { code: codigo, message: "Mensaje" } });
  });
});

describe("POST confirmación", () => {
  it("devuelve 201 con el contrato de generación y el usuario autenticado", async () => {
    const respuesta = await enviar(confirmar, "", valido);
    expect(respuesta.status).toBe(201);
    expect(await respuesta.json()).toEqual({ data: { generacion_id: "lote-1", cantidad: 1, turno_ids: ["turno-1"] }, error: null });
    expect(generar).toHaveBeenCalledOnce();
    expect(generar.mock.calls[0]?.[0]).toMatchObject({ materia_id: valido.materia_id });
    expect(generar.mock.calls[0]?.[1]).toBe("usuario");
    expect(calcular).not.toHaveBeenCalled();
  });

  it("409 incluye el mismo detalle por fecha recalculado por el servicio", async () => {
    const detalles = { cantidad: 1, fechas: [{ fecha: "2026-10-01", estado: "CONFLICTO", motivos: ["AULA_OCUPADA"] }], hay_conflictos: true, fechas_omitidas_vencidas: 0 };
    generar.mockRejectedValueOnce(new ServiceError("GENERACION_CON_CONFLICTOS", "Conflicto", detalles));
    const respuesta = await enviar(confirmar, "", valido);
    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toEqual({ data: null, error: { code: "GENERACION_CON_CONFLICTOS", message: "Conflicto", detalles } });
  });

  it.each([
    ["FUERA_DE_FRANJA", 400], ["RANGO_EXCEDIDO", 400], ["SIN_FECHAS_EN_RANGO", 400],
    ["PROFESOR_NO_ENCONTRADO", 404], ["HORARIO_NO_ENCONTRADO", 404], ["SIN_AULAS_ACTIVAS", 404], ["AULA_NO_ENCONTRADA", 404],
    ["MATERIA_NO_DISPONIBLE", 409], ["PROFESOR_NO_DICTA_MATERIA", 409], ["AULA_INACTIVA", 409],
    ["CONFIGURACION_GENERACION_INCOMPLETA", 503],
  ] as const)("traduce %s a HTTP %i", async (codigo, status) => {
    generar.mockRejectedValueOnce(new ServiceError(codigo, "Mensaje"));
    const respuesta = await enviar(confirmar, "", valido);
    expect(respuesta.status).toBe(status);
    expect(await respuesta.json()).toEqual({ data: null, error: { code: codigo, message: "Mensaje" } });
  });
});
