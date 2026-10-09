// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/components/sesion/link-protegido", async () => {
  const React = await import("react");
  return { LinkProtegido: ({ href, children, prefetch, ...props }: { href: string; children: React.ReactNode; prefetch?: boolean }) => { void prefetch; return React.createElement("a", { href, ...props }, children); } };
});
vi.mock("next/link", async () => {
  const React = await import("react");
  return { default: ({ href, children, prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => { void prefetch; return React.createElement("a", { href, ...props }, children); } };
});

const { TurnoDetalleVista } = await import("./turno-detalle");

const RETORNO = "/turnos?pagina=2&orden=fecha_hora_asc";
const PAGOS = [
  { id: "pago-2", alumno: { id: "alumno-2", nombre_completo: "Gómez, Lucía" }, monto: "12000.00", forma_pago: { id: "fp-1", nombre: "Transferencia" }, fecha_pago: "2026-10-02", registrado_en: "2026-10-02T15:00:00.000Z" },
  { id: "pago-1", alumno: { id: "alumno-1", nombre_completo: "Pérez, Juan" }, monto: "15000.50", forma_pago: { id: "fp-2", nombre: "Efectivo" }, fecha_pago: "2026-10-01", registrado_en: "2026-10-01T15:00:00.000Z" },
];
const detalle = (extra: Record<string, unknown> = {}) => ({
  id: "turno-1", fecha: "2026-10-06", hora_inicio: "16:00", hora_fin: "17:00", duracion_minutos: 60, cupo_maximo: 6,
  alumnos_inscriptos: "2/6", alumnos: [{ id: "alumno-1", nombre: "Pérez, Juan", dni: "30123456" }, { id: "alumno-2", nombre: "Gómez, Lucía", dni: "30999888" }],
  profesor: "Méndez, Laura", profesor_id: "profesor-1", profesor_dni: "20111222", materia: "Matemática", materia_id: "materia-1", materia_codigo: "MAT",
  aula: "Aula 3", aula_id: "aula-1", aula_capacidad: 6, estado: "DISPONIBLE", prioridad: "NORMAL",
  creado_en: "2026-09-24T12:00:00.000Z", actualizado_en: "2026-09-25T12:00:00.000Z", creado_por_id: "usuario-1", modificado_por_id: "usuario-2",
  creado_por: "mesa@centro.com", pagos: PAGOS, acciones_habilitadas: ["cancelar", "reprogramar", "prioridad", "registrar_pago"],
  ...extra,
});
const respuesta = (data: unknown, ok = true, error?: unknown) => ({ ok, json: async () => ({ data, error }) });

let root: Root;
let container: HTMLDivElement;
const esperar = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const montar = async (props: { puedeConfigurar?: boolean; puedeGestionarAlumnos?: boolean; puedeRegistrarPago?: boolean; puedeRegistrarClase?: boolean } = {}) => {
  await act(async () => root.render(<TurnoDetalleVista id="turno-1" retorno={RETORNO} puedeConfigurar={props.puedeConfigurar ?? false} puedeGestionarAlumnos={props.puedeGestionarAlumnos ?? false} puedeRegistrarPago={props.puedeRegistrarPago ?? false} puedeRegistrarClase={props.puedeRegistrarClase ?? false} />));
  await esperar();
};
const valor = (etiqueta: string) => [...container.querySelectorAll("dt")].find((dt) => dt.textContent === etiqueta)?.nextElementSibling?.textContent;
const texto = () => container.textContent ?? "";

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetch);
  fetch.mockResolvedValue(respuesta(detalle()));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe("HU-C-09 detalle de turno (mockup pág. 5)", () => {
  it("migas «Turnos / {materia} · {dd/mm}» con el enlace al listado conservando retorno", async () => {
    await montar();
    const migas = container.querySelector('nav[aria-label="Breadcrumb"]')!;
    expect(migas.textContent).toBe("Turnos/Matemática · 06/10");
    expect(migas.querySelector("a")?.getAttribute("href")).toBe(RETORNO);
  });

  it("título con la materia y el estado, y subtítulo con fecha larga, horario, aula y profesor", async () => {
    await montar();
    expect(container.querySelector("h1")?.textContent).toBe("Matemática");
    expect(container.querySelector("header")?.textContent).toContain("Disponible");
    expect(texto()).toContain("Martes 6 de octubre de 2026 · 16:00–17:00 · Aula 3 · Méndez, Laura");
  });

  it("tarjeta «Datos del turno» con los campos de AC1 y sus formatos", async () => {
    await montar();
    expect([...container.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual([
      "Materia", "Profesor", "Aula", "Fecha", "Hora de inicio–fin", "Duración", "Cupo máximo", "Estado", "Prioridad", "Creado", "Creado por",
    ]);
    expect(container.querySelector("dt")?.className).toContain("uppercase");
    expect(valor("Profesor")).toBe("Méndez, Laura");
    expect(valor("Fecha")).toBe("06/10/2026");
    expect(valor("Hora de inicio–fin")).toBe("16:00–17:00");
    expect(valor("Duración")).toBe("1 hora");
    expect(valor("Cupo máximo")).toBe("6 alumnos");
    expect(valor("Estado")).toBe("Disponible");
    expect(valor("Prioridad")).toBe("Normal");
    expect(valor("Creado")).toBe("24/09/2026");
    expect(valor("Creado por")).toBe("mesa@centro.com");
  });

  it("prioridad como texto: Normal con contorno; Alta y Urgente con fondo e ícono de bandera", async () => {
    const insignia = () => [...container.querySelectorAll("dt")].find((dt) => dt.textContent === "Prioridad")?.nextElementSibling?.querySelector("span");
    await montar();
    expect(insignia()?.className).toContain("border-border");
    expect(insignia()?.querySelector("svg")).toBeNull();
    for (const [prioridad, etiqueta, colores] of [["ALTA", "Alta", ["bg-warning", "text-warning-foreground"]], ["URGENTE", "Urgente", ["bg-destructive", "text-card"]]] as const) {
      fetch.mockResolvedValue(respuesta(detalle({ prioridad })));
      await act(async () => root.unmount()); root = createRoot(container);
      await montar();
      expect(valor("Prioridad")).toBe(etiqueta);
      for (const clase of colores) expect(insignia()?.className).toContain(clase);
      expect(insignia()?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("layout del mockup: datos y alumnos a la izquierda; «Pago» a la derecha en proporción 2:1", async () => {
    await montar();
    const grilla = container.querySelector('section[aria-labelledby="datos-turno-titulo"]')!.parentElement!.parentElement!;
    expect(grilla.className).toContain("lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]");
    const [izquierda, derecha] = [...grilla.children];
    expect([...izquierda!.querySelectorAll("section")].map((s) => s.getAttribute("aria-labelledby"))).toEqual(["datos-turno-titulo", "inscripciones-titulo"]);
    expect(derecha!.tagName).toBe("ASIDE");
    expect(derecha!.querySelector('section[aria-labelledby="pago-turno-titulo"]')).not.toBeNull();
    expect(container.querySelector('section[aria-labelledby="datos-turno-titulo"] dl')?.className).toContain("lg:grid-cols-3");
  });

  it("sin «Pago» no se renderiza la columna derecha y el contenido ocupa una sola columna", async () => {
    const { pagos, ...sinPagos } = detalle();
    void pagos;
    fetch.mockResolvedValue(respuesta(sinPagos));
    await montar();
    const grilla = container.querySelector('section[aria-labelledby="datos-turno-titulo"]')!.parentElement!.parentElement!;
    expect(grilla.className).not.toContain("lg:grid-cols");
    expect(grilla.children).toHaveLength(1);
    expect(container.querySelector("aside")).toBeNull();
  });

  it("retira de la vista los datos que el mockup no muestra", async () => {
    await montar();
    for (const retirado of ["Identificador", "DNI", "20111222", "30123456", "MAT", "Código", "Capacidad", "Última actualización", "Modificado por", "turno-1"]) {
      expect(texto()).not.toContain(retirado);
    }
  });

  it("creador nulo → «Sin registrar»", async () => {
    fetch.mockResolvedValue(respuesta(detalle({ creado_por: null })));
    await montar();
    expect(valor("Creado por")).toBe("Sin registrar");
  });

  it("duración no múltiplo de 60 → «N min»", async () => {
    fetch.mockResolvedValue(respuesta(detalle({ duracion_minutos: 90, hora_fin: "17:30" })));
    await montar();
    expect(valor("Duración")).toBe("90 min");
  });

  it("alumnos inscriptos: listado completo con iniciales y ocupación «N de M»", async () => {
    await montar();
    const tarjeta = container.querySelector('section[aria-labelledby="inscripciones-titulo"]')!;
    expect(tarjeta.querySelector("h2")?.textContent).toBe("Alumnos inscriptos · 2 de 6");
    expect([...tarjeta.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["JPPérez, Juan", "LGGómez, Lucía"]);
  });

  it("sin permiso de gestión, la lista es de solo lectura", async () => {
    await montar();
    expect(container.querySelector('button[aria-label^="Quitar"]')).toBeNull();
    expect(container.querySelector("#agregar-alumno")).toBeNull();
  });

  it("con permiso en un DISPONIBLE: «Agregar alumno» en el encabezado de la tarjeta y «Quitar» por fila (HU-C-04)", async () => {
    await montar({ puedeGestionarAlumnos: true });
    const tarjeta = container.querySelector('section[aria-labelledby="inscripciones-titulo"]')!;
    const encabezado = tarjeta.firstElementChild!;
    expect(encabezado.querySelector("h2")).not.toBeNull();
    expect(encabezado.querySelector('label[for="agregar-alumno"]')?.textContent).toBe("Agregar alumno");
    expect([...tarjeta.querySelectorAll('button[aria-label^="Quitar a"]')].map((b) => b.getAttribute("aria-label"))).toEqual(["Quitar a Pérez, Juan", "Quitar a Gómez, Lucía"]);
  });

  it("«Quitar» sigue funcionando: DELETE y recarga del detalle", async () => {
    await montar({ puedeGestionarAlumnos: true });
    fetch.mockResolvedValueOnce(respuesta({ estado: "DISPONIBLE" }));
    fetch.mockResolvedValueOnce(respuesta(detalle({ alumnos: [{ id: "alumno-2", nombre: "Gómez, Lucía", dni: "30999888" }], alumnos_inscriptos: "1/6" })));
    await act(async () => { (container.querySelector('button[aria-label="Quitar a Pérez, Juan"]') as HTMLButtonElement).click(); });
    await esperar();
    expect(fetch).toHaveBeenCalledWith("/api/turnos/turno-1/alumnos/alumno-1", { method: "DELETE", cache: "no-store" });
    expect(texto()).toContain("Alumno quitado del turno");
    expect(texto()).toContain("Alumnos inscriptos · 1 de 6");
  });

  it("lista vacía con cupo asignado → texto del producto, no «Sin asignar»", async () => {
    fetch.mockResolvedValue(respuesta(detalle({ alumnos: [], alumnos_inscriptos: "0/6" })));
    await montar();
    expect(texto()).toContain("Alumnos inscriptos · 0 de 6");
    expect(texto()).toContain("El turno no tiene alumnos inscriptos.");
  });

  it("PENDIENTE sin asignar (AC3): «Sin asignar» en profesor, aula, cupo y ocupación; conserva los controles de configuración", async () => {
    fetch.mockResolvedValue(respuesta(detalle({
      estado: "PENDIENTE", profesor: "Sin asignar", profesor_id: null, aula: "Sin asignar", aula_id: null, cupo_maximo: null,
      alumnos: [], alumnos_inscriptos: "Sin asignar", pagos: [], acciones_habilitadas: ["descartar", "prioridad"],
    })));
    await montar({ puedeConfigurar: true, puedeGestionarAlumnos: true });
    expect(valor("Profesor")).toBe("Sin asignar");
    expect(valor("Aula")).toBe("Sin asignar");
    expect(valor("Cupo máximo")).toBe("Sin asignar");
    expect(texto()).toContain("Alumnos inscriptos · Sin asignar");
    expect(texto()).toContain("16:00–17:00 · Sin asignar · Sin asignar");
    expect([...container.querySelectorAll("a")].find((a) => a.textContent === "Modificar configuración y asignar aula")?.getAttribute("href"))
      .toBe(`/turnos/turno-1/configuracion?volver=${encodeURIComponent(RETORNO)}`);
    expect(container.querySelector("#agregar-alumno")).toBeNull();
  });

  it("oculta los enlaces de un turno anterior cuando falla la carga del detalle actual", async () => {
    fetch.mockResolvedValue(respuesta(detalle({ estado: "PENDIENTE", aula_id: "aula-1" })));
    await montar({ puedeConfigurar: true, puedeGestionarAlumnos: true });
    expect(texto()).toContain("Modificar configuración o aula");

    fetch.mockRejectedValue(new Error("No se pudo consultar el turno"));
    await act(async () => root.render(
      <TurnoDetalleVista id="turno-2" retorno={RETORNO} puedeConfigurar puedeGestionarAlumnos />,
    ));
    await esperar();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("No se pudo consultar el turno");
    expect(texto()).not.toContain("Modificar configuración o aula");
    expect(texto()).not.toContain("Asignar profesor y alumnos");
    expect(container.querySelector('section[aria-labelledby="datos-turno-titulo"]')).toBeNull();
  });

  it("CANCELADO conserva la lista de alumnos", async () => {
    fetch.mockResolvedValue(respuesta(detalle({ estado: "CANCELADO", acciones_habilitadas: [] })));
    await montar({ puedeGestionarAlumnos: true });
    expect(texto()).toContain("Pérez, Juan");
    expect(container.querySelector('button[aria-label^="Quitar"]')).toBeNull();
  });

  it("tarjeta «Pago»: pagos registrados con alumno, fecha · forma, monto y total exacto del PDF", async () => {
    await montar();
    const tarjeta = container.querySelector('section[aria-labelledby="pago-turno-titulo"]')!;
    expect(tarjeta.querySelector("h2")?.textContent).toBe("Pago");
    expect(tarjeta.textContent).toContain("Pagos registrados");
    expect([...tarjeta.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "Gómez, Lucía02/10/2026 · Transferencia$ 12.000", "Pérez, Juan01/10/2026 · Efectivo$ 15.000,50",
    ]);
    expect(tarjeta.textContent).toContain("Total registrado$ 27.000,50");
  });

  it("HU-I-01 ofrece registro solo con permiso y elegibilidad; conserva la lectura en un turno cancelado", async () => {
    await montar({ puedeRegistrarPago: true });
    expect([...container.querySelectorAll("button")].some((b) => b.textContent === "Registrar pago")).toBe(true);
    fetch.mockResolvedValue(respuesta(detalle({ estado: "CANCELADO", acciones_habilitadas: [] })));
    await act(async () => root.unmount()); root = createRoot(container);
    await montar({ puedeRegistrarPago: true });
    expect([...container.querySelectorAll("button")].some((b) => b.textContent === "Registrar pago")).toBe(false);
    expect(container.querySelector('section[aria-labelledby="pago-turno-titulo"]')).not.toBeNull();
  });

  it("HU-I-01 deshabilita registro cuando no hay inscriptos", async () => {
    fetch.mockResolvedValue(respuesta(detalle({ alumnos: [], acciones_habilitadas: [] })));
    await montar({ puedeRegistrarPago: true });
    expect(([...container.querySelectorAll("button")].find((b) => b.textContent === "Registrar pago") as HTMLButtonElement).disabled).toBe(true);
  });

  it("tarjeta «Pago» vacía → «Ninguno todavía.»", async () => {
    fetch.mockResolvedValue(respuesta(detalle({ pagos: [] })));
    await montar();
    expect(container.querySelector('section[aria-labelledby="pago-turno-titulo"]')?.textContent).toContain("Ninguno todavía.");
  });

  it("sin la propiedad pagos (Profesor o rol sin pagos:leer) no hay tarjeta «Pago»", async () => {
    const { pagos, ...sinPagos } = detalle();
    void pagos;
    fetch.mockResolvedValue(respuesta(sinPagos));
    await montar();
    expect(container.querySelector('section[aria-labelledby="pago-turno-titulo"]')).toBeNull();
  });

  it("acciones en el orden de la pág. 5 (Reprogramar · Asignar prioridad · Cancelar turno); I-01/E-01 siguen pendientes", async () => {
    await montar();
    const botones = [...container.querySelectorAll("header button")].map((elemento) => elemento.textContent);
    expect(botones).toEqual(["Reprogramar", "Asignar prioridad", "Cancelar turno"]);
    for (const accion of ["Descartar", "Registrar pago", "Registrar clase dictada"]) {
      expect([...container.querySelectorAll("button, a")].some((elemento) => elemento.textContent === accion)).toBe(false);
    }
    fetch.mockResolvedValue(respuesta(detalle({ estado: "CANCELADO", acciones_habilitadas: [] })));
    await act(async () => root.unmount()); root = createRoot(container);
    await montar();
    expect(container.querySelectorAll("header button")).toHaveLength(0);
  });

  it("HU-C-05 AC2: un PENDIENTE ofrece «Descartar» y nunca «Cancelar turno»", async () => {
    fetch.mockResolvedValue(respuesta(detalle({ estado: "PENDIENTE", acciones_habilitadas: ["descartar", "prioridad"] })));
    await montar();
    expect([...container.querySelectorAll("header button")].some((b) => b.textContent === "Reprogramar")).toBe(false);
    const botones = [...container.querySelectorAll("header button")].map((elemento) => elemento.textContent);
    expect(botones).toEqual(["Asignar prioridad", "Descartar"]);
  });

  it("HU-C-05 AC1: «Cancelar turno» abre el AlertDialog con el texto literal, el resumen y el aviso N-3", async () => {
    await montar();
    await act(async () => ([...container.querySelectorAll("header button")].find((b) => b.textContent === "Cancelar turno") as HTMLButtonElement).click());
    const dialogo = document.querySelector('[role="alertdialog"]')!;
    expect(dialogo.textContent).toContain("¿Confirmás cancelar este turno?");
    expect(dialogo.textContent).toContain("Matemática · Mar 06/10, 16:00–17:00 · Aula 3 · 2 alumnos inscriptos. Esta acción no se puede deshacer.");
    expect(dialogo.textContent).toContain("Este turno tiene 2 pagos registrados; no se reembolsan automáticamente");
  });

  it("HU-C-05 N-3: sin la propiedad pagos (sin pagos:leer) no hay aviso de pagos", async () => {
    const { pagos: _pagos, ...sinPagos } = detalle();
    void _pagos;
    fetch.mockResolvedValue(respuesta(sinPagos));
    await montar();
    await act(async () => ([...container.querySelectorAll("header button")].find((b) => b.textContent === "Cancelar turno") as HTMLButtonElement).click());
    const dialogo = document.querySelector('[role="alertdialog"]')!;
    expect(dialogo.textContent).toContain("¿Confirmás cancelar este turno?");
    expect(dialogo.textContent).not.toContain("pagos registrados");
  });

  it("HU-C-05 AC3/AC5: al confirmar cancela, recarga el mismo detalle y muestra «Cancelado» sin acciones", async () => {
    await montar();
    await act(async () => ([...container.querySelectorAll("header button")].find((b) => b.textContent === "Cancelar turno") as HTMLButtonElement).click());
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { id: "turno-1", estado: "CANCELADO" }, error: null }) })
      .mockResolvedValueOnce(respuesta(detalle({ estado: "CANCELADO", acciones_habilitadas: [] })));
    await act(async () => ([...document.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent === "Cancelar turno") as HTMLButtonElement).click());
    await esperar();
    expect(fetch).toHaveBeenCalledWith("/api/turnos/turno-1/cancelacion", { method: "POST", cache: "no-store" });
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(container.querySelector("header")?.textContent).toContain("Cancelado");
    expect(container.querySelectorAll("header button")).toHaveLength(0);
    expect(texto()).toContain("Pérez, Juan");
  });

  it("HU-C-06 AC1: «Reprogramar» abre el Dialog de la pág. 9 y carga las opciones de la fecha actual", async () => {
    await montar();
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { fecha: "2026-10-06", duracion_min: 60, tope_fecha: "2026-10-31",
      inicios: [{ hora_inicio: "16:00", hora_fin: "17:00", actual: true }, { hora_inicio: "17:00", hora_fin: "18:00", actual: false }] }, error: null }) });
    await act(async () => ([...container.querySelectorAll("header button")].find((b) => b.textContent === "Reprogramar") as HTMLButtonElement).click());
    await esperar();
    expect(fetch).toHaveBeenCalledWith("/api/turnos/turno-1/reprogramacion/opciones?fecha=2026-10-06", expect.objectContaining({ cache: "no-store" }));
    const dialogo = document.querySelector('[role="dialog"]')!;
    expect(dialogo.textContent).toContain("Reprogramar turno");
    expect(dialogo.textContent).toContain("Profesor (Méndez, Laura), aula y duración se mantienen.");
  });

  it("403 del Profesor: muestra el mensaje neutro y las migas sin datos del turno", async () => {
    fetch.mockResolvedValue(respuesta(null, false, { code: "SIN_PERMISO", message: "No tenés permisos para acceder a esta sección" }));
    await montar();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("No tenés permisos para acceder a esta sección");
    expect(container.querySelector('nav[aria-label="Breadcrumb"]')?.textContent).toBe("Turnos");
    expect(container.querySelector("h1")?.textContent).toBe("Detalle del turno");
  });
});


