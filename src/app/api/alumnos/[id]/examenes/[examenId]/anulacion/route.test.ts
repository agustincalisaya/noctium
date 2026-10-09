import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
const m = vi.hoisted(() => ({ anular: vi.fn(), rol: "MESA_ENTRADA", permisos: [] as string[] }));
vi.mock("@/server/historial/resultado-examen.service", () => ({ anularResultadoExamen: m.anular }));
vi.mock("@/server/shared/with-permission", () => ({ withPermission: (permiso: string, handler: (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>) => {
  m.permisos.push(permiso);
  return (req: NextRequest, ctx: { params: Promise<unknown> }) => permiso === "examenes:corregir" && !["MESA_ENTRADA", "PROFESOR"].includes(m.rol)
    ? NextResponse.json({ data: null, error: { code: "SIN_PERMISO", message: "Sin permiso" } }, { status: 403 })
    : handler(Object.assign(req, { auth: { user: { id: "usuario-1", rol: m.rol } } }), ctx);
} }));
const { POST } = await import("./route");
const enviar = (body?: string) => POST(
  new NextRequest("http://localhost/api/alumnos/alumno-1/examenes/examen-1/anulacion", { method: "POST", body }),
  { params: Promise.resolve({ id: "alumno-1", examenId: "examen-1" }) },
);
beforeEach(() => { vi.clearAllMocks(); m.rol = "MESA_ENTRADA"; m.anular.mockResolvedValue({ id: "anulacion-1", resultado_id: "examen-1", motivo: "Alumno equivocado" }); });

describe("HU-E-10 POST anulación", () => {
  it("exige motivo y responde 201 con el sobre de API", async () => {
    expect((await enviar(JSON.stringify({ motivo: "Alumno equivocado" }))).status).toBe(201);
    expect(m.permisos).toEqual(["examenes:corregir"]);
    expect(m.anular).toHaveBeenCalledWith("alumno-1", "examen-1", { motivo: "Alumno equivocado" }, { id: "usuario-1", rol: "MESA_ENTRADA" });
  });
  it.each([undefined, "{", "{}", JSON.stringify({ motivo: "   " }), JSON.stringify({ motivo: "x".repeat(301) }), JSON.stringify({ motivo: "ok", fecha_examen: "2026-01-01" })])(
    "rechaza cuerpo inválido %s", async (body) => { expect((await enviar(body)).status).toBe(400); expect(m.anular).not.toHaveBeenCalled(); },
  );
  it("mapea resultado ausente y rol sin permiso", async () => {
    m.anular.mockRejectedValue(new ErrorDeDominio("errores.examen.resultadoNoEncontrado"));
    expect((await enviar(JSON.stringify({ motivo: "Motivo válido" }))).status).toBe(404);
    m.rol = "GERENTE"; m.anular.mockClear();
    expect((await enviar(JSON.stringify({ motivo: "Motivo válido" }))).status).toBe(403);
    expect(m.anular).not.toHaveBeenCalled();
  });
});
