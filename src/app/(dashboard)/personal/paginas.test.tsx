import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Páginas del personal de mesa de entrada (P-45 y P-46, HU-F-01): listado
// mínimo, ficha en modo consulta, alta y edición; HU-F-05 suma a la ficha
// «Desactivar»/«Reactivar» y el historial de estados. El permiso, el servicio
// y los componentes de cliente están simulados.

const m = vi.hoisted(() => ({
  exigir: vi.fn(),
  tiene: vi.fn(),
  listar: vi.fn(),
  detalle: vi.fn(),
  parametro: vi.fn(),
  formulario: vi.fn(),
}));
vi.mock("@/server/shared/with-permission", () => ({ exigirPermiso: m.exigir, tienePermiso: m.tiene }));
vi.mock("@/server/personal/personal.service", () => ({ listarPersonal: m.listar, obtenerDetalleIntegrante: m.detalle }));
vi.mock("@/server/shared/parametros", () => ({ getParametroNumerico: m.parametro }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/shared/breadcrumb", () => ({
  Breadcrumb: ({ tramos }: { tramos: { etiqueta: string; href?: string }[] }) => (
    <nav data-migas={tramos.map((t) => t.etiqueta).join(" / ")} />
  ),
}));
vi.mock("@/components/shared/cuenta-acceso-card", () => ({
  CuentaAccesoCard: ({ cuenta }: { cuenta: { estado: string; debe_cambiar_password: boolean } }) => (
    <section data-cuenta={cuenta.estado} data-debe-cambiar={String(cuenta.debe_cambiar_password)} />
  ),
}));
vi.mock("./[id]/estado-integrante-dialog", () => ({
  EstadoIntegranteDialog: ({ integrante }: { integrante: Record<string, unknown> }) => (
    <button data-estado={JSON.stringify(integrante)}>{integrante.activo ? "Desactivar" : "Reactivar"}</button>
  ),
}));
vi.mock("./integrante-form", () => ({
  IntegranteForm: (props: Record<string, unknown>) => {
    m.formulario(props);
    return <form data-formulario={String(props.titulo)} />;
  },
}));

import { ErrorDeDominio } from "@/server/shared/error-dominio";
const { default: Listado } = await import("./page");
const { default: Nuevo } = await import("./nuevo/page");
const { default: Ficha } = await import("./[id]/page");
const { default: Editar } = await import("./[id]/editar/page");

const ID = "ckficha";
const DETALLE = {
  id: ID,
  version: 3,
  activo: true,
  nombre: "Lucía",
  apellido: "Fernández",
  dni: "30123456",
  fechaNacimiento: "1990-04-12",
  genero: "FEMENINO",
  telefono: null,
  email: "lucia@mail.com",
  creadoEl: new Date("2026-10-01T15:00:00.000Z"),
  modificadoEl: null,
  cuenta: { estado: "ACTIVA", email: "lucia@mail.com", rol: "MESA_ENTRADA", debe_cambiar_password: true },
  historialEstados: [] as unknown[],
  cajaAbierta: false,
  motivoObligatorioAlDesactivar: false,
};

/** Todos los permisos del Gerente salvo los indicados. */
const sinPermisos = (...faltan: string[]) => m.tiene.mockImplementation(async (accion: string) => !faltan.includes(accion));
/** Las props que la ficha le pasa al diálogo de estado (simulado). */
const propsEstado = (html: string) => JSON.parse(html.match(/data-estado="([^"]*)"/)![1]!.replace(/&quot;/g, '"'));

const ficha = async (query: Record<string, string> = {}) =>
  renderToStaticMarkup(await Ficha({ params: Promise.resolve({ id: ID }), searchParams: Promise.resolve(query) }));

beforeEach(() => {
  vi.clearAllMocks();
  m.exigir.mockResolvedValue({ id: "gerente", rol: "GERENTE" });
  m.tiene.mockResolvedValue(true);
  m.detalle.mockResolvedValue(DETALLE);
  m.parametro.mockImplementation(async (clave: string) => (clave === "dni_longitud_min" ? 7 : 8));
});

/**
 * Renderiza el listado: `page.tsx` envuelve la tabla en un componente de
 * servidor async dentro de `Suspense` (HU-F-03), que `renderToStaticMarkup` no
 * resuelve; acá se reemplaza por su resultado antes de renderizar.
 */
