import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ErrorDeDominio } from "@/server/shared/error-dominio";
import { ServiceError } from "@/server/shared/service-error";

// POST /api/auth/autorregistro/verificar-codigo (HU-B-08, rama b) con la
// ficha dada de baja (HU-B-07): el servicio está simulado.

const m = vi.hoisted(() => ({ confirmar: vi.fn() }));
vi.mock("@/auth", () => ({ obtenerIp: () => "190.0.0.1" }));
vi.mock("@/server/alumnos/autorregistro.service", () => ({ confirmarCodigoAutorregistro: m.confirmar }));

const { POST } = await import("./route");
const SOLICITUD = "cksolicitud000000000000001";
const CUENTA_YA_EXISTE = "Ya existe una cuenta con esos datos. Iniciá sesión o solicitá asistencia en mesa de entrada.";

async function enviar(body: unknown) {
  const respuesta = await POST(new NextRequest("http://localhost/api/auth/autorregistro/verificar-codigo", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }));
  return { status: respuesta.status, cuerpo: await respuesta.json() };
}
const valido = { solicitud_id: SOLICITUD, codigo: "123456" };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/auth/autorregistro/verificar-codigo", () => {
  it("200 con la cuenta creada", async () => {
    m.confirmar.mockResolvedValue({ alumno_id: "a", usuario_id: "u", email: "ana@mail.com" });
    expect(await enviar(valido)).toEqual({ status: 200, cuerpo: { data: { alumno_id: "a", usuario_id: "u", email: "ana@mail.com" }, error: null } });
    expect(m.confirmar).toHaveBeenCalledWith(SOLICITUD, "123456", "190.0.0.1");
  });

  it("400 VALIDACION sin llamar al servicio si el código no tiene seis dígitos", async () => {
    const { status, cuerpo } = await enviar({ solicitud_id: SOLICITUD, codigo: "12" });
    expect(status).toBe(400);
    expect(cuerpo.error.code).toBe("VALIDACION");
    expect(m.confirmar).not.toHaveBeenCalled();
  });

  it("ficha dada de baja entre el pedido y la confirmación: 409 CUENTA_YA_EXISTE con el mismo cuerpo que la rama (c)", async () => {
    m.confirmar.mockRejectedValue(new ServiceError("CUENTA_YA_EXISTE", CUENTA_YA_EXISTE));
    expect(await enviar(valido)).toEqual({ status: 409, cuerpo: { data: null, error: { code: "CUENTA_YA_EXISTE", message: CUENTA_YA_EXISTE } } });
  });

  it("transacción ocupada: 409 TRANSACCION_OCUPADA con su code, no un 500", async () => {
    m.confirmar.mockRejectedValue(new ErrorDeDominio("errores.transaccion.ocupada"));
    expect(await enviar(valido)).toEqual({
      status: 409,
      cuerpo: { data: null, error: { code: "TRANSACCION_OCUPADA", message: "Otra persona está modificando estos datos. Intentá de nuevo." } },
    });
  });

  it.each([
    ["SOLICITUD_NO_ENCONTRADA", 404],
    ["CODIGO_INVALIDO", 422],
    ["CODIGO_VENCIDO", 422],
    ["INTENTOS_AGOTADOS", 422],
  ])("%s conserva su %i", async (code, status) => {
    m.confirmar.mockRejectedValue(new ServiceError(code, "mensaje"));
    expect(await enviar(valido)).toEqual({ status, cuerpo: { data: null, error: { code, message: "mensaje" } } });
  });

  it("un error inesperado responde 500 ERROR_INTERNO sin detalle técnico", async () => {
    m.confirmar.mockRejectedValue(new Error("fallo de conexión con la base"));
    expect(await enviar(valido)).toEqual({ status: 500, cuerpo: { data: null, error: { code: "ERROR_INTERNO", message: "No se pudo completar la operación" } } });
  });
});
