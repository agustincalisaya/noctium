// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImpactoBajaAlumno } from "@/types/alumno.types";

// Confirmación de baja y reactivación de la ficha del alumno (HU-B-07, M-21).
// Las Server Actions, el router, el toast y el impacto de la baja están simulados.

const m = vi.hoisted(() => ({ desactivar: vi.fn(), reactivar: vi.fn(), refresh: vi.fn(), exito: vi.fn(), error: vi.fn(), fetch: vi.fn() }));
vi.mock("@/server/alumnos/actions", () => ({ desactivarAlumno: m.desactivar, reactivarAlumno: m.reactivar }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: m.exito, error: m.error } }));

import { EstadoAlumnoDialog } from "./estado-alumno-dialog";

const ACTIVO = { id: "ckalumno", nombre: "Ana", apellido: "Pérez", activo: true, version: 3 };
const UNA = {
  inscripcion_id: "i1", turno_id: "t1", fecha: "2026-10-12", hora_inicio: "16:00", hora_fin: "17:00",
  materia: { id: "m1", nombre: "Matemática" }, profesor: { id: "p1", nombre_para_mostrar: "Ruiz, Marta" },
};
const OTRA = { ...UNA, inscripcion_id: "i2", turno_id: "t2", fecha: "2026-10-13", hora_inicio: "09:30", materia: { id: "m2", nombre: "Física" }, profesor: null };
const impacto = (extra: Partial<ImpactoBajaAlumno> = {}): ImpactoBajaAlumno => ({
  alumno: { id: "ckalumno", nombre: "Ana", apellido: "Pérez" }, version: 3, total: 0, inscripciones_futuras: [], motivo_obligatorio: false, ...extra,
});
const NO_RESTAURAR = "Las inscripciones anteriores no se restauran. Inscribilo de nuevo si corresponde.";

let root: Root, container: HTMLDivElement;
const boton = (nombre: string, dentro: ParentNode = document) =>
  [...dentro.querySelectorAll("button")].find((b) => b.textContent?.trim() === nombre) as HTMLButtonElement | undefined;
const click = async (e: HTMLElement) => act(async () => e.click());
const confirmacion = () => document.querySelector('[role="alertdialog"]');
const alerta = () => confirmacion()!.querySelector('[role="alert"]');
const confirmarBaja = () => boton("Desactivar alumno", confirmacion()!)!;
const montar = (alumno: Partial<typeof ACTIVO & { activo: boolean }> = {}) =>
  act(async () => root.render(<EstadoAlumnoDialog alumno={{ ...ACTIVO, ...alumno }} />));