async function resolverAsync(nodo: unknown): Promise<unknown> {
  if (Array.isArray(nodo)) return Promise.all(nodo.map(resolverAsync));
  if (!isValidElement(nodo)) return nodo;
  const elemento = nodo as ReactElement<{ children?: unknown }>;
  if (typeof elemento.type === "function" && elemento.type.constructor.name === "AsyncFunction") {
    return resolverAsync(await (elemento.type as (p: unknown) => Promise<unknown>)(elemento.props));
  }
  if (elemento.props?.children === undefined) return elemento;
  return cloneElement(elemento, undefined, (await resolverAsync(elemento.props.children)) as ReactNode);
}

const listado = async (searchParams: Record<string, string> = {}) =>
  renderToStaticMarkup((await resolverAsync(await Listado({ searchParams: Promise.resolve(searchParams) }))) as ReactElement);

const PAGINA = (items: unknown[], extra: Record<string, unknown> = {}) => ({
  items,
  pagina: 1,
  por_pagina: 10,
  total: items.length,
  total_paginas: items.length ? 1 : 0,
  ...extra,
});

// HU-F-01 fijó el listado mínimo; HU-F-03 suma búsqueda y paginación. Los
// casos de F-01 se conservan (con la respuesta paginada) y se suman los nuevos.
describe("listado (P-45)", () => {
  it("vacío: el mensaje y el acceso a «Nuevo integrante»", async () => {
    m.listar.mockResolvedValue(PAGINA([]));
    const html = await listado();
    expect(m.exigir).toHaveBeenCalledWith("personal:leer");
    expect(m.listar).toHaveBeenCalledWith({ pagina: 1 });
    expect(html).toContain("Todavía no hay personal de mesa de entrada registrado");
    expect(html.match(/href="\/personal\/nuevo"/g)).toHaveLength(2);
    expect(html).not.toContain("<table");
  });

  it("con datos: columnas, «—» sin teléfono, estado y enlace a la ficha", async () => {
    m.listar.mockResolvedValue(
      PAGINA([
        { id: "f1", apellido: "Ruiz", nombre: "Marta", dni: "25100001", telefono: "+541155700001", email: "m@x.com", activo: true },
        { id: "f2", apellido: "Sosa", nombre: "Pablo", dni: "25100002", telefono: null, email: "p@x.com", activo: false },
      ]),
    );
    const html = await listado();
    for (const columna of ["Apellido", "Nombre", "DNI", "Teléfono", "Email", "Estado"]) expect(html).toContain(`>${columna}</th>`);
    expect(html).toContain('href="/personal/f1"');
    expect(html).toContain('href="/personal/f2"');
    expect(html).toContain(">—</td>");
    expect(html).toContain(">Activo<");
    expect(html).toContain(">Inactivo<");
    expect(html).toContain('href="/personal/nuevo"');
  });

  it("encabezado del prototipo: título, subtítulo de búsqueda, buscador y «Nuevo integrante»", async () => {
    m.listar.mockResolvedValue(PAGINA([]));
    const html = await listado();
    expect(html).toContain("Personal de mesa de entrada</h1>");
    expect(html).toContain("Buscá por nombre, apellido y DNI (desde 2 caracteres, sin distinguir mayúsculas ni tildes).");
    expect(html).toContain('placeholder="Ej.: ferreyra, 31222…"');
    expect(html).toContain('aria-label="Buscar integrante"');
  });

  it("toma pagina y q de la URL para el primer render", async () => {
    m.listar.mockResolvedValue(PAGINA([], { total: 0 }));
    const html = await listado({ pagina: "2", q: " gar " });
    expect(m.listar).toHaveBeenCalledWith({ pagina: 2, q: "gar" });
    expect(html).toContain('value="gar"');
  });

  it("una pagina inválida vuelve a la 1 y un q de más de 100 caracteres se ignora", async () => {
    m.listar.mockResolvedValue(PAGINA([]));
    await listado({ pagina: "abc", q: "a".repeat(101) });
    expect(m.listar).toHaveBeenCalledWith({ pagina: 1 });
  });

  it("sin resultados con q: el texto propuesto con el término y «Nuevo integrante»", async () => {
    m.listar.mockResolvedValue(PAGINA([]));
    const html = await listado({ q: "zeta" });
    expect(html).toContain("No se encontraron integrantes para «zeta»");
    expect(html).not.toContain("Todavía no hay personal");
    expect(html.match(/href="\/personal\/nuevo"/g)).toHaveLength(2);
  });

  it("con más de una página: el paginador conserva q", async () => {
    m.listar.mockResolvedValue(
      PAGINA([{ id: "f1", apellido: "Ruiz", nombre: "Marta", dni: "25100001", telefono: null, email: "m@x.com", activo: true }], {
        total: 23,
        total_paginas: 3,
        pagina: 2,
      }),
    );
    const html = await listado({ pagina: "2", q: "ruiz" });
    expect(html).toContain('href="/personal?q=ruiz"');
    expect(html).toContain('href="/personal?q=ruiz&amp;pagina=3"');
  });

  it("sin permiso no consulta el listado (exigirPermiso redirige)", async () => {
    m.exigir.mockRejectedValue(new Error("REDIRECT"));
    await expect(Listado({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT");
    expect(m.listar).not.toHaveBeenCalled();
  });
});

describe("ficha en modo consulta (P-46)", () => {
  it("identidad, contacto, fechas y «Cuenta de acceso»; «Editar» con personal:editar", async () => {
    const html = await ficha();
    expect(m.exigir).toHaveBeenCalledWith("personal:leer");
    expect(m.tiene).toHaveBeenCalledWith("personal:editar");
    expect(html).toContain("<h1");
    expect(html).toContain("Lucía Fernández");
    expect(html).toContain("12/04/1990");
    expect(html).toContain("Femenino");
    expect(html).toContain("lucia@mail.com");
    expect(html).toContain("Fecha de alta");
    expect(html).toContain("01/10/2026");
    expect(html).toContain("Sin cambios");
    expect(html).toContain('data-cuenta="ACTIVA"');
    expect(html).toContain('data-debe-cambiar="true"');
    expect(html).toContain(`href="/personal/${ID}/editar"`);
    expect(html).not.toContain(">Inactivo<");
  });

  it("sin personal:cambiar_estado no ofrece desactivar ni reactivar (HU-F-01 c7; HU-F-05)", async () => {
    sinPermisos("personal:cambiar_estado");
    const html = await ficha();
    expect(m.tiene).toHaveBeenCalledWith("personal:cambiar_estado");
    expect(html).not.toMatch(/desactivar|reactivar|dar de baja/i);
    // Sus únicos enlaces de acción son las migas y «Editar».
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("ficha inactiva: la etiqueta «Inactivo»; sin personal:cambiar_estado, sin acciones de estado", async () => {
    sinPermisos("personal:cambiar_estado");
    m.detalle.mockResolvedValue({ ...DETALLE, activo: false, cuenta: { ...DETALLE.cuenta, estado: "INACTIVA" } });
    const html = await ficha();
    expect(html).toContain(">Inactivo<");
    expect(html).toContain('data-cuenta="INACTIVA"');
    expect(html).not.toMatch(/desactivar|reactivar/i);
  });

  it("activa, con personal:cambiar_estado: «Desactivar» junto a «Editar», con la versión y los indicadores del detalle", async () => {
    m.detalle.mockResolvedValue({ ...DETALLE, cajaAbierta: true, motivoObligatorioAlDesactivar: true });
    const html = await ficha();
    expect(html).toContain(">Desactivar<");
    expect(html).not.toContain(">Reactivar<");
    expect(html.indexOf(`href="/personal/${ID}/editar"`)).toBeLessThan(html.indexOf(">Desactivar<"));
    expect(propsEstado(html)).toEqual({
      id: ID, nombre: "Lucía", apellido: "Fernández", activo: true, version: 3,
      tieneCuenta: true, cajaAbierta: true, motivoObligatorio: true,
    });
  });

  it("inactiva, con personal:cambiar_estado: «Reactivar» y no «Desactivar»", async () => {
    m.detalle.mockResolvedValue({ ...DETALLE, activo: false, version: 4, cuenta: { ...DETALLE.cuenta, estado: "INACTIVA" } });
    const html = await ficha();
    expect(html).toContain(">Reactivar<");
    expect(html).not.toContain(">Desactivar<");
    expect(propsEstado(html)).toMatchObject({ activo: false, version: 4, tieneCuenta: true });
  });

  it("sin cuenta vinculada: el diálogo lo sabe (tieneCuenta false)", async () => {
    m.detalle.mockResolvedValue({ ...DETALLE, cuenta: { estado: "SIN_CUENTA", email: null, rol: null, debe_cambiar_password: false } });
    expect(propsEstado(await ficha())).toMatchObject({ tieneCuenta: false });
  });

  it("solo personal:cambiar_estado (sin editar): el botón de estado sin «Editar»", async () => {
    sinPermisos("personal:editar");
    const html = await ficha();
    expect(html).not.toContain("/editar");
    expect(html).toContain(">Desactivar<");
  });

  it("historial de estados vacío: «Sin bajas ni reactivaciones.» junto a «Cuenta de acceso», debajo de «Registro»", async () => {
    const html = await ficha();
    expect(html).toContain("Historial de estados");
    expect(html).toContain("Sin bajas ni reactivaciones.");
    expect(html.indexOf("Registro")).toBeLessThan(html.indexOf('data-cuenta="ACTIVA"'));
    expect(html.indexOf('data-cuenta="ACTIVA"')).toBeLessThan(html.indexOf("Historial de estados"));
  });

  it("historial con entradas: acción, fecha y hora del centro, quien actuó (o «Usuario») y motivo", async () => {
    m.detalle.mockResolvedValue({
      ...DETALLE,
      historialEstados: [
        { id: "h2", accion: "REACTIVAR", motivo: null, fecha: new Date("2026-10-06T13:15:00.000Z"), usuarioId: "g", usuarioNombre: "Gómez, Ana" },
        { id: "h1", accion: "DESACTIVAR", motivo: "Licencia larga", fecha: new Date("2026-10-04T12:00:00.000Z"), usuarioId: null, usuarioNombre: null },
      ],
    });
    const html = await ficha();
    expect(html).not.toContain("Sin bajas ni reactivaciones.");
    expect(html.indexOf("Reactivación")).toBeLessThan(html.indexOf("Desactivación"));
    expect(html).toContain("06/10/2026, 10:15");
    expect(html).toContain("Gómez, Ana");
    expect(html).toContain("· Usuario");
    expect(html).toContain("Licencia larga");
  });

  it("sin personal:editar no muestra «Editar»", async () => {
    m.tiene.mockResolvedValue(false);
    expect(await ficha()).not.toContain("/editar");
  });

  it("modificada: muestra la fecha de la última modificación", async () => {
    m.detalle.mockResolvedValue({ ...DETALLE, modificadoEl: new Date("2026-10-05T12:30:00.000Z") });
    const html = await ficha();
    expect(html).toContain("05/10/2026");
    expect(html).not.toContain("Sin cambios");
  });

  it("banner tras el alta (con la cuenta creada) y tras editar", async () => {
    expect(await ficha({ creado: "1" })).toContain(
      "Integrante registrado correctamente. Se creó su cuenta: ingresa con su email y su DNI como contraseña, y la cambia en el primer ingreso.",
    );
    const editada = await ficha({ actualizada: "1" });
    expect(editada).toContain("Integrante actualizado correctamente");
    expect(editada).not.toContain("registrado correctamente");
    expect(await ficha()).not.toContain('role="status"');
  });

  it("inexistente: notFound()", async () => {
    m.detalle.mockRejectedValue(new ErrorDeDominio("errores.personal.noEncontrado"));
    await expect(ficha()).rejects.toThrow("NOT_FOUND");
  });
});

describe("alta y edición", () => {
  it("alta: personal:crear, la longitud del DNI de ParametroSistema, título y bajada del prototipo", async () => {
    const html = renderToStaticMarkup(await Nuevo());
    expect(m.exigir).toHaveBeenCalledWith("personal:crear");
    expect(html).toContain('data-migas="Personal de mesa de entrada / Nuevo integrante"');
    expect(m.formulario).toHaveBeenCalledWith(
      expect.objectContaining({
        dniLongitudMin: 7,
        dniLongitudMax: 8,
        titulo: "Nuevo integrante",
        bajada:
          "Al registrar la ficha se crea su cuenta de acceso: usuario = email y contraseña inicial = DNI, que cambia en el primer ingreso.",
      }),
    );
    expect(m.formulario.mock.calls[0]![0].integrante).toBeUndefined();
  });

  it("edición: personal:editar, el formulario precargado con la version y el nombre como título", async () => {
    renderToStaticMarkup(await Editar({ params: Promise.resolve({ id: ID }) }));
    expect(m.exigir).toHaveBeenCalledWith("personal:editar");
    expect(m.formulario).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: "Lucía Fernández",
        integrante: expect.objectContaining({ id: ID, version: 3, dni: "30123456", fechaNacimiento: "1990-04-12", email: "lucia@mail.com" }),
      }),
    );
  });

  it("edición de una ficha inexistente: notFound()", async () => {
    m.detalle.mockRejectedValue(new ErrorDeDominio("errores.personal.noEncontrado"));
    await expect(Editar({ params: Promise.resolve({ id: ID }) })).rejects.toThrow("NOT_FOUND");
  });
});
