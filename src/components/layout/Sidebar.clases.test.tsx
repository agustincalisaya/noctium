import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

// HU-C-08 y HU-C-27 criterio 11: el listado «Clases» (/turnos) está en el menú
// de mesa de entrada, gerente y profesor. La sesión está simulada.

const m = vi.hoisted(() => ({ sesion: null as { user: { rol: string } } | null }));
vi.mock("@/auth", () => ({ auth: async () => m.sesion }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

const { Sidebar } = await import("./Sidebar");

type Seccion = { label: string; href?: string; items?: { label: string; href: string }[] };

async function seccionesDe(rol: string) {
  m.sesion = { user: { rol } };
  return ((await Sidebar()) as ReactElement<{ secciones: Seccion[] }>).props.secciones;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("HU-C-08 menú «Clases»", () => {
  it.each(["MESA_ENTRADA", "GERENTE", "PROFESOR"])("%s ve «Clases» → Listado (/turnos)", async (rol) => {
    const seccion = (await seccionesDe(rol)).find((s) => s.items?.some((i) => i.href === "/turnos"));
    expect(seccion).toMatchObject({ label: "Clases", items: [{ label: "Listado", href: "/turnos" }] });
  });

  it("el alumno no ve «Clases»", async () => {
    const hrefs = (await seccionesDe("ALUMNO")).flatMap((s) => [s.href, ...(s.items ?? []).map((i) => i.href)]);
    expect(hrefs).not.toContain("/turnos");
  });
});
