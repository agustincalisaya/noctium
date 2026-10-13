import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Botones de contorno con estilo destructivo (prototipo: .btn-danger-o:hover).
// La variante `outline` aplica `hover:text-accent-foreground`; sin
// `hover:text-destructive` el texto se oscurece al pasar o presionar.
const raiz = fileURLToPath(new URL(".", import.meta.url));
const archivos = (readdirSync(raiz, { recursive: true }) as string[])
  .filter((ruta) => ruta.endsWith(".tsx") && !ruta.endsWith(".test.tsx"));
const clases = archivos.flatMap((ruta) =>
  [...readFileSync(join(raiz, ruta), "utf8").matchAll(/"([^"]*border-destructive text-destructive[^"]*)"/g)]
    .map(([, valor]) => ({ ruta, valor })),
);

describe("botones de contorno destructivos", () => {
  it("existen en la interfaz", () => {
    expect(clases.length).toBeGreaterThan(0);
  });

  it.each(clases)("$ruta conserva el fondo y el texto rojos al pasar o presionar", ({ valor }) => {
    expect(valor.split(" ")).toEqual(expect.arrayContaining(["hover:bg-destructive-soft", "hover:text-destructive"]));
  });
});
