import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { vencerReservas } = vi.hoisted(() => ({ vencerReservas: vi.fn() }));
vi.mock("@/server/turnos/reserva.vencimiento.service", () => ({ vencerReservas }));

const { POST } = await import("./route");
const SECRETO = "secreto-de-prueba";
const llamada = (autorizacion?: string) => new Request("http://localhost/api/procesos/vencer-reservas", {
  method: "POST", headers: autorizacion === undefined ? {} : { authorization: autorizacion },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", SECRETO);
  vencerReservas.mockResolvedValue({ reservasVencidas: 3, clasesAfectadas: 2, ejecutadoEl: new Date("2026-10-09T18:35:00.000Z") });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/procesos/vencer-reservas (HU-C-24, C §2.18.1)", () => {
  it("con el secreto correcto ejecuta el proceso y responde el contrato", async () => {
    const respuesta = await POST(llamada(`Bearer ${SECRETO}`));
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({
      data: { reservas_vencidas: 3, clases_afectadas: 2, ejecutado_el: "2026-10-09T15:35:00-03:00" }, error: null,
    });
    expect(vencerReservas).toHaveBeenCalledTimes(1);
  });

  it("una corrida sin nada que vencer responde 200 con ceros", async () => {
    vencerReservas.mockResolvedValue({ reservasVencidas: 0, clasesAfectadas: 0, ejecutadoEl: new Date("2026-10-09T18:35:00.000Z") });
    const respuesta = await POST(llamada(`Bearer ${SECRETO}`));
    expect(respuesta.status).toBe(200);
    expect((await respuesta.json()).data).toMatchObject({ reservas_vencidas: 0, clases_afectadas: 0 });
  });

  it.each([
    ["sin cabecera", undefined],
    ["con otro secreto", "Bearer otro-secreto"],
    ["con el secreto como prefijo", `Bearer ${SECRETO}-extra`],
    ["con otro esquema", `Basic ${SECRETO}`],
    ["sin esquema", SECRETO],
    ["con el esquema vacío", "Bearer "],
  ])("%s responde 401 sin ejecutar nada", async (_caso, autorizacion) => {
    const respuesta = await POST(llamada(autorizacion));
    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toEqual({ data: null, error: { code: "NO_AUTORIZADO", message: "No autorizado" } });
    expect(vencerReservas).not.toHaveBeenCalled();
  });

  it("sin CRON_SECRET configurado rechaza siempre, también una cabecera vacía de secreto", async () => {
    vi.stubEnv("CRON_SECRET", "");
    for (const autorizacion of [`Bearer ${SECRETO}`, "Bearer ", undefined]) {
      expect((await POST(llamada(autorizacion))).status).toBe(401);
    }
    expect(vencerReservas).not.toHaveBeenCalled();
  });

  it("el cuerpo del 401 no revela el motivo: es el mismo con y sin secreto configurado", async () => {
    const conSecreto = await (await POST(llamada("Bearer mal"))).json();
    vi.stubEnv("CRON_SECRET", "");
    const sinSecreto = await (await POST(llamada("Bearer mal"))).json();
    expect(sinSecreto).toEqual(conSecreto);
  });
});
