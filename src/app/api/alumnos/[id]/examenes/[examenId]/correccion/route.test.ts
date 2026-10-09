import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ServiceError } from "@/server/shared/service-error";
import { ErrorDeDominio } from "@/server/shared/error-dominio";

const m = vi.hoisted(() => ({ corregir: vi.fn(), rol: "MESA_ENTRADA", permisos: [] as string[] }));
vi.mock("@/server/historial/resultado-examen.service", () => ({ corregirResultadoExamen: m.corregir }));
vi.mock("@/server/shared/with-permission", () => ({ withPermission: (permiso: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => {
  m.permisos.push(permiso);
  return (req: NextRequest, ctx: { params: Promise<unknown> }) => permiso === "examenes:corregir" && !["MESA_ENTRADA", "PROFESOR"].includes(m.rol)
    ? NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: "Sin permiso" } }, { status: 403 })
    : handler(Object.assign(req, { auth: { user: { id: "usuario-1", rol: m.rol } } }), ctx);
} }));
const { POST } = await import("./route");
const enviar = (body?: string) => POST(
  new NextRequest("http://localhost/api/alumnos/alumno-1/examenes/examen-1/correccion", { method: "POST", body }),
  { params: Promise.resolve({ id: "alumno-1", examenId: "examen-1" }) },
);

beforeEach(() => {
  vi.clearAllMocks(); m.rol = "MESA_ENTRADA";
  m.corregir.mockResolvedValue({ id: "correccion-1", resultado_id: "examen-1", fecha_examen: "2026-09-29", nota: "9.0" });
});

describe("HU-E-10 POST corrección", () => {
  it("requiere el permiso de corrección y devuelve 201", async () => {
    const r = await enviar(JSON.stringify({ nota: "9", motivo: "Se cargó mal la nota" }));
    expect(r.status).toBe(201);
    expect(m.permisos).toEqual(["examenes:corregir"]);
    expect(m.corregir).toHaveBeenCalledWith("alumno-1", "examen-1", { nota: "9", motivo: "Se cargó mal la nota" }, { id: "usuario-1", rol: "MESA_ENTRADA" });
    expect((await r.json()).error).toBeNull();
  });

  it.each([undefined, "{", "{}", JSON.stringify({ motivo: "" }), JSON.stringify({ materia_id: "otra", nota: "9", motivo: "Cambio" })])(
    "rechaza cuerpo inválido %s con 400", async (body) => {
      expect((await enviar(body)).status).toBe(400);
      expect(m.corregir).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["RESULTADO_NO_ENCONTRADO", 404], ["SIN_PERMISO", 403], ["PLAZO_CORRECCION_VENCIDO", 403],
    ["RESULTADO_ANULADO", 409], ["CORRECCION_SIN_CAMBIOS", 409], ["TRANSACCION_OCUPADA", 409],
  ])("mapea %s", async (code, status) => {
    const codigo = String(code);
    if (codigo === "SIN_PERMISO") m.corregir.mockRejectedValue(new ServiceError(codigo, "Error"));
    else if (codigo === "PLAZO_CORRECCION_VENCIDO") m.corregir.mockRejectedValue(new ErrorDeDominio("errores.correccion.plazoVencido"));
    else if (codigo === "TRANSACCION_OCUPADA") m.corregir.mockRejectedValue(new ErrorDeDominio("errores.transaccion.ocupada"));
    else if (codigo === "RESULTADO_NO_ENCONTRADO") m.corregir.mockRejectedValue(new ErrorDeDominio("errores.examen.resultadoNoEncontrado"));
    else if (codigo === "RESULTADO_ANULADO") m.corregir.mockRejectedValue(new ErrorDeDominio("errores.examen.resultadoAnulado"));
    else m.corregir.mockRejectedValue(new ErrorDeDominio("errores.examen.correccionSinCambios"));
    const r = await enviar(JSON.stringify({ nota: "9", motivo: "Cambio justificado" }));
    expect(r.status).toBe(status);
    expect((await r.json()).error.code).toBe(codigo);
  });

  it.each(["GERENTE", "ALUMNO"])("deniega a %s antes de llamar al servicio", async (rol) => {
    m.rol = rol;
    expect((await enviar(JSON.stringify({ nota: "9", motivo: "Cambio" }))).status).toBe(403);
    expect(m.corregir).not.toHaveBeenCalled();
  });
});
