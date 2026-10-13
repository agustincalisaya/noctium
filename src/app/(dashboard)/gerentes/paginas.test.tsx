import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Páginas de gerentes (P-47 y P-48, HU-G-01): listado, ficha en modo consulta,
// alta y edición; HU-G-03 suma al listado la búsqueda, la paginación y «(vos)».
// El permiso, el servicio y los componentes de cliente están simulados.

const m = vi.hoisted(() => ({
  exigir: vi.fn(),
  tiene: vi.fn(),
  listar: vi.fn(),
  detalle: vi.fn(),
  parametro: vi.fn(),
  formulario: vi.fn(),
}));
vi.mock("@/server/shared/with-permission", () => ({ exigirPermiso: m.exigir, tienePermiso: m.tiene }));
vi.mock("@/server/gerentes/gerente.service", () => ({ listarGerentes: m.listar, obtenerDetalleGerente: m.detalle }));
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
  CuentaAccesoCard: ({ cuenta }: { cuenta: { estado: string; rol: string | null; debe_cambiar_password: boolean } }) => (
    <section data-cuenta={cuenta.estado} data-rol={cuenta.rol ?? ""} data-debe-cambiar={String(cuenta.debe_cambiar_password)} />
  ),
}));
vi.mock("./gerente-form", () => ({
  GerenteForm: (props: Record<string, unknown>) => {
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
const SESION = "ckgerentesesion";
const DETALLE = {
  id: ID,
  version: 3,
  activo: true,
  nombre: "Marcos",
  apellido: "Ibarra",
  dni: "27111222",
  fechaNacimiento: "1985-03-20",
  genero: "MASCULINO",
  telefono: null,
  email: "marcos@mail.com",
  creadoEl: new Date("2026-10-01T15:00:00.000Z"),
  modificadoEl: null,
  cuenta: { estado: "ACTIVA", email: "marcos@mail.com", rol: "GERENTE", debe_cambiar_password: true },
  esVos: false,
};

const ficha = async (query: Record<string, string> = {}) =>
  renderToStaticMarkup(await Ficha({ params: Promise.resolve({ id: ID }), searchParams: Promise.resolve(query) }));

beforeEach(() => {
  vi.clearAllMocks();
  m.exigir.mockResolvedValue({ id: SESION, rol: "GERENTE" });
  m.tiene.mockResolvedValue(true);
  m.detalle.mockResolvedValue(DETALLE);
  m.parametro.mockImplementation(async (clave: string) => (clave === "dni_longitud_min" ? 7 : 8));
});

/**
 * Renderiza el listado: `page.tsx` envuelve la tabla en un componente de
 * servidor async dentro de `Suspense` (HU-G-03, como `/personal`), que
 * `renderToStaticMarkup` no resuelve; acá se reemplaza por su resultado antes
 * de renderizar.
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

const FILA = { id: "g1", apellido: "Ibarra", nombre: "Marcos", dni: "27111222", telefono: null, email: "m@x.com", activo: true, esVos: false };

// HU-G-01 fijó el listado mínimo; HU-G-03 suma búsqueda, paginación y «(vos)».
// Los casos de G-01 se conservan (con la respuesta paginada y la sesión) y se
// suman los nuevos.
describe("listado (P-47)", () => {
  it("gerentes:leer; columnas, «—» sin teléfono, estado, enlace a la ficha y «Nuevo gerente»", async () => {
    m.listar.mockResolvedValue(
      PAGINA([
        { ...FILA, telefono: "+541155700001" },
        { id: "g2", apellido: "Sosa", nombre: "Pablo", dni: "25100002", telefono: null, email: "p@x.com", activo: false, esVos: false },
      ]),
    );
    const html = await listado();
    expect(m.exigir).toHaveBeenCalledWith("gerentes:leer");
    expect(m.listar).toHaveBeenCalledWith({ pagina: 1 }, SESION);
    expect(html).toContain("Gerentes</h1>");
    for (const columna of ["Apellido", "Nombre", "DNI", "Teléfono", "Email", "Estado"]) expect(html).toContain(`>${columna}</th>`);
    expect(html).toContain('href="/gerentes/g1"');
    expect(html).toContain('href="/gerentes/g2"');
    expect(html).toContain(">—</td>");
    expect(html).toContain(">Activo<");
    expect(html).toContain(">Inactivo<");
    expect(html.match(/href="\/gerentes\/nuevo"/g)).toHaveLength(1);
    expect(html).toContain("Nuevo gerente");
  });

  it("encabezado del prototipo: título, subtítulo de búsqueda, buscador y «Nuevo gerente»", async () => {
    m.listar.mockResolvedValue(PAGINA([FILA]));
    const html = await listado();
    expect(html).toContain("Gerentes</h1>");
    expect(html).toContain("Buscá por nombre, apellido o DNI (desde 2 caracteres, sin distinguir mayúsculas ni tildes).");
    expect(html).toContain('placeholder="Ej.: ferreyra, 31222…"');
    expect(html).toContain('aria-label="Buscar gerente"');
  });

  it("«(vos)» solo en la fila con esVos, y sin acciones de estado (HU-G-05)", async () => {
    m.listar.mockResolvedValue(PAGINA([FILA, { ...FILA, id: "g2", apellido: "Paz", esVos: true }]));
    const html = await listado();
    expect(html.match(/\(vos\)/g)).toHaveLength(1);
    expect(html).toMatch(/>Paz<\/a><span[^>]*>\(vos\)<\/span>/);
    expect(html).not.toMatch(/desactivar|reactivar/i);
  });

  it("toma pagina y q de la URL para el primer render y le pasa la sesión al servicio", async () => {
    m.listar.mockResolvedValue(PAGINA([], { total: 0 }));
    const html = await listado({ pagina: "2", q: " ferr " });
    expect(m.listar).toHaveBeenCalledWith({ pagina: 2, q: "ferr" }, SESION);
    expect(html).toContain('value="ferr"');
  });

  it("una pagina inválida vuelve a la 1 y un q de más de 100 caracteres se ignora", async () => {
    m.listar.mockResolvedValue(PAGINA([FILA]));
    await listado({ pagina: "abc", q: "a".repeat(101) });
    expect(m.listar).toHaveBeenCalledWith({ pagina: 1 }, SESION);
  });

  it("sin resultados con q: el texto propuesto con el término y «Nuevo gerente»", async () => {
    m.listar.mockResolvedValue(PAGINA([]));
    const html = await listado({ q: "zeta" });
    expect(html).toContain("No se encontraron gerentes para «zeta»");
    expect(html.match(/href="\/gerentes\/nuevo"/g)).toHaveLength(2);
    expect(html).not.toContain("<table");
  });

  it("sin q y sin filas (no debería darse): la tabla con los encabezados, sin mensaje de vacío", async () => {
    m.listar.mockResolvedValue(PAGINA([]));
    const html = await listado();
    expect(html).toContain("<table");
    expect(html).toContain(">Apellido</th>");
    expect(html).not.toContain("No se encontraron");
    expect(html).not.toContain("pagina=");
  });

  it("con más de una página: el paginador conserva q", async () => {
    m.listar.mockResolvedValue(PAGINA([FILA], { total: 23, total_paginas: 3, pagina: 2 }));
    const html = await listado({ pagina: "2", q: "ibarra" });
    expect(html).toContain('href="/gerentes?q=ibarra"');
    expect(html).toContain('href="/gerentes?q=ibarra&amp;pagina=3"');
  });

  it("sin permiso no consulta el listado (exigirPermiso redirige)", async () => {
    m.exigir.mockRejectedValue(new Error("REDIRECT"));
    await expect(Listado({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT");
    expect(m.listar).not.toHaveBeenCalled();
  });
});

describe("ficha en modo consulta (P-48)", () => {
  it("identidad, contacto, fechas y «Cuenta de acceso»; «Editar» con gerentes:editar; el servicio recibe la sesión", async () => {
    const html = await ficha();
    expect(m.exigir).toHaveBeenCalledWith("gerentes:leer");
    expect(m.detalle).toHaveBeenCalledWith(ID, SESION);
    expect(m.tiene).toHaveBeenCalledWith("gerentes:editar");
    expect(html).toContain("Marcos Ibarra</h1>");
    expect(html).toContain('data-migas="Gerentes / Ibarra, Marcos"');
    expect(html).toContain("20/03/1985");
    expect(html).toContain("Masculino");
    expect(html).toContain("marcos@mail.com");
    expect(html).toContain("Fecha de alta");
    expect(html).toContain("01/10/2026");
    expect(html).toContain("Sin cambios");
    expect(html).toContain('data-cuenta="ACTIVA"');
    expect(html).toContain('data-rol="GERENTE"');
    expect(html).toContain('data-debe-cambiar="true"');
    expect(html).toContain(`href="/gerentes/${ID}/editar"`);
    expect(html).not.toContain(">Inactivo<");
    expect(html.indexOf("Registro")).toBeLessThan(html.indexOf('data-cuenta="ACTIVA"'));
  });

  it("sin «Desactivar», «Reactivar» ni historial de estados (HU-G-05), también si es la propia", async () => {
    for (const esVos of [false, true]) {
      m.detalle.mockResolvedValue({ ...DETALLE, esVos });
      const html = await ficha();
      expect(html).not.toMatch(/desactivar|reactivar|historial/i);
      // Sus únicos enlaces de acción son las migas y «Editar».
      expect(html.match(/<a /g)).toHaveLength(1);
    }
  });

  it("ficha inactiva: la etiqueta «Inactivo»", async () => {
    m.detalle.mockResolvedValue({ ...DETALLE, activo: false, cuenta: { ...DETALLE.cuenta, estado: "INACTIVA" } });
    const html = await ficha();
    expect(html).toContain(">Inactivo<");
    expect(html).toContain('data-cuenta="INACTIVA"');
  });

  it("sin gerentes:editar no muestra «Editar»", async () => {
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
      "Gerente registrado correctamente. Se creó su cuenta: ingresa con su email y su DNI como contraseña, y la cambia en el primer ingreso.",
    );
    const editada = await ficha({ actualizada: "1" });
    expect(editada).toContain("Gerente actualizado correctamente");
    expect(editada).not.toContain("registrado correctamente");
    expect(await ficha()).not.toContain('role="status"');
  });

  it("inexistente: notFound()", async () => {
    m.detalle.mockRejectedValue(new ErrorDeDominio("errores.gerente.noEncontrado"));
    await expect(ficha()).rejects.toThrow("NOT_FOUND");
  });

  it("otro error se propaga al boundary del segmento", async () => {
    m.detalle.mockRejectedValue(new Error("connection refused"));
    await expect(ficha()).rejects.toThrow("connection refused");
  });
});

describe("alta y edición", () => {
  it("alta: gerentes:crear, la longitud del DNI de ParametroSistema, título y bajada del prototipo", async () => {
    const html = renderToStaticMarkup(await Nuevo());
    expect(m.exigir).toHaveBeenCalledWith("gerentes:crear");
    expect(html).toContain('data-migas="Gerentes / Nuevo gerente"');
    expect(m.formulario).toHaveBeenCalledWith(
      expect.objectContaining({
        dniLongitudMin: 7,
        dniLongitudMax: 8,
        titulo: "Nuevo gerente",
        bajada:
          "Al registrar la ficha se crea su cuenta de acceso: usuario = email y contraseña inicial = DNI, que cambia en el primer ingreso.",
      }),
    );
    expect(m.formulario.mock.calls[0]![0].gerente).toBeUndefined();
  });

  it("edición: gerentes:editar, el formulario precargado con la version, esVos y el nombre como título", async () => {
    m.detalle.mockResolvedValue({ ...DETALLE, esVos: true });
    const html = renderToStaticMarkup(await Editar({ params: Promise.resolve({ id: ID }) }));
    expect(m.exigir).toHaveBeenCalledWith("gerentes:editar");
    expect(m.detalle).toHaveBeenCalledWith(ID, SESION);
    expect(html).toContain('data-migas="Gerentes / Ibarra, Marcos / Editar"');
    expect(m.formulario).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: "Marcos Ibarra",
        gerente: {
          id: ID,
          version: 3,
          nombre: "Marcos",
          apellido: "Ibarra",
          dni: "27111222",
          fechaNacimiento: "1985-03-20",
          genero: "MASCULINO",
          telefono: null,
          email: "marcos@mail.com",
          esVos: true,
        },
      }),
    );
  });

  it("edición de una ficha inexistente: notFound()", async () => {
    m.detalle.mockRejectedValue(new ErrorDeDominio("errores.gerente.noEncontrado"));
    await expect(Editar({ params: Promise.resolve({ id: ID }) })).rejects.toThrow("NOT_FOUND");
  });
});

describe("error del segmento", () => {
  it("mensaje propio y «Reintentar», sin el error técnico", async () => {
    const { default: ErrorGerentes } = await import("./error");
    const html = renderToStaticMarkup(<ErrorGerentes error={new Error("connection refused")} retry={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("No se pudo cargar la información de los gerentes");
    expect(html).toContain("Reintentar");
    expect(html).not.toContain("connection refused");
  });
});
