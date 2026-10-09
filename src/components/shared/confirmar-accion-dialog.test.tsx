// @vitest-environment jsdom
//
// Evidencia visual de la §6 de HU-C-25 (capturas de éxito, error inline y
// variante irreversible): no se arma una página de prueba en este PR; se saca
// con la primera HU que use el componente (probablemente HU-I-10).
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmarAccionDialog } from "./confirmar-accion-dialog";

const TITULO = "¿Estás seguro de que querés registrar el pago de $ 22.000 a nombre de Jorge Ruiz?";
const DETALLE = "Efectivo · fecha de pago 09/10/2026";

let root: Root;
let container: HTMLDivElement;
const onCerrar = vi.fn();
const onExito = vi.fn();

const dialogo = () => document.querySelector('[role="alertdialog"]');
const boton = (nombre: string) => [...document.querySelectorAll('[role="alertdialog"] button')].find((item) => item.textContent === nombre) as HTMLButtonElement;

/** Padre controlado: `onCerrar` pasa `abierto` a false, como haría una pantalla real. */
function Padre({ onConfirmar, irreversible }: { onConfirmar: () => Promise<void>; irreversible?: boolean }) {
  const [abierto, setAbierto] = useState(true);
  return (
    <ConfirmarAccionDialog
      abierto={abierto}
      titulo={TITULO}
      detalle={<p>{DETALLE}</p>}
      textoConfirmar="Registrar pago"
      irreversible={irreversible}
      onConfirmar={onConfirmar}
      onExito={onExito}
      onCerrar={() => { onCerrar(); setAbierto(false); }}
    />
  );
}

const montar = async (onConfirmar: () => Promise<void> = async () => {}, irreversible?: boolean) =>
  act(async () => { root.render(<Padre onConfirmar={onConfirmar} irreversible={irreversible} />); });

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("HU-C-25 ConfirmarAccionDialog", () => {
  it("renderiza título, detalle y los botones Volver / verbo de la acción", async () => {
    await montar();
    expect(dialogo()!.textContent).toContain(TITULO);
    expect(dialogo()!.textContent).toContain(DETALLE);
    expect([...dialogo()!.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Volver", "Registrar pago"]);
  });

  it("con abierto=false no renderiza nada", async () => {
    await act(async () => {
      root.render(<ConfirmarAccionDialog abierto={false} titulo={TITULO} textoConfirmar="Registrar pago" onConfirmar={async () => {}} onCerrar={onCerrar} />);
    });
    expect(dialogo()).toBeNull();
  });

  it("«Volver» cierra sin llamar a onConfirmar", async () => {
    const onConfirmar = vi.fn(async () => {});
    await montar(onConfirmar);
    await act(async () => boton("Volver").click());
    expect(onCerrar).toHaveBeenCalledOnce();
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(onExito).not.toHaveBeenCalled();
  });

  it("llama a onConfirmar una sola vez y deshabilita ambos botones mientras está pendiente", async () => {
    let resolver: () => void = () => {};
    const onConfirmar = vi.fn(() => new Promise<void>((resolve) => { resolver = resolve; }));
    await montar(onConfirmar);
    await act(async () => { boton("Registrar pago").click(); });
    expect(boton("Volver").disabled).toBe(true);
    expect(boton("Procesando…").disabled).toBe(true);
    await act(async () => { boton("Procesando…").click(); });
    expect(onConfirmar).toHaveBeenCalledOnce();
    await act(async () => resolver());
  });

  it("si onConfirmar resuelve: cierra y llama a onExito", async () => {
    await montar();
    await act(async () => boton("Registrar pago").click());
    expect(onCerrar).toHaveBeenCalledOnce();
    expect(onExito).toHaveBeenCalledOnce();
    expect(dialogo()?.getAttribute("data-open") ?? null).toBeNull();
  });

  it("si onConfirmar rechaza: muestra el mensaje inline, no llama a onExito y sigue abierto", async () => {
    await montar(async () => { throw new Error("mensaje de prueba"); });
    await act(async () => boton("Registrar pago").click());
    const alerta = dialogo()!.querySelector('[role="alert"]');
    expect(alerta?.textContent).toBe("mensaje de prueba");
    expect(alerta?.className).toContain("bg-destructive-soft");
    expect(onExito).not.toHaveBeenCalled();
    expect(onCerrar).not.toHaveBeenCalled();
    expect(boton("Registrar pago").disabled).toBe(false);
  });

  it("al reintentar con éxito tras un rechazo, limpia el error, cierra y llama a onExito", async () => {
    const onConfirmar = vi.fn().mockRejectedValueOnce(new Error("mensaje de prueba")).mockResolvedValueOnce(undefined);
    await montar(onConfirmar);
    await act(async () => boton("Registrar pago").click());
    expect(dialogo()!.textContent).toContain("mensaje de prueba");
    await act(async () => boton("Registrar pago").click());
    expect(onConfirmar).toHaveBeenCalledTimes(2);
    expect(onExito).toHaveBeenCalledOnce();
    expect(onCerrar).toHaveBeenCalledOnce();
  });

  it("irreversible: muestra la leyenda, botón en rojo y foco inicial en «Volver»", async () => {
    await montar(async () => {}, true);
    expect(dialogo()!.textContent).toContain("Esta acción no se puede deshacer.");
    expect(boton("Registrar pago").className).toContain("bg-destructive");
  });

  it.each([
    ["irreversible", true, () => boton("Volver")],
    ["sin irreversible", false, () => document.querySelector('[role="alertdialog"] a')],
  ])("foco inicial %s, con un link en el detalle antes de los botones", async (_caso, irreversible, enfocado) => {
    // Sin `initialFocus`, Base UI enfoca el primer elemento tabulable (el link):
    // así se comprueba que el foco en «Volver» lo pone el componente.
    await act(async () => {
      root.render(
        <ConfirmarAccionDialog abierto titulo={TITULO} detalle={<a href="#comprobante">Ver comprobante</a>} textoConfirmar="Anular pago"
          irreversible={irreversible} onConfirmar={async () => {}} onCerrar={onCerrar} />,
      );
    });
    // Base UI mueve el foco después de montar el popup.
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 50));
    });
    expect(document.activeElement).toBe(enfocado());
  });

  it.each([["sin irreversible", undefined], ["irreversible=false", false]])("%s: sin leyenda ni estilo de peligro", async (_caso, irreversible) => {
    await montar(async () => {}, irreversible);
    expect(dialogo()!.textContent).not.toContain("Esta acción no se puede deshacer.");
    expect(boton("Registrar pago").className).not.toContain("bg-destructive");
  });
});
