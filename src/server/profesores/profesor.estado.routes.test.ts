import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ servicio: vi.fn(), permiso: vi.fn(), rol: "GERENTE" }));
vi.mock("@/server/shared/with-permission", () => ({ withPermission: (permiso: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) => {
  m.permiso(permiso);
  return (req: NextRequest, ctx: unknown) => (m.permiso(permiso), m.rol !== "GERENTE") ? Response.json({ data: null, error: { code: "SIN_PERMISO" } }, { status: 403 }) : handler(Object.assign(req, { auth: { user: { id: "actor" } } }), ctx);
} }));
vi.mock("@/server/profesores/profesor.estado.service", () => ({ obtenerImpactoBajaProfesor: m.servicio, desactivarProfesor: m.servicio, reactivarProfesor: m.servicio, listarTurnosFuturosParaBaja: m.servicio, cancelarTurnosFuturosDeProfesor: m.servicio, previsualizarCambioDeProfesor: m.servicio, cambiarProfesorDeTurnosFuturos: m.servicio }));
import { ErrorDeDominio } from "@/server/shared/error-dominio";
const rutas = [
  ["impacto-baja", (await import("@/app/api/profesores/[id]/impacto-baja/route")).GET, undefined],
  ["desactivar", (await import("@/app/api/profesores/[id]/desactivar/route")).POST, { version: 0 }],
  ["reactivar", (await import("@/app/api/profesores/[id]/reactivar/route")).POST, { version: 1 }],
  ["turnos-futuros", (await import("@/app/api/profesores/[id]/turnos-futuros/route")).GET, undefined],
  ["turnos-futuros/cancelacion", (await import("@/app/api/profesores/[id]/turnos-futuros/cancelacion/route")).POST, { turno_ids: ["ckturno00000000000000001"] }],
  ["turnos-futuros/cambio-profesor/previsualizacion", (await import("@/app/api/profesores/[id]/turnos-futuros/cambio-profesor/previsualizacion/route")).POST, { turno_ids: ["ckturno00000000000000001"], profesor_destino_id: "ckprofesor000000000000001" }],
  ["turnos-futuros/cambio-profesor", (await import("@/app/api/profesores/[id]/turnos-futuros/cambio-profesor/route")).POST, { turno_ids: ["ckturno00000000000000001"], profesor_destino_id: "ckprofesor000000000000001" }],
] as const;
const llamar = async (ruta: typeof rutas[number], cuerpo: unknown = ruta[2]) => (ruta[1] as unknown as (req: NextRequest, ctx: unknown) => Promise<Response>)(new NextRequest(`http://localhost/api/profesores/id/${ruta[0]}`, cuerpo === undefined ? undefined : { method: "POST", body: JSON.stringify(cuerpo) }), { params: Promise.resolve({ id: "profesor" }) });
beforeEach(() => { m.servicio.mockReset().mockResolvedValue({ ok: true }); m.rol = "GERENTE"; });
describe("HU-D-08 rutas delgadas", () => {

  it.each(rutas)("%s devuelve envelope y propaga actor cuando muta", async (...ruta) => {
    const res = await llamar(ruta);
    expect(m.permiso).toHaveBeenCalledWith("profesores:cambiar_estado");
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ data: { ok: true }, error: null });
    expect(m.servicio.mock.calls[0][0]).toBe("profesor");
    if (ruta[2] && !ruta[0].includes("previsualizacion")) expect(m.servicio.mock.calls[0][2]).toEqual({ tipo: "USUARIO", usuarioId: "actor" });
  });
  it.each(rutas.filter((r) => r[2]))("%s rechaza payload inválido sin invocar servicio", async (...ruta) => {
    expect((await llamar(ruta, {})).status).toBe(400); expect(m.servicio).not.toHaveBeenCalled();
  });
  it.each(rutas)("%s traduce un conflicto de dominio", async (...ruta) => {
    m.servicio.mockRejectedValue(new ErrorDeDominio("errores.profesor.conClasesFuturas", { total: 3, pendientes: 1 }));
    const res = await llamar(ruta); expect(res.status).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: "PROFESOR_CON_CLASES_FUTURAS", total: 3, pendientes: 1 });
  });
});
