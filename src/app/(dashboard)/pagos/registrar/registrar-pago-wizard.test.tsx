// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClasesPendientesDePago } from "@/types/pago.types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { fetch, replace } = vi.hoisted(() => ({ fetch: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/fetch-autenticado", () => ({ fetchAutenticado: fetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/components/sesion/link-protegido", async () => {
  const React = await import("react");
  return { LinkProtegido: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...props }, children) };
});

const { RegistrarPagoWizard } = await import("./registrar-pago-wizard");

type Respuesta = { ok: boolean; status: number; json: () => Promise<unknown> };
const respuesta = (data: unknown, ok = true, error: unknown = null): Respuesta =>
  ({ ok, status: ok ? 200 : 400, json: async () => ({ data: ok ? data : null, error }) });

const pendientes = (): ClasesPendientesDePago => ({
  alumno: { id: "a1", nombre_completo: "Domínguez, Lara", dni: "45976577", forma_pago_preferida_id: "f2" },
  clases: [
    { inscripcion_id: "i1", turno_id: "t1", fecha: "2026-10-12", hora_inicio: "18:00", hora_fin: "19:00", materia: { id: "m1", nombre: "Física I" },
      profesor: { id: "p1", nombre_completo: "Gómez, Laura" }, estado_pago: "RESERVADA", vence_el: "2026-10-11T18:00:00-03:00",
      precio: 12000, origen_precio: "INSCRIPCION", marcada: false },
    { inscripcion_id: null, turno_id: "t9", fecha: "2026-10-14", hora_inicio: "10:00", hora_fin: "11:00", materia: { id: "m2", nombre: "Química" },
      profesor: null, estado_pago: "SE_INSCRIBE_AL_PAGAR", vence_el: null, precio: 9000, origen_precio: "TARIFA_VIGENTE", marcada: false },
  ],
  formas_pago: [{ id: "f1", nombre: "Efectivo" }, { id: "f2", nombre: "Transferencia" }],
});

let root: Root;
let container: HTMLDivElement;
let rutas: (url: string, init?: RequestInit) => Respuesta | Promise<Respuesta> | undefined;

