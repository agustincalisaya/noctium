// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAutenticado, exito, fallo } = vi.hoisted(() => ({
  fetchAutenticado: vi.fn(), exito: vi.fn(), fallo: vi.fn(),
}));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado }));
vi.mock("sonner", () => ({ toast: { success: exito, error: fallo } }));

const { CancelarTurnoDialog } = await import("./cancelar-turno-dialog");
const { MENSAJE_RESULTADO_INCIERTO } = await import("./turno-acciones-mensajes");
const respuesta = (status: number, data: unknown = null, error: unknown = null) => ({
  ok: status >= 200 && status < 300, status, json: async () => ({ data, error }),
});
let root: Root;
let container: HTMLDivElement;
const cerrar = vi.fn();
const cambio = vi.fn(async () => {});
const RESUMEN = "Matemática III · Mar 06/10, 16:00–17:00 · Aula 3 · 3 alumnos inscriptos";
const dialogo = () => document.querySelector('[role="alertdialog"]');
const boton = (nombre: string) => [...document.querySelectorAll('[role="alertdialog"] button')].find((item) => item.textContent === nombre) as HTMLButtonElement;
const montar = async (props: { modo?: "cancelar" | "descartar"; cantidadPagos?: number; resumen?: string } = {}) => act(async () => {
  root.render(<CancelarTurnoDialog turnoId="turno-1" modo={props.modo ?? "cancelar"} resumen={"resumen" in props ? props.resumen : RESUMEN}
    cantidadPagos={props.cantidadPagos} onCerrar={cerrar} onCambio={cambio} />);
});

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  fetchAutenticado.mockResolvedValue(respuesta(200, { id: "turno-1", estado: "CANCELADO" }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("HU-C-05 AlertDialog de cancelación (mockup pág. 8)", () => {
  it("AC1: título y texto literal con el resumen del turno; botones Volver / Cancelar turno", async () => {
    await montar();
    expect(dialogo()!.textContent).toContain("¿Confirmás cancelar este turno?");
    expect(dialogo()!.textContent).toContain(`${RESUMEN}. Esta acción no se puede deshacer.`);
    expect([...dialogo()!.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Volver", "Cancelar turno"]);
  });

  it("«Volver» cierra sin llamar a la API", async () => {
    await montar();
    await act(async () => boton("Volver").click());
    expect(cerrar).toHaveBeenCalledOnce();
    expect(fetchAutenticado).not.toHaveBeenCalled();
  });

  it("AC3: confirma, informa «Turno cancelado correctamente» y recarga", async () => {
    await montar();
    await act(async () => boton("Cancelar turno").click());
    expect(fetchAutenticado).toHaveBeenCalledExactlyOnceWith("/api/turnos/turno-1/cancelacion", { method: "POST", cache: "no-store" });
    expect(cerrar).toHaveBeenCalledOnce();
    expect(exito).toHaveBeenCalledExactlyOnceWith("Turno cancelado correctamente");
    expect(cambio).toHaveBeenCalledOnce();
  });

  it("no envía dos veces con doble click", async () => {
    let resolver: (valor: unknown) => void = () => {};
    fetchAutenticado.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    await montar();
    await act(async () => { boton("Cancelar turno").click(); });
    await act(async () => { boton("Procesando…").click(); });
    expect(fetchAutenticado).toHaveBeenCalledOnce();
    expect(boton("Volver").disabled).toBe(true);
    await act(async () => resolver(respuesta(200, { id: "turno-1", estado: "CANCELADO" })));
  });

  it("N-3: con pagos visibles avisa cuántos hay y que no se reembolsan", async () => {
    await montar({ cantidadPagos: 2 });
    expect(dialogo()!.textContent).toContain("Este turno tiene 2 pagos registrados; no se reembolsan automáticamente");
    await act(async () => root.render(<CancelarTurnoDialog turnoId="turno-1" modo="cancelar" resumen={RESUMEN} cantidadPagos={1} onCerrar={cerrar} onCambio={cambio} />));
    expect(dialogo()!.textContent).toContain("Este turno tiene 1 pago registrado; no se reembolsan automáticamente");
  });

  it.each([["sin pagos", 0], ["sin permiso pagos:leer (propiedad ausente)", undefined]])("N-3: %s no muestra aviso", async (_caso, cantidadPagos) => {
    await montar({ cantidadPagos });
    expect(dialogo()!.textContent).not.toContain("registrado");
  });

  it("N-1: modo descartar usa su propio texto y toast «Turno descartado»", async () => {
    await montar({ modo: "descartar", resumen: undefined, cantidadPagos: 3 });
    expect(dialogo()!.textContent).toContain("¿Confirmás descartar este turno?");
    expect(dialogo()!.textContent).toContain("Esta acción no se puede deshacer.");
    expect(dialogo()!.textContent).not.toContain("pagos");
    expect([...dialogo()!.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Volver", "Descartar turno"]);
    await act(async () => boton("Descartar turno").click());
    expect(exito).toHaveBeenCalledExactlyOnceWith("Turno descartado");
  });

  it("409 (p. ej. ya cancelado o vencido): muestra el error del servidor, cierra y recarga", async () => {
    fetchAutenticado.mockResolvedValue(respuesta(409, null, { code: "TURNO_VENCIDO", message: "El horario del turno ya pasó: no se puede cancelar" }));
    await montar();
    await act(async () => boton("Cancelar turno").click());
    expect(fallo).toHaveBeenCalledExactlyOnceWith("El horario del turno ya pasó: no se puede cancelar");
    expect(exito).not.toHaveBeenCalled();
    expect(cerrar).toHaveBeenCalledOnce();
    expect(cambio).toHaveBeenCalledOnce();
  });

  it("403: muestra el error y deja el diálogo abierto", async () => {
    fetchAutenticado.mockResolvedValue(respuesta(403, null, { code: "SIN_PERMISO", message: "No tenés permisos para acceder a esta sección" }));
    await montar();
    await act(async () => boton("Cancelar turno").click());
    expect(fallo).toHaveBeenCalledExactlyOnceWith("No tenés permisos para acceder a esta sección");
    expect(cerrar).not.toHaveBeenCalled();
    expect(cambio).not.toHaveBeenCalled();
  });

  it.each([
    ["un 500 (p. ej. evento posterior al commit)", () => fetchAutenticado.mockResolvedValue(respuesta(500, null, { message: "Error interno" }))],
    ["un fallo de red", () => fetchAutenticado.mockRejectedValue(new TypeError("Failed to fetch"))],
  ])("T-PC: ante %s cierra, avisa que hay que verificar y recarga", async (_caso, preparar) => {
    preparar();
    await montar();
    await act(async () => boton("Cancelar turno").click());
    expect(cerrar).toHaveBeenCalledOnce();
    expect(fallo).toHaveBeenCalledExactlyOnceWith(MENSAJE_RESULTADO_INCIERTO);
    expect(MENSAJE_RESULTADO_INCIERTO).toBe("No pudimos confirmar si el cambio se guardó. Revisá el detalle actualizado antes de reintentar.");
    expect(exito).not.toHaveBeenCalled();
    expect(cambio).toHaveBeenCalledOnce();
  });
});