const abrirBaja = async (datos: ImpactoBajaAlumno = impacto()) => {
  m.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: datos, error: null }) });
  await montar();
  await click(boton("Desactivar alumno")!);
};
async function escribirMotivo(valor: string) {
  const area = document.querySelector("textarea")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(area, valor);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  vi.stubGlobal("fetch", m.fetch);
  m.desactivar.mockResolvedValue({ data: { id: "ckalumno", activo: false, version: 4, inscripciones_quitadas: 0 }, error: null });
  m.reactivar.mockResolvedValue({ data: { id: "ckalumno", activo: true, version: 5 }, error: null });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("baja (M-21)", () => {
  it("pide el impacto del alumno sin caché y abre la confirmación con su nombre", async () => {
    await abrirBaja();
    expect(m.fetch).toHaveBeenCalledWith("/api/alumnos/ckalumno/impacto-baja", { cache: "no-store" });
    expect(confirmacion()!.textContent).toContain("¿Estás seguro de que querés desactivar a Ana Pérez?");
    expect(confirmarBaja().className).toContain("bg-destructive");
  });

  it("el botón de baja conserva el texto rojo al pasar o apretar (prototipo: .btn-danger-o:hover)", async () => {
    await montar();
    const clases = boton("Desactivar alumno")!.className.split(" ");
    expect(clases).toEqual(expect.arrayContaining(["text-destructive", "hover:bg-destructive-soft", "hover:text-destructive"]));
    expect(clases).not.toContain("hover:text-accent-foreground");
  });

  it("si no se puede obtener el impacto avisa con un toast y no abre la confirmación", async () => {
    m.fetch.mockResolvedValue({ ok: false, json: async () => ({ data: null, error: { code: "ALUMNO_YA_INACTIVO", message: "El alumno ya está inactivo." } }) });
    await montar();
    await click(boton("Desactivar alumno")!);
    expect(m.error).toHaveBeenCalledWith("El alumno ya está inactivo.");
    expect(confirmacion()).toBeNull();
  });

  it("sin inscripciones futuras: el detalle genérico y ninguna lista", async () => {
    await abrirBaja(impacto());
    expect(confirmacion()!.textContent).toContain("El alumno dejará de ofrecerse para nuevas inscripciones y su cuenta de acceso quedará inactiva.");
    expect(confirmacion()!.querySelector("ul")).toBeNull();
  });

  it("singular: «1 clase futura» con su fila", async () => {
    await abrirBaja(impacto({ total: 1, inscripciones_futuras: [UNA] }));
    const texto = confirmacion()!.textContent!;
    expect(texto).toContain("Está inscripto en 1 clase futura: al desactivarlo se lo quitará de esa clase y esa inscripción no se restaurará si lo reactivás.");
    expect(texto).not.toContain("1 clases futuras");
    expect(confirmacion()!.querySelectorAll("li")).toHaveLength(1);
  });

  it("plural: «N clases futuras» y la lista con fecha dd/mm/aaaa, hora, materia y profesor (o «Sin profesor»)", async () => {
    await abrirBaja(impacto({ total: 2, inscripciones_futuras: [UNA, OTRA] }));
    expect(confirmacion()!.textContent).toContain("Está inscripto en 2 clases futuras: al desactivarlo se lo quitará de esas clases y esas inscripciones no se restaurarán si lo reactivás.");
    const filas = [...confirmacion()!.querySelectorAll("li")].map((li) => li.textContent);
    expect(filas).toEqual([
      "12/10/2026 · 16:00 · Matemática · Ruiz, Marta",
      "13/10/2026 · 09:30 · Física · Sin profesor",
    ]);
  });

  it("motivo opcional: «Opcional», contador, tope de 300 y confirmar habilitado vacío", async () => {
    await abrirBaja(impacto({ motivo_obligatorio: false }));
    expect(confirmacion()!.textContent).toContain("Opcional · 0/300");
    expect(document.querySelector("textarea")!.maxLength).toBe(300);
    expect(confirmarBaja().disabled).toBe(false);
    await escribirMotivo("Se mudó");
    expect(confirmacion()!.textContent).toContain("Opcional · 7/300");
  });

  it("motivo obligatorio: confirmar deshabilitado hasta que haya texto (los espacios no cuentan)", async () => {
    await abrirBaja(impacto({ motivo_obligatorio: true }));
    expect(confirmacion()!.textContent).toContain("Obligatorio: tiene clases pasadas, pagos o historial académico");
    expect(confirmarBaja().disabled).toBe(true);
    await click(confirmarBaja());
    expect(m.desactivar).not.toHaveBeenCalled();
    await escribirMotivo("    ");
    expect(confirmarBaja().disabled).toBe(true);
    await escribirMotivo("Dejó de asistir");
    expect(confirmarBaja().disabled).toBe(false);
  });

  it("al volver a abrir, el motivo anterior se borra", async () => {
    await abrirBaja(impacto());
    await escribirMotivo("Texto previo");
    await click(boton("Volver", confirmacion()!)!);
    await click(boton("Desactivar alumno")!);
    expect(document.querySelector("textarea")!.value).toBe("");
  });

  it("éxito: envía versión y motivo, informa «Alumno desactivado correctamente» y refresca", async () => {
    await abrirBaja(impacto({ motivo_obligatorio: true }));
    await escribirMotivo("Dejó de asistir");
    await click(confirmarBaja());
    expect(m.desactivar).toHaveBeenCalledWith("ckalumno", { version: 3, motivo: "Dejó de asistir" });
    expect(m.exito).toHaveBeenCalledWith("Alumno desactivado correctamente");
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(confirmacion()).toBeNull();
  });

  it.each([
    ["conflicto de versión", { code: "CONFLICTO_EDICION_CONCURRENTE", message: "La ficha fue modificada por otro usuario. Recargá para ver los datos actuales." }],
    ["alumno ya inactivo", { code: "ALUMNO_YA_INACTIVO", message: "El alumno ya está inactivo." }],
    ["otra persona modificando", { code: "TRANSACCION_OCUPADA", message: "Otra persona está modificando estos datos. Intentá de nuevo." }],
  ])("rechazo del servidor (%s): el mensaje dentro del diálogo, que sigue abierto y sin toast ni refresco", async (_caso, error) => {
    m.desactivar.mockResolvedValue({ data: null, error });
    await abrirBaja();
    await click(confirmarBaja());
    expect(alerta()!.textContent).toContain(error.message);
    expect(confirmacion()).not.toBeNull();
    expect(m.exito).not.toHaveBeenCalled();
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("MOTIVO_REQUERIDO: el rechazo del servidor aparece dentro del diálogo y se puede corregir y reintentar", async () => {
    m.desactivar.mockResolvedValueOnce({ data: null, error: { code: "MOTIVO_REQUERIDO", message: "Ingresá el motivo de la baja: el alumno tiene registros." } });
    await abrirBaja(impacto({ motivo_obligatorio: false }));
    await click(confirmarBaja());
    expect(alerta()!.textContent).toContain("Ingresá el motivo de la baja: el alumno tiene registros.");
    expect(m.exito).not.toHaveBeenCalled();
    await escribirMotivo("Tenía pagos");
    await click(confirmarBaja());
    expect(m.desactivar).toHaveBeenLastCalledWith("ckalumno", { version: 3, motivo: "Tenía pagos" });
    expect(m.exito).toHaveBeenCalledWith("Alumno desactivado correctamente");
  });

  it("error de validación del motivo: se muestra el mensaje del campo, no el genérico", async () => {
    m.desactivar.mockResolvedValue({
      data: null,
      error: { code: "VALIDATION_ERROR", message: "Revisá los datos ingresados", detalles: { motivo: ["El motivo admite hasta 300 caracteres."] } },
    });
    await abrirBaja();
    await click(confirmarBaja());
    expect(alerta()!.textContent).toContain("El motivo admite hasta 300 caracteres.");
    expect(alerta()!.textContent).not.toContain("Revisá los datos ingresados");
  });

  it("doble envío: dos clics separados, cada uno en su act, con la promesa pendiente, envían una sola baja", async () => {
    let resolver!: (valor: unknown) => void;
    m.desactivar.mockReturnValue(new Promise((r) => { resolver = r; }));
    await abrirBaja();
    await click(confirmarBaja());
    expect(boton("Procesando…", confirmacion()!)!.disabled).toBe(true);
    await click(boton("Procesando…", confirmacion()!)!);
    expect(m.desactivar).toHaveBeenCalledTimes(1);
    await act(async () => resolver({ data: { id: "ckalumno", activo: false, version: 4 }, error: null }));
    expect(m.desactivar).toHaveBeenCalledTimes(1);
    expect(m.exito).toHaveBeenCalledTimes(1);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("reactivación", () => {
  const abrirReactivar = async () => {
    await montar({ activo: false, version: 4 });
    await click(boton("Reactivar")!);
  };

  it("pide la confirmación con el nombre, sin motivo ni lectura del impacto, y la baja no se ofrece", async () => {
    await montar({ activo: false, version: 4 });
    expect(boton("Desactivar alumno")).toBeUndefined();
    await click(boton("Reactivar")!);
    expect(m.fetch).not.toHaveBeenCalled();
    expect(confirmacion()!.textContent).toContain("¿Estás seguro de que querés reactivar a Ana Pérez?");
    expect(confirmacion()!.querySelector("textarea")).toBeNull();
    expect(confirmacion()!.querySelector("ul")).toBeNull();
    expect(boton("Reactivar", confirmacion()!)!.className).not.toContain("bg-destructive");
  });

  it("éxito: envía solo la versión, informa «Alumno reactivado correctamente» con el aviso de inscripciones y refresca", async () => {
    await abrirReactivar();
    await click(boton("Reactivar", confirmacion()!)!);
    expect(m.reactivar).toHaveBeenCalledWith("ckalumno", { version: 4 });
    expect(m.desactivar).not.toHaveBeenCalled();
    expect(m.exito).toHaveBeenCalledWith("Alumno reactivado correctamente", { description: NO_RESTAURAR });
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(confirmacion()).toBeNull();
  });

  it("rechazo del servidor: dentro del diálogo, sin toast de éxito ni aviso de inscripciones", async () => {
    m.reactivar.mockResolvedValue({ data: null, error: { code: "ALUMNO_YA_ACTIVO", message: "El alumno ya está activo." } });
    await abrirReactivar();
    await click(boton("Reactivar", confirmacion()!)!);
    expect(alerta()!.textContent).toContain("El alumno ya está activo.");
    expect(m.exito).not.toHaveBeenCalled();
    expect(confirmacion()).not.toBeNull();
  });

  it("doble envío: dos clics separados, cada uno en su act, con la promesa pendiente, envían una sola reactivación", async () => {
    let resolver!: (valor: unknown) => void;
    m.reactivar.mockReturnValue(new Promise((r) => { resolver = r; }));
    await abrirReactivar();
    await click(boton("Reactivar", confirmacion()!)!);
    await click(boton("Procesando…", confirmacion()!)!);
    expect(m.reactivar).toHaveBeenCalledTimes(1);
    await act(async () => resolver({ data: { id: "ckalumno", activo: true, version: 5 }, error: null }));
    expect(m.exito).toHaveBeenCalledTimes(1);
  });
});