const boton = (nombre: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === nombre) as HTMLButtonElement;
const pulsar = (elemento: HTMLElement) => act(async () => { elemento.click(); });
const escribir = (input: HTMLInputElement, valor: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, valor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
const casilla = (materia: string) => container.querySelector(`input[type="checkbox"][aria-label^="Elegir ${materia}"]`) as HTMLInputElement;
const totalResumen = () => container.querySelector('[data-testid="total-resumen"]')?.textContent;
const dialogo = () => document.querySelector('[role="alertdialog"]');
const montar = (props: { alumnoInicialId?: string; claseInicialId?: string } = { alumnoInicialId: "a1" }) =>
  act(async () => { root.render(<RegistrarPagoWizard {...props} />); });

beforeEach(() => {
  vi.resetAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  rutas = (url) => url.startsWith("/api/pagos/pendientes") ? respuesta(pendientes()) : undefined;
  fetch.mockImplementation(async (url: string, init?: RequestInit) => (await rutas(url, init)) ?? respuesta(null, false, { code: "X", message: "ruta inesperada" }));
  Object.assign(window, { scrollTo: vi.fn() });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("HU-I-10 paso 1: buscar alumno", () => {
  it("busca solo desde 2 caracteres, con el endpoint de pagos, y al elegir pasa al paso 2", async () => {
    vi.useFakeTimers();
    rutas = (url) => url.startsWith("/api/pagos/buscar-alumnos") ? respuesta([{ id: "a1", nombre: "Lara", apellido: "Domínguez", dni: "45976577" }])
      : url.startsWith("/api/pagos/pendientes") ? respuesta(pendientes()) : undefined;
    await montar({});
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain("Alumno");
    const input = container.querySelector("#registrar-pago-buscador") as HTMLInputElement;
    await escribir(input, "l");
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(fetch).not.toHaveBeenCalled();
    await escribir(input, "la");
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(fetch).toHaveBeenCalledWith("/api/pagos/buscar-alumnos?q=la", expect.anything());
    await pulsar(boton("Domínguez, Lara · DNI 45976577"));
    expect(fetch).toHaveBeenCalledWith("/api/pagos/pendientes?alumno_id=a1", expect.anything());
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain("Clases");
    expect(container.textContent).toContain("Clases de Domínguez, Lara");
  });
  it("sin coincidencias muestra el texto de DESIGN.md §8.2", async () => {
    vi.useFakeTimers();
    rutas = () => respuesta([]);
    await montar({});
    await escribir(container.querySelector("#registrar-pago-buscador") as HTMLInputElement, "zz");
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(container.textContent).toContain("No se encontraron alumnos para «zz»");
  });
});

describe("HU-I-10 paso 2: clases del alumno", () => {
  it("muestra estado de pago y origen del precio; el total se recalcula al marcar, desmarcar y modificar el importe", async () => {
    await montar();
    expect(container.textContent).toContain("Reservada · pagar antes del Dom 11/10 18:00");
    expect(container.textContent).toContain("Se inscribe al confirmar el pago");
    expect(container.textContent).toContain("Fijado al inscribirse");
    expect(container.textContent).toContain("Tarifa vigente");
    expect(totalResumen()).toBe("$ 0");
    await pulsar(casilla("Física I"));
    await pulsar(casilla("Química"));
    expect(totalResumen()).toBe("$ 21.000");
    await pulsar(casilla("Química"));
    expect(totalResumen()).toBe("$ 12.000");
    await pulsar(boton("Modificar importe"));
    await escribir(container.querySelector("#importe-i1") as HTMLInputElement, "10000");
    expect(totalResumen()).toBe("$ 10.000");
  });
  it("no avanza sin clases elegidas ni con un importe distinto sin motivo", async () => {
    await montar();
    await pulsar(boton("Continuar a confirmación"));
    expect(container.textContent).toContain("Elegí al menos una clase.");
    await pulsar(casilla("Física I"));
    await pulsar(boton("Modificar importe"));
    await escribir(container.querySelector("#importe-i1") as HTMLInputElement, "10000");
    await pulsar(boton("Continuar a confirmación"));
    expect(container.textContent).toContain("Ingresá el motivo del cambio de importe.");
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain("Clases");
  });
  it("sin clases pendientes muestra el aviso y ofrece buscar otro alumno", async () => {
    rutas = () => respuesta({ ...pendientes(), clases: [] });
    await montar();
    expect(container.textContent).toContain("Este alumno no tiene clases pendientes de pago");
    await pulsar(boton("Buscar otro alumno"));
    expect(container.querySelector("#registrar-pago-buscador")).not.toBeNull();
  });
  it("con ?alumno=&clase= pide la clase preelegida", async () => {
    await montar({ alumnoInicialId: "a1", claseInicialId: "t9" });
    expect(fetch).toHaveBeenCalledWith("/api/pagos/pendientes?alumno_id=a1&turno_id=t9", expect.anything());
  });
});

describe("HU-I-10 paso 3: forma de pago y confirmación", () => {
  const irAlPaso3 = async () => {
    await montar();
    await pulsar(casilla("Física I"));
    await pulsar(boton("Continuar a confirmación"));
  };

  it("preselecciona la forma preferida y arma el título del diálogo con formatearMonto y el nombre del alumno", async () => {
    await irAlPaso3();
    expect((container.querySelector("#registrar-pago-forma") as HTMLSelectElement).value).toBe("f2");
    await pulsar(boton("Confirmar pago"));
    expect(dialogo()?.textContent).toContain("¿Estás seguro de que querés registrar el pago de $ 12.000 a nombre de Domínguez, Lara?");
    expect(dialogo()?.textContent).toContain("Física I · Lun 12/10 18:00");
    expect(dialogo()?.textContent).toContain("Transferencia · fecha de pago");
    // La operación se puede corregir o anular después (HU-I-06): no es irreversible.
    expect(dialogo()?.textContent).not.toContain("Esta acción no se puede deshacer.");
  });
  it("MOTIVO_AJUSTE_REQUERIDO: el diálogo no se cierra, muestra el aviso de tarifa y recarga el precio", async () => {
    rutas = (url) => url.startsWith("/api/pagos/pendientes") ? respuesta(pendientes())
      : url === "/api/pagos/operaciones" ? respuesta(null, false, {
        code: "MOTIVO_AJUSTE_REQUERIDO", message: "El monto es distinto del precio de la clase: ingresá el motivo del ajuste.",
        detalles: { turno_id: "t1", materia: "Física I", precio_vigente: 13000 },
      }) : undefined;
    await irAlPaso3();
    await pulsar(boton("Confirmar pago"));
    await pulsar(boton("Registrar pago"));
    expect(dialogo()).not.toBeNull();
    expect(dialogo()?.querySelector('[role="alert"]')?.textContent).toContain("La tarifa de Física I cambió. Revisá el importe.");
    expect(dialogo()?.textContent).toContain("$ 13.000 a nombre de Domínguez, Lara");
  });
  it("otro rechazo del servidor se muestra dentro del diálogo", async () => {
    rutas = (url) => url.startsWith("/api/pagos/pendientes") ? respuesta(pendientes())
      : url === "/api/pagos/operaciones" ? respuesta(null, false, { code: "CAJA_NO_ABIERTA", message: "No se puede registrar un cobro hasta que abras una caja." }) : undefined;
    await irAlPaso3();
    await pulsar(boton("Confirmar pago"));
    await pulsar(boton("Registrar pago"));
    expect(dialogo()?.querySelector('[role="alert"]')?.textContent).toContain("No se puede registrar un cobro hasta que abras una caja.");
  });
  it("éxito: envía el body, muestra el banner en singular y vuelve al paso 1", async () => {
    rutas = (url) => url.startsWith("/api/pagos/pendientes") ? respuesta(pendientes())
      : url === "/api/pagos/operaciones" ? { ok: true, status: 201, json: async () => ({ data: { pagos: [{ id: "p1" }] }, error: null }) } : undefined;
    await irAlPaso3();
    await pulsar(boton("Confirmar pago"));
    await pulsar(boton("Registrar pago"));
    const [, init] = fetch.mock.calls.find(([url]) => url === "/api/pagos/operaciones")!;
    expect(JSON.parse(init.body)).toEqual({ alumno_id: "a1", items: [{ inscripcion_id: "i1", monto: "12000" }], forma_pago_id: "f2", fecha_pago: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Pago registrado correctamente (1 clase)");
    expect(container.querySelector("#registrar-pago-buscador")).not.toBeNull();
    expect(replace).toHaveBeenCalledWith("/pagos/registrar");
  });
});
