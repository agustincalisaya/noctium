import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

// HU-A-05 (spec_modulo_A.md §2.7.2 y §3.11, decisión 9 de la task): los
// encabezados de las dos pantallas públicas de la recuperación.

async function encabezadosDe(ruta: string) {
  const reglas = (await nextConfig.headers?.()) ?? [];
  return Object.fromEntries(reglas.filter((regla) => regla.source === ruta).flatMap((regla) => regla.headers.map((h) => [h.key, h.value])));
}

describe("next.config.ts headers()", () => {
  it("/restablecer-contrasena: sin Referer y sin caché", async () => {
    expect(await encabezadosDe("/restablecer-contrasena")).toEqual({
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store, must-revalidate",
    });
  });

  it("/recuperar-contrasena: sin caché", async () => {
    expect(await encabezadosDe("/recuperar-contrasena")).toEqual({ "Cache-Control": "no-store, must-revalidate" });
  });

  it("no agrega encabezados a otras rutas (el login queda como está)", async () => {
    const reglas = (await nextConfig.headers?.()) ?? [];
    expect(reglas.map((regla) => regla.source).sort()).toEqual(["/recuperar-contrasena", "/restablecer-contrasena"]);
  });
});
