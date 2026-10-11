import { Breadcrumb } from "@/components/shared/breadcrumb";
import { texto } from "@/lib/textos";
import { getParametroNumerico } from "@/server/shared/parametros";
import { exigirPermiso } from "@/server/shared/with-permission";
import { IntegranteForm } from "../integrante-form";

/**
 * Alta de un integrante de mesa de entrada (P-46 modo alta, HU-F-01;
 * prototipo figura 91). La longitud del DNI sale de `ParametroSistema`, igual
 * que en la Server Action y en la ruta. Solo el Gerente (`personal:crear`).
 */
export default async function NuevoIntegrantePage() {
  await exigirPermiso("personal:crear");
  const [dniLongitudMin, dniLongitudMax] = await Promise.all([
    getParametroNumerico("dni_longitud_min", 7),
    getParametroNumerico("dni_longitud_max", 8),
  ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 p-6">
      <Breadcrumb
        tramos={[
          { etiqueta: texto("ui.personal.listado.titulo"), href: "/personal" },
          { etiqueta: texto("ui.personal.alta.titulo") },
        ]}
      />
      <IntegranteForm
        dniLongitudMin={dniLongitudMin}
        dniLongitudMax={dniLongitudMax}
        titulo={texto("ui.personal.alta.titulo")}
        bajada={texto("ui.personal.alta.bajada")}
      />
    </div>
  );
}
