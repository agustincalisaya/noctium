import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FichaEncabezado } from "./ficha-encabezado";

// HU-B-07: la acción de cambio de estado se ubica dentro de la cabecera, junto a «Modificar datos».
const props = { alumnoId: "a", nombre: "Ana", apellido: "Pérez", dni: "30111222", activo: true, puedeEditar: true };

describe("FichaEncabezado", () => {
  it("renderiza la acción recibida dentro de la cabecera, con el nombre, el DNI y «Modificar datos»", () => {
    const html = renderToStaticMarkup(<FichaEncabezado {...props} accion={<button>Desactivar alumno</button>} />);
    const cabecera = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(cabecera).toContain("Pérez, Ana");
    expect(cabecera).toContain("DNI 30111222");
    expect(cabecera).toContain("Modificar datos");
    expect(cabecera).toContain("<button>Desactivar alumno</button>");
  });

  it("sin acción no agrega botones", () => {
    expect(renderToStaticMarkup(<FichaEncabezado {...props} />)).not.toContain("<button");
  });
});