describe("HU-E-09 asistencia dentro de alumnos", () => {
  it("todos presentes, cambio individual y acción masiva accesible", async () => {
    fetch.mockResolvedValue(respuesta(detalle({ acciones_habilitadas: ["registrar_clase"] })));
    await montar({ puedeRegistrarClase: true });
    const grupos = container.querySelectorAll('[role="group"][aria-label^="Asistencia de"]');
    expect(grupos).toHaveLength(2);
    expect(grupos[0].querySelector('[aria-pressed="true"]')?.textContent).toBe("Presente");
    await act(async () => (grupos[0].querySelectorAll("button")[1] as HTMLButtonElement).click());
    expect(grupos[0].querySelector('[aria-pressed="true"]')?.textContent).toBe("Ausente");
    const masiva = [...container.querySelectorAll("button")].find((b) => b.textContent === "Marcar todos ausentes")!;
    await act(async () => masiva.click());
    expect([...grupos].every((g) => g.querySelector('[aria-pressed="true"]')?.textContent === "Ausente")).toBe(true);
    expect(texto()).toContain("Marcar todos presentes");
    expect(container.querySelector('[aria-labelledby="inscripciones-titulo"]')?.textContent).toContain("Registrar clase dictada");
  });
  it("confirmación envía estados y muestra persistencia sin tarjeta aparte", async () => {
    const sinRegistro = detalle({ clase_dictada: null, acciones_habilitadas: ["registrar_clase"] });
    const registrada = detalle({ clase_dictada: { id: "clase-1", registrada_en: "2026-10-06T20:05:00Z" }, acciones_habilitadas: [] });
    let guardada = false;
    fetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") { guardada = true; return respuesta({ id: "clase-1", ya_existia: false }); }
      if (url.endsWith("clase-dictada")) return respuesta({ id: "clase-1", registrada_en: "2026-10-06T20:05:00Z", con_control_asistencia: true, alumnos: [{ id: "alumno-1", nombre_completo: "Pérez, Juan", asistencia: "AUSENTE" }, { id: "alumno-2", nombre_completo: "Gómez, Lucía", asistencia: "PRESENTE" }], totales: { presentes: 1, ausentes: 1 } });
      return respuesta(guardada ? registrada : sinRegistro);
    });
    await montar({ puedeRegistrarClase: true });
    const grupo = container.querySelector('[role="group"][aria-label^="Asistencia de"]')!;
    await act(async () => (grupo.querySelectorAll("button")[1] as HTMLButtonElement).click());
    await act(async () => [...container.querySelectorAll("button")].find((b) => b.textContent === "Registrar clase dictada")!.click());
    await esperar();
    const dialogo = document.querySelector('[role="alertdialog"]')!;
    expect(dialogo.textContent).toContain("Presentes: 1. Ausentes: 1.");
    await act(async () => [...dialogo.querySelectorAll("button")].find((b) => b.textContent === "Registrar clase dictada")!.click());
    await esperar(); await esperar();
    const peticion = fetch.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(peticion[1].body)).toEqual({ asistencias: [{ alumno_id: "alumno-1", estado: "AUSENTE" }, { alumno_id: "alumno-2", estado: "PRESENTE" }] });
    expect(texto()).toContain("1 presentes · 1 ausentes");
    expect(container.querySelectorAll('[aria-pressed]')).toHaveLength(0);
  });
});
